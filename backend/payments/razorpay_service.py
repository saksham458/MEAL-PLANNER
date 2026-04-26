"""
Smart Meal Planner — Razorpay Payment Service
Wraps the official razorpay Python SDK for order creation,
payment verification, and HMAC webhook signature validation.

Install: pip install razorpay
"""

import hmac
import hashlib
import logging
import razorpay
from config import RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET

logger = logging.getLogger("smartmeal.payments")


class RazorpayService:
    """
    Thin wrapper around the Razorpay SDK.
    Falls back gracefully if keys are not configured (demo mode).
    """

    def __init__(self):
        self.key_id = RAZORPAY_KEY_ID
        self.key_secret = RAZORPAY_KEY_SECRET
        self.webhook_secret = RAZORPAY_WEBHOOK_SECRET
        self.client = None
        self.is_configured = False

        if self.key_id and self.key_secret and not self.key_id.startswith("rzp_test_your"):
            try:
                self.client = razorpay.Client(auth=(self.key_id, self.key_secret))
                self.is_configured = True
                logger.info("✅ Razorpay SDK initialized (mode: %s)",
                            "LIVE" if self.key_id.startswith("rzp_live") else "TEST")
            except Exception as e:
                logger.warning("⚠️ Razorpay SDK init failed: %s — falling back to mock", e)
        else:
            logger.info("ℹ️ Razorpay keys not configured — running in mock/demo mode")

    # ── Order Creation ────────────────────────────────────────

    def create_order(self, amount_inr: float, receipt_id: str, notes: dict = None) -> dict:
        """
        Create a Razorpay Order. Returns order data including the
        razorpay_order_id that the frontend needs to launch checkout.

        Args:
            amount_inr: Amount in Indian Rupees (e.g. 165.00)
            receipt_id: Your internal order/receipt ID
            notes: Optional key-value metadata dict
        """
        if not self.is_configured:
            raise RuntimeError("Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env")

        # Razorpay expects amount in paise (INR × 100)
        amount_paise = int(round(amount_inr * 100))

        order_data = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt_id,
            "payment_capture": "1",  # Auto-capture after successful payment
        }
        if notes:
            order_data["notes"] = notes

        order = self.client.order.create(data=order_data)

        logger.info("💳 Razorpay Order created: %s | ₹%.2f | receipt: %s",
                     order["id"], amount_inr, receipt_id)

        return {
            "razorpay_order_id": order["id"],
            "amount": order["amount"],
            "amount_inr": amount_inr,
            "currency": order["currency"],
            "receipt": receipt_id,
            "key_id": self.key_id,  # Frontend needs this to launch checkout
        }

    # ── Payment Verification (Client-side) ────────────────────

    def verify_payment_signature(
        self, razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str
    ) -> bool:
        """
        Verify the payment signature returned by Razorpay Checkout
        to the frontend's success handler. Uses HMAC-SHA256.
        """
        if not self.is_configured:
            return False

        try:
            self.client.utility.verify_payment_signature({
                "razorpay_order_id": razorpay_order_id,
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_signature": razorpay_signature,
            })
            logger.info("✅ Payment signature verified: %s", razorpay_payment_id)
            return True
        except razorpay.errors.SignatureVerificationError:
            logger.warning("❌ Payment signature INVALID: %s", razorpay_payment_id)
            return False

    # ── Webhook Verification (Server-to-Server) ───────────────

    def verify_webhook_signature(self, body: bytes, signature: str) -> bool:
        """
        Verify the HMAC-SHA256 signature on a Razorpay webhook payload.
        This is called when Razorpay's servers POST to /api/webhooks/razorpay.
        """
        if not self.webhook_secret:
            logger.warning("⚠️ Webhook secret not set — cannot verify webhook")
            return False

        expected = hmac.new(
            key=self.webhook_secret.encode("utf-8"),
            msg=body,
            digestmod=hashlib.sha256,
        ).hexdigest()

        is_valid = hmac.compare_digest(expected, signature)
        if not is_valid:
            logger.warning("❌ Webhook signature mismatch")
        return is_valid


# ── Singleton Instance ────────────────────────────────────────
# Imported by routes to avoid re-creating the client
try:
    razorpay_service = RazorpayService()
except Exception as e:
    logger.error("Failed to initialize RazorpayService: %s", e)
    razorpay_service = RazorpayService.__new__(RazorpayService)
    razorpay_service.is_configured = False
    razorpay_service.client = None
