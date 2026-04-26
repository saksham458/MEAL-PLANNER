"""
Smart Meal Planner — Configuration
Loads environment variables with sensible defaults for development.
"""

import os
from dotenv import load_dotenv

load_dotenv()


# ── MySQL Database ───────────────────────────────────────────
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "smartmeal")
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))

# ── JWT Authentication ───────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

# ── Edamam API ───────────────────────────────────────────────
EDAMAM_APP_ID = os.getenv("EDAMAM_APP_ID", "your_edamam_app_id")
EDAMAM_APP_KEY = os.getenv("EDAMAM_APP_KEY", "your_edamam_app_key")
EDAMAM_BASE_URL = "https://api.edamam.com/api/recipes/v2"

# ── C Engine ─────────────────────────────────────────────────
# Path to the compiled shared library (.dll on Windows, .so on Linux)
C_ENGINE_PATH = os.getenv(
    "C_ENGINE_PATH",
    os.path.join(os.path.dirname(__file__), "c_engine", "grocery_sort.dll")
)

# ── CORS ─────────────────────────────────────────────────────
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:5500").split(",")

# ── Razorpay Payment Gateway ─────────────────────────────────
# Get keys from: https://dashboard.razorpay.com/app/keys
# Test keys start with rzp_test_, Live keys start with rzp_live_
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

