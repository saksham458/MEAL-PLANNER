"""
Smart Meal Planner — Progress Tracking Pydantic Models
"""

from pydantic import BaseModel
from typing import Optional


class MacroProgress(BaseModel):
    """Macro-specific progress with consumed, target, and percentage."""
    consumed: float
    target: float
    percentage: float  # 0–100
    unit: str = "g"


class DailyProgressResponse(BaseModel):
    """Full daily progress breakdown for frontend rendering."""
    date: str
    calories: MacroProgress
    protein: MacroProgress
    carbs: MacroProgress
    fat: MacroProgress
    water_glasses: int = 0
    steps: int = 0
    meals_logged: int = 0
    total_meals: int = 0


class UpdateWaterRequest(BaseModel):
    """POST /api/progress/water — Update water intake."""
    glasses: int


class UpdateStepsRequest(BaseModel):
    """POST /api/progress/steps — Update step count."""
    steps: int
