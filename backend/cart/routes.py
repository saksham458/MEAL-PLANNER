"""
Smart Meal Planner — Shopping Cart & Payment Routes
POST /api/cart/save         — Save cart items (Buy Later)
GET  /api/cart              — Get saved cart items
DELETE /api/cart             — Clear saved cart
POST /api/cart/checkout     — Process checkout (mock payment)
GET  /api/cart/transaction/{id} — Get transaction status
"""

import json
import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from database import get_db
from auth.jwt_handler import get_current_user

logger = logging.getLogger("smartmeal.cart")
router = APIRouter(prefix="/api/cart", tags=["Shopping Cart"])


# ── Pydantic Models ──────────────────────────────────────────

class CartItem(BaseModel):
    name: str
    category: str
    qty: str = "1"
    price: float = 0.0
    aisle: str = ""

class SaveCartRequest(BaseModel):
    items: list[CartItem]

class CheckoutRequest(BaseModel):
    items: list[CartItem]
    payment_method: str = Field(..., description="qr | phonepe | wallet | card")
    total_amount: float

class TransactionResponse(BaseModel):
    transaction_id: str
    order_id: str
    status: str
    amount: float
    payment_method: str
    upi_string: Optional[str] = None
    timestamp: str


# ── Routes ───────────────────────────────────────────────────

@router.post("/save")
async def save_cart(body: SaveCartRequest, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Save cart items for 'Buy Later' functionality."""
    user_id = int(user["sub"])
    cart_json = json.dumps([item.dict() for item in body.items])

    async with db.cursor() as cur:
        # Upsert: delete old cart and insert new one
        await cur.execute("DELETE FROM saved_carts WHERE user_id = %s", (user_id,))
        await cur.execute(
            "INSERT INTO saved_carts (user_id, cart_data, item_count) VALUES (%s, %s, %s)",
            (user_id, cart_json, len(body.items)),
        )
        await db.commit()

    return {"message": f"Cart saved with {len(body.items)} items", "item_count": len(body.items)}


@router.get("")
async def get_cart(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Retrieve the user's saved cart."""
    user_id = int(user["sub"])

    async with db.cursor() as cur:
        await cur.execute(
            "SELECT cart_data, item_count, created_at FROM saved_carts WHERE user_id = %s ORDER BY created_at DESC LIMIT 1",
            (user_id,),
        )
        cart = await cur.fetchone()

    if not cart:
        return {"items": [], "item_count": 0}

    return {
        "items": json.loads(cart["cart_data"]),
        "item_count": cart["item_count"],
        "saved_at": str(cart["created_at"]),
    }


@router.delete("")
async def clear_cart(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Clear the user's saved cart."""
    user_id = int(user["sub"])

    async with db.cursor() as cur:
        await cur.execute("DELETE FROM saved_carts WHERE user_id = %s", (user_id,))
        await db.commit()

    return {"message": "Cart cleared"}


@router.post("/checkout", response_model=TransactionResponse)
async def checkout(body: CheckoutRequest, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """
    Process a mock checkout.
    Generates a unique transaction ID and UPI payment string.
    In production, this would integrate with a real payment gateway.
    """
    user_id = int(user["sub"])
    transaction_id = f"TXN{uuid.uuid4().hex[:12].upper()}"
    order_id = f"ORD{uuid.uuid4().hex[:8].upper()}"
    timestamp = datetime.now(timezone.utc).isoformat()

    # Generate UPI string (replicates real UPI flow)
    upi_string = (
        f"upi://pay?pa=smartmeal@upi"
        f"&pn=SmartMeal"
        f"&tr={transaction_id}"
        f"&tn=SmartMeal%20Grocery%20Order%20{order_id}"
        f"&am={body.total_amount:.2f}"
        f"&cu=INR"
        f"&mc=5411"
    )

    # Save transaction to database
    async with db.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO transactions
                (user_id, transaction_id, order_id, payment_method, amount, status, upi_string, items_json)
            VALUES (%s, %s, %s, %s, %s, 'pending', %s, %s)
            """,
            (
                user_id, transaction_id, order_id,
                body.payment_method, body.total_amount,
                upi_string,
                json.dumps([item.dict() for item in body.items]),
            ),
        )
        # Clear saved cart after checkout
        await cur.execute("DELETE FROM saved_carts WHERE user_id = %s", (user_id,))
        await db.commit()

    # Simulate payment success after 3 seconds (mock)
    # In production, this would be handled by payment gateway webhook
    logger.info(f"💳 Checkout: {transaction_id} | ₹{body.total_amount} | {body.payment_method}")

    return TransactionResponse(
        transaction_id=transaction_id,
        order_id=order_id,
        status="pending",
        amount=body.total_amount,
        payment_method=body.payment_method,
        upi_string=upi_string if body.payment_method == "qr" else None,
        timestamp=timestamp,
    )


@router.get("/transaction/{transaction_id}")
async def get_transaction(transaction_id: str, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Get transaction status. Simulates payment verification."""
    user_id = int(user["sub"])

    async with db.cursor() as cur:
        await cur.execute(
            "SELECT * FROM transactions WHERE transaction_id = %s AND user_id = %s",
            (transaction_id, user_id),
        )
        txn = await cur.fetchone()

    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Mock: mark as success after creation (simulates gateway callback)
    if txn["status"] == "pending":
        async with db.cursor() as cur:
            await cur.execute(
                "UPDATE transactions SET status = 'success' WHERE transaction_id = %s",
                (transaction_id,),
            )
            await db.commit()

    return {
        "transaction_id": txn["transaction_id"],
        "order_id": txn["order_id"],
        "status": "success",
        "amount": float(txn["amount"]),
        "payment_method": txn["payment_method"],
        "timestamp": str(txn["created_at"]),
    }
