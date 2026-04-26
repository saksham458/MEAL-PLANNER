"""
Smart Meal Planner — Grocery List Pydantic Models
"""

from pydantic import BaseModel
from typing import Optional


class GroceryItemResponse(BaseModel):
    """Single grocery item in the sorted list."""
    name: str
    category: str
    weight_g: float
    aisle: str


class AisleGroup(BaseModel):
    """A group of items in the same supermarket aisle."""
    name: str
    emoji: str
    items: list[GroceryItemResponse]


class GroceryListResponse(BaseModel):
    """Full grocery list response sorted by aisle."""
    aisles: list[AisleGroup]
    total_items: int
    sort_time_ms: float
    engine: str  # "c" or "python"
    plan_id: Optional[int] = None
    week: Optional[str] = None
