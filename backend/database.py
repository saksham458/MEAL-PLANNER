"""
Smart Meal Planner — Async MySQL Database Pool
Uses aiomysql for non-blocking database operations matching FastAPI's async model.
"""

import os
import aiomysql
import logging
from config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_POOL_SIZE

logger = logging.getLogger("smartmeal.db")

# Global connection pool
_pool: aiomysql.Pool | None = None


async def init_db_pool():
    """
    Initialize the global MySQL connection pool.
    Falls back gracefully if the database is unavailable.
    """
    global _pool
    demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"
    
    try:
        _pool = await aiomysql.create_pool(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            db=DB_NAME,
            minsize=2,
            maxsize=DB_POOL_SIZE,
            autocommit=True,
            charset="utf8mb4",
            cursorclass=aiomysql.DictCursor,
        )
        logger.info(f"✅ MySQL pool created: {DB_HOST}:{DB_PORT}/{DB_NAME}")
    except Exception as e:
        if demo_mode:
            logger.warning(f"⚠️ Database unavailable: {e}. Running in DEMO_MODE (No persistence).")
        else:
            logger.error(f"❌ Failed to create MySQL pool: {e}")
            logger.info("💡 Tip: Ensure MySQL is running or set DEMO_MODE=true in .env for UI preview.")
            raise


async def close_db_pool():
    """Close the connection pool on application shutdown."""
    global _pool
    if _pool:
        _pool.close()
        await _pool.wait_closed()
        logger.info("🔌 MySQL pool closed")


async def get_db():
    """
    FastAPI dependency that yields a database connection from the pool.
    Automatically returns the connection when the request is done.

    Usage in routes:
        @router.get("/example")
        async def example(db = Depends(get_db)):
            async with db.cursor() as cur:
                await cur.execute("SELECT * FROM users")
                return await cur.fetchall()
    """
    global _pool
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_db_pool() first.")

    async with _pool.acquire() as conn:
        yield conn


async def execute_query(query: str, params: tuple = None, fetch_one: bool = False):
    """
    Utility function for simple queries outside of route dependencies.
    Returns fetched results or lastrowid for INSERT operations.
    """
    global _pool
    if _pool is None:
        raise RuntimeError("Database pool not initialized.")

    async with _pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, params)
            if query.strip().upper().startswith("SELECT"):
                if fetch_one:
                    return await cur.fetchone()
                return await cur.fetchall()
            await conn.commit()
            return cur.lastrowid
