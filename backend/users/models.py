"""
Smart Meal Planner — User/Settings Pydantic Models
"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class GenderEnum(str, Enum):
    male = "male"
    female = "female"
    other = "other"


class ActivityLevelEnum(str, Enum):
    sedentary = "sedentary"
    moderate = "moderate"
    active = "active"
    athlete = "athlete"


class DietaryGoalEnum(str, Enum):
    lose_weight = "lose_weight"
    maintain = "maintain"
    build_muscle = "build_muscle"
    high_protein = "high_protein"


class BiometricsUpdate(BaseModel):
    """PUT /settings — Update user biometrics."""
    gender: Optional[GenderEnum] = None
    age: Optional[int] = Field(None, ge=16, le=100)
    height_cm: Optional[int] = Field(None, ge=100, le=250)
    weight_kg: Optional[float] = Field(None, ge=30.0, le=250.0)
    activity_level: Optional[ActivityLevelEnum] = None
    dietary_goal: Optional[DietaryGoalEnum] = None


class BiometricsResponse(BaseModel):
    """Full biometrics data returned from GET /settings."""
    user_id: int
    gender: str
    age: int
    height_cm: int
    weight_kg: float
    activity_level: str
    dietary_goal: str
    daily_calories: int
    daily_protein_g: int
    daily_carbs_g: int
    daily_fat_g: int


class UserProfileResponse(BaseModel):
    """Combined user profile + biometrics."""
    id: int
    email: str
    first_name: str
    last_name: str
    biometrics: BiometricsResponse
