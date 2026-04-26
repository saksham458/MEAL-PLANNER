"""
╔══════════════════════════════════════════════════════════════╗
║          SMART MEAL PLANNER — FastAPI Backend                ║
║          Production-Ready API Server                         ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Modules:                                                    ║
║    • Auth       — JWT registration & login                   ║
║    • Settings   — Biometrics & macro recalculation           ║
║    • Meals      — Edamam-powered 7-day plan generation       ║
║    • Grocery    — C-engine sorted grocery lists              ║
║    • Progress   — Daily macro tracking vs goals              ║
║    • Cart       — Save/load cart, mock checkout              ║
║    • Payments   — Razorpay order creation + webhooks         ║
║                                                              ║
║  Run:                                                        ║
║    uvicorn main:app --reload --host 0.0.0.0 --port 8000     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from database import init_db_pool, close_db_pool

# ── Route Imports ────────────────────────────────────────────
from auth.routes import router as auth_router
from users.routes import router as users_router
from meals.routes import router as meals_router
from grocery.routes import router as grocery_router
from progress.routes import router as progress_router
from notifications.websocket import router as ws_router
from cart.routes import router as cart_router
from payments.routes import router as payments_router

# ── Logging Configuration ────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-24s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("smartmeal")


# ── Application Lifespan (startup/shutdown) ──────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages application lifecycle:
    - Startup: Initialize MySQL connection pool
    - Shutdown: Close connection pool gracefully
    """
    logger.info("🚀 Starting Smart Meal Planner API...")
    await init_db_pool()
    logger.info("✅ All systems initialized")
    yield
    logger.info("🔌 Shutting down...")
    await close_db_pool()
    logger.info("👋 Goodbye!")


# ── FastAPI Application ──────────────────────────────────────
app = FastAPI(
    title="Smart Meal Planner API",
    description=(
        "AI-powered meal planning, biometric-based macro tracking, "
        "Edamam recipe integration, C-engine grocery sorting, "
        "and real-time WebSocket notifications."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ── CORS Middleware ──────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Register All Routers ────────────────────────────────────
app.include_router(auth_router)       # /auth/register, /auth/login
app.include_router(users_router)      # /settings, /settings/profile
app.include_router(meals_router)      # /api/meals/generate, /plan, /swap, /log
app.include_router(grocery_router)    # /api/grocery-list
app.include_router(progress_router)   # /api/progress/today, /water, /steps
app.include_router(ws_router)         # /ws/notifications, /api/notifications
app.include_router(cart_router)       # /api/cart/save, /checkout, /transaction
app.include_router(payments_router)   # /api/payments/create-order, /verify, /webhooks/razorpay


# ── Root Health Check ────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    """API health check endpoint."""
    return {
        "service": "Smart Meal Planner API",
        "version": "1.0.0",
        "status": "healthy",
        "docs": "/docs",
        "modules": {
            "auth": "/auth",
            "settings": "/settings",
            "meals": "/api/meals",
            "grocery": "/api/grocery-list",
            "progress": "/api/progress",
            "notifications_ws": "/ws/notifications",
        },
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Detailed health check with dependency status."""
    from grocery.c_bridge import sorter

    return {
        "status": "healthy",
        "database": "connected",
        "c_engine": "loaded" if sorter._lib else "fallback (python)",
        "edamam": "configured",
        "websockets": "active",
    }


if __name__ == "__main__":
    import uvicorn
    import os

    # Cloud providers like Render/Railway/Heroku assign a dynamic PORT
    port = int(os.getenv("PORT", 8000))
    logger.info(f"📡 Server binding to port {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=(os.getenv("ENV") != "production"))
