"""
Smart Meal Planner — Notification Service
Manages notification creation, storage, and broadcasting to connected WebSocket clients.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from database import execute_query

logger = logging.getLogger("smartmeal.notifications")


class NotificationService:
    """
    Centralized notification management service.

    Responsibilities:
    - Create and persist notifications to MySQL
    - Broadcast real-time alerts to connected WebSocket clients
    - Manage the active WebSocket connections registry
    """

    def __init__(self):
        # Map of user_id -> set of WebSocket connections
        self._connections: dict[int, set] = {}

    def register(self, user_id: int, websocket):
        """Register a WebSocket connection for a user."""
        if user_id not in self._connections:
            self._connections[user_id] = set()
        self._connections[user_id].add(websocket)
        logger.info(f"📡 WS connected: user {user_id} ({len(self._connections[user_id])} connections)")

    def unregister(self, user_id: int, websocket):
        """Remove a WebSocket connection for a user."""
        if user_id in self._connections:
            self._connections[user_id].discard(websocket)
            if not self._connections[user_id]:
                del self._connections[user_id]
            logger.info(f"📡 WS disconnected: user {user_id}")

    async def send_notification(
        self,
        user_id: int,
        notif_type: str,
        title: str,
        message: str,
        icon: str = "🔔",
        persist: bool = True,
    ):
        """
        Create a notification and push it to the user in real-time.

        Args:
            user_id:    Target user
            notif_type: One of: meal_reminder, goal_achieved, grocery_ready,
                        plan_generated, weekly_summary, system
            title:      Notification title
            message:    Notification body
            icon:       Emoji icon
            persist:    If True, save to database for later retrieval
        """
        notification = {
            "type": notif_type,
            "title": title,
            "message": message,
            "icon": icon,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "is_read": False,
        }

        # Persist to database
        if persist:
            try:
                notif_id = await execute_query(
                    """
                    INSERT INTO notifications (user_id, type, title, message, icon)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (user_id, notif_type, title, message, icon),
                )
                notification["id"] = notif_id
            except Exception as e:
                logger.error(f"Failed to persist notification: {e}")

        # Push to connected WebSocket clients
        await self._broadcast(user_id, notification)

    async def _broadcast(self, user_id: int, data: dict):
        """Push a JSON message to all connected WebSocket clients for a user."""
        connections = self._connections.get(user_id, set())
        if not connections:
            return

        message = json.dumps(data)
        dead_connections = set()

        for ws in connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead_connections.add(ws)

        # Clean up dead connections
        for ws in dead_connections:
            self.unregister(user_id, ws)

    async def get_unread_count(self, user_id: int) -> int:
        """Get the count of unread notifications for a user."""
        try:
            result = await execute_query(
                "SELECT COUNT(*) as count FROM notifications WHERE user_id = %s AND is_read = FALSE",
                (user_id,),
                fetch_one=True,
            )
            return result["count"] if result else 0
        except Exception:
            return 0

    # ── Pre-built Notification Templates ─────────────────────

    async def notify_goal_achieved(self, user_id: int, macro: str, amount: float):
        """Send a goal achievement notification."""
        await self.send_notification(
            user_id=user_id,
            notif_type="goal_achieved",
            title=f"🎯 {macro} Goal Reached!",
            message=f"Amazing! You just hit your {amount}g {macro.lower()} goal for today!",
            icon="🎯",
        )

    async def notify_plan_generated(self, user_id: int, meals_count: int):
        """Send a plan generation notification."""
        await self.send_notification(
            user_id=user_id,
            notif_type="plan_generated",
            title="✨ New Meal Plan Ready!",
            message=f"Your personalized 7-day plan with {meals_count} meals is ready to go!",
            icon="✨",
        )

    async def notify_grocery_ready(self, user_id: int, items_count: int, sort_time_ms: float):
        """Send a grocery list sorted notification."""
        await self.send_notification(
            user_id=user_id,
            notif_type="grocery_ready",
            title="🛒 Grocery List Sorted!",
            message=f"Your {items_count} items are sorted by aisle in {sort_time_ms}ms. Ready for the store!",
            icon="🛒",
        )

    async def notify_meal_reminder(self, user_id: int, meal_type: str, meal_name: str):
        """Send a meal preparation reminder."""
        await self.send_notification(
            user_id=user_id,
            notif_type="meal_reminder",
            title=f"🍽️ Time for {meal_type.title()}!",
            message=f"Time to prep your {meal_name}. Don't forget to log it when you're done!",
            icon="🍽️",
        )


# Module-level singleton
notification_service = NotificationService()
