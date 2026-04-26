"""
Smart Meal Planner — Meal Plan Pydantic Models
"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class MealTypeEnum(str, Enum):
    breakfast = "breakfast"
    lunch = "lunch"
    dinner = "dinner"
    snack = "snack"


class GeneratePlanRequest(BaseModel):
    """POST /api/meals/generate — Generate a new 7-day meal plan."""
    dietary_preferences: Optional[str] = Field(
        None,
        description="Free-text dietary preferences (e.g., 'high protein, no dairy')",
    )
    excluded_ingredients: Optional[list[str]] = Field(
        default_factory=list,
        description="Ingredients to exclude from recipes",
    )


class SwapMealRequest(BaseModel):
    """POST /api/meals/swap — Swap a meal in the current plan."""
    meal_id: int = Field(..., description="ID of the meal to swap out")
    new_query: Optional[str] = Field(None, description="Search query for the replacement meal")


class LogMealRequest(BaseModel):
    """POST /api/meals/log — Mark a meal as consumed."""
    meal_id: int


class MealResponse(BaseModel):
    """Single meal data returned to frontend."""
    id: int
    day_of_week: int
    meal_type: str
    recipe_label: str
    recipe_image: Optional[str]
    recipe_url: Optional[str]
    calories: int
    protein_g: float
    carbs_g: float
    fat_g: float
    is_logged: bool
    is_high_protein: bool = False


class WeeklyPlanResponse(BaseModel):
    """Full weekly plan response with all meals."""
    plan_id: int
    week_start: str
    week_end: str
    status: str
    total_calories: int
    total_protein_g: int
    meals: list[MealResponse]


class ProposedMeal(BaseModel):
    """In-memory meal proposed to the user but not yet saved to DB."""
    temp_id: str
    day_of_week: int
    meal_type: str
    recipe_label: str
    recipe_image: Optional[str]
    recipe_url: Optional[str]
    recipe_yield: int
    calories: int
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float
    ingredients_json: str
    edamam_uri: str
    is_high_protein: bool = False


class WeeklyPlanProposal(BaseModel):
    """Full proposed unconfirmed plan returned to frontend."""
    meals: list[ProposedMeal]


class ConfirmPlanRequest(BaseModel):
    """Payload to confirm the final selected meals to save to DB."""
    meals: list[ProposedMeal]
