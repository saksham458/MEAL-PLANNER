"""
Smart Meal Planner — WebSocket Notifications Endpoint
Provides real-time push notifications via WebSocket at /ws/notifications

Protocol:
1. Client connects with JWT token as query parameter: /ws/notifications?token=<jwt>
2. Server authenticates the token and registers the connection
3. Server pushes JSON notification objects as they occur
4. Client can send JSON commands (e.g., mark notification as read)
"""

import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from auth.jwt_handler import decode_access_token
from notifications.service import notification_service
from database import execute_query

logger = logging.getLogger("smartmeal.websocket")
router = APIRouter(tags=["Notifications"])


@router.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket endpoint for real-time notifications.

    Connection: ws://host/ws/notifications?token=<jwt_token>

    Incoming messages (from client):
        {"action": "mark_read", "notification_id": 123}
        {"action": "mark_all_read"}
        {"action": "ping"}

    Outgoing messages (from server):
        {
            "type": "goal_achieved",
            "title": "🎯 Protein Goal Reached!",
            "message": "...",
            "icon": "🎯",
            "timestamp": "2026-04-15T18:00:00Z",
            "is_read": false
        }
    """
    # Authenticate the WebSocket connection
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except Exception:
        await websocket.close(code=4001, reason="Invalid authentication token")
        return

    # Accept the connection
    await websocket.accept()
    notification_service.register(user_id, websocket)

    # Send initial unread count
    try:
        unread = await notification_service.get_unread_count(user_id)
        await websocket.send_json({
            "type": "init",
            "unread_count": unread,
            "message": "Connected to notification service",
        })
    except Exception:
        pass

    # Listen for client messages
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                action = data.get("action")

                if action == "mark_read":
                    notif_id = data.get("notification_id")
                    if notif_id:
                        await execute_query(
                            "UPDATE notifications SET is_read = TRUE WHERE id = %s AND user_id = %s",
                            (notif_id, user_id),
                        )
                        await websocket.send_json({"type": "ack", "action": "mark_read", "id": notif_id})

                elif action == "mark_all_read":
                    await execute_query(
                        "UPDATE notifications SET is_read = TRUE WHERE user_id = %s AND is_read = FALSE",
                        (user_id,),
                    )
                    await websocket.send_json({"type": "ack", "action": "mark_all_read"})

                elif action == "ping":
                    await websocket.send_json({"type": "pong"})

                elif action == "get_history":
                    # Return recent notifications
                    limit = data.get("limit", 20)
                    notifications = await execute_query(
                        """
                        SELECT id, type, title, message, icon, is_read, created_at
                        FROM notifications WHERE user_id = %s
                        ORDER BY created_at DESC LIMIT %s
                        """,
                        (user_id, limit),
                    )
                    await websocket.send_json({
                        "type": "history",
                        "notifications": [
                            {
                                "id": n["id"],
                                "type": n["type"],
                                "title": n["title"],
                                "message": n["message"],
                                "icon": n["icon"],
                                "is_read": bool(n["is_read"]),
                                "timestamp": str(n["created_at"]),
                            }
                            for n in (notifications or [])
                        ],
                    })

            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})

    except WebSocketDisconnect:
        notification_service.unregister(user_id, websocket)
        logger.info(f"WebSocket disconnected: user {user_id}")
    except Exception as e:
        notification_service.unregister(user_id, websocket)
        logger.error(f"WebSocket error for user {user_id}: {e}")


# ── HTTP Endpoints for Notification History ──────────────────

@router.get("/api/notifications")
async def get_notifications(
    limit: int = 20,
    user_id: int = None,
):
    """
    HTTP fallback for getting notification history (for polling-based clients).
    In production, use the WebSocket endpoint for real-time updates.
    """
    if not user_id:
        return {"notifications": [], "unread_count": 0}

    notifications = await execute_query(
        """
        SELECT id, type, title, message, icon, is_read, created_at
        FROM notifications WHERE user_id = %s ORDER BY created_at DESC LIMIT %s
        """,
        (user_id, limit),
    )

    unread = await notification_service.get_unread_count(user_id)

    return {
        "notifications": [
            {
                "id": n["id"],
                "type": n["type"],
                "title": n["title"],
                "message": n["message"],
                "icon": n["icon"],
                "is_read": bool(n["is_read"]),
                "timestamp": str(n["created_at"]),
            }
            for n in (notifications or [])
        ],
        "unread_count": unread,
    }
