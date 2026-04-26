"""
Smart Meal Planner — Payment Routes (Razorpay + Webhook)

Endpoints:
    POST /api/payments/create-order  — Create Razorpay order (frontend calls before checkout)
    POST /api/payments/verify        — Verify payment after Razorpay Checkout success
    POST /api/webhooks/razorpay      — Server-to-server webhook (Razorpay → us)
"""

import json
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional

from database import get_db
from auth.jwt_handler import get_current_user
from payments.razorpay_service import razorpay_service

logger = logging.getLogger("smartmeal.payments")
router = APIRouter(tags=["Payments"])


# ── Pydantic Models ──────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Amount in INR")
    items: list[dict] = Field(default=[], description="Cart items for reference")

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    internal_order_id: Optional[str] = None


# ── POST /api/payments/create-order ──────────────────────────

@router.post("/api/payments/create-order")
async def create_order(
    body: CreateOrderRequest,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Step 1 of Razorpay flow: Create an Order on Razorpay's servers.
    Returns the razorpay_order_id + key_id so the frontend can launch checkout.
    """
    user_id = int(user["sub"])
    receipt_id = f"rcpt_{uuid.uuid4().hex[:10]}"
    internal_order_id = f"ORD{uuid.uuid4().hex[:8].upper()}"

    # Check if Razorpay is configured
    if not razorpay_service.is_configured:
        # Return a mock order so the frontend can still function in demo mode
        logger.info("📦 Mock order created (Razorpay not configured): %s", internal_order_id)
        return {
            "mode": "mock",
            "internal_order_id": internal_order_id,
            "razorpay_order_id": None,
            "key_id": None,
            "amount": body.amount,
            "currency": "INR",
        }

    # Real Razorpay order
    try:
        rz_order = razorpay_service.create_order(
            amount_inr=body.amount,
            receipt_id=receipt_id,
            notes={
                "user_id": str(user_id),
                "internal_order_id": internal_order_id,
            },
        )
    except Exception as e:
        logger.error("Razorpay order creation failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Payment gateway error: {str(e)}")

    # Save pending transaction to MySQL
    async with db.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO transactions
                (user_id, transaction_id, order_id, payment_method, amount, status,
                 razorpay_order_id, items_json)
            VALUES (%s, %s, %s, 'razorpay', %s, 'created', %s, %s)
            """,
            (
                user_id,
                receipt_id,
                internal_order_id,
                body.amount,
                rz_order["razorpay_order_id"],
                json.dumps(body.items),
            ),
        )
        await db.commit()

    return {
        "mode": "live",
        "internal_order_id": internal_order_id,
        "razorpay_order_id": rz_order["razorpay_order_id"],
        "key_id": rz_order["key_id"],
        "amount": rz_order["amount"],        # in paise
        "amount_inr": rz_order["amount_inr"],
        "currency": rz_order["currency"],
    }


# ── POST /api/payments/verify ────────────────────────────────

@router.post("/api/payments/verify")
async def verify_payment(
    body: VerifyPaymentRequest,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Step 2: After Razorpay Checkout succeeds on the frontend,
    the frontend sends the razorpay_payment_id + signature here
    for server-side verification using HMAC-SHA256.
    """
    if not razorpay_service.is_configured:
        return {"verified": True, "mode": "mock"}

    is_valid = razorpay_service.verify_payment_signature(
        razorpay_order_id=body.razorpay_order_id,
        razorpay_payment_id=body.razorpay_payment_id,
        razorpay_signature=body.razorpay_signature,
    )

    if not is_valid:
        raise HTTPException(status_code=400, detail="Payment signature verification failed")

    # Mark transaction as paid in MySQL
    user_id = int(user["sub"])
    async with db.cursor() as cur:
        await cur.execute(
            """
            UPDATE transactions
            SET status = 'paid',
                razorpay_payment_id = %s,
                razorpay_signature = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE razorpay_order_id = %s AND user_id = %s
            """,
            (body.razorpay_payment_id, body.razorpay_signature,
             body.razorpay_order_id, user_id),
        )
        # Clear saved cart
        await cur.execute("DELETE FROM saved_carts WHERE user_id = %s", (user_id,))
        await db.commit()

    logger.info("✅ Payment verified & recorded: %s → %s",
                body.razorpay_order_id, body.razorpay_payment_id)

    return {
        "verified": True,
        "razorpay_payment_id": body.razorpay_payment_id,
        "status": "paid",
    }


# ── POST /api/webhooks/razorpay ──────────────────────────────

@router.post("/api/webhooks/razorpay")
async def razorpay_webhook(request: Request, db=Depends(get_db)):
    """
    Razorpay server-to-server webhook.
    NO authentication (comes from Razorpay, not our users).
    Verified by HMAC-SHA256 signature in X-Razorpay-Signature header.

    Key events:
        payment.captured  — User successfully paid
        payment.failed    — Payment attempt failed
        refund.processed  — Refund completed
    """
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    # Verify webhook signature
    if razorpay_service.webhook_secret:
        if not razorpay_service.verify_webhook_signature(body, signature):
            logger.warning("❌ Webhook rejected — invalid signature")
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    # Parse the event
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = payload.get("event", "")
    payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})

    logger.info("🔔 Razorpay webhook: %s | payment_id: %s | order_id: %s",
                event,
                payment_entity.get("id"),
                payment_entity.get("order_id"))

    if event == "payment.captured":
        # Payment successful — update MySQL
        razorpay_order_id = payment_entity.get("order_id")
        razorpay_payment_id = payment_entity.get("id")
        amount = payment_entity.get("amount", 0) / 100  # paise → INR

        if razorpay_order_id:
            async with db.cursor() as cur:
                await cur.execute(
                    """
                    UPDATE transactions
                    SET status = 'paid',
                        razorpay_payment_id = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE razorpay_order_id = %s AND status != 'paid'
                    """,
                    (razorpay_payment_id, razorpay_order_id),
                )
                rows = cur.rowcount
                await db.commit()

            logger.info("✅ Webhook: marked order %s as paid (₹%.2f) — %d rows updated",
                        razorpay_order_id, amount, rows)

    elif event == "payment.failed":
        razorpay_order_id = payment_entity.get("order_id")
        if razorpay_order_id:
            async with db.cursor() as cur:
                await cur.execute(
                    "UPDATE transactions SET status = 'failed' WHERE razorpay_order_id = %s",
                    (razorpay_order_id,),
                )
                await db.commit()
            logger.info("❌ Webhook: payment failed for order %s", razorpay_order_id)

    elif event == "refund.processed":
        razorpay_payment_id = payload.get("payload", {}).get("refund", {}).get("entity", {}).get("payment_id")
        if razorpay_payment_id:
            async with db.cursor() as cur:
                await cur.execute(
                    "UPDATE transactions SET status = 'refunded' WHERE razorpay_payment_id = %s",
                    (razorpay_payment_id,),
                )
                await db.commit()
            logger.info("💸 Webhook: refund processed for payment %s", razorpay_payment_id)

    # Always return 200 to acknowledge receipt (Razorpay retries on non-2xx)
    return {"status": "ok"}
