"""
Smart Meal Planner — User Settings & Biometrics Routes
GET  /settings        — Retrieve user biometrics and calculated goals
PUT  /settings        — Update biometrics (automatically recalculates macros)
GET  /settings/profile — Full user profile with biometrics
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status

from database import get_db
from auth.jwt_handler import get_current_user
from users.models import BiometricsUpdate, BiometricsResponse, UserProfileResponse

logger = logging.getLogger("smartmeal.users")
router = APIRouter(prefix="/settings", tags=["User Settings"])


def calculate_macros(
    gender: str, age: int, height_cm: int, weight_kg: float,
    activity_level: str, dietary_goal: str
) -> dict:
    """
    Calculate daily macro targets using the Mifflin-St Jeor equation.

    BMR:
      Male:   10 × weight(kg) + 6.25 × height(cm) − 5 × age + 5
      Female: 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161

    TDEE = BMR × activity_multiplier
    Then split by dietary goal:
      - lose_weight:   cal × 0.8, protein 35%, carbs 35%, fat 30%
      - maintain:      cal × 1.0, protein 30%, carbs 40%, fat 30%
      - build_muscle:  cal × 1.1, protein 35%, carbs 40%, fat 25%
      - high_protein:  cal × 1.0, protein 40%, carbs 35%, fat 25%
    """
    # Step 1: BMR
    if gender == "female":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5

    # Step 2: Activity multiplier
    multipliers = {
        "sedentary": 1.2,
        "moderate": 1.55,
        "active": 1.725,
        "athlete": 1.9,
    }
    tdee = bmr * multipliers.get(activity_level, 1.55)

    # Step 3: Goal adjustments
    goal_configs = {
        "lose_weight":  {"cal_mult": 0.8,  "protein_pct": 0.35, "carbs_pct": 0.35, "fat_pct": 0.30},
        "maintain":     {"cal_mult": 1.0,  "protein_pct": 0.30, "carbs_pct": 0.40, "fat_pct": 0.30},
        "build_muscle": {"cal_mult": 1.1,  "protein_pct": 0.35, "carbs_pct": 0.40, "fat_pct": 0.25},
        "high_protein": {"cal_mult": 1.0,  "protein_pct": 0.40, "carbs_pct": 0.35, "fat_pct": 0.25},
    }
    config = goal_configs.get(dietary_goal, goal_configs["maintain"])

    daily_cal = round(tdee * config["cal_mult"])
    protein_g = round((daily_cal * config["protein_pct"]) / 4)    # 4 cal/g
    carbs_g   = round((daily_cal * config["carbs_pct"]) / 4)      # 4 cal/g
    fat_g     = round((daily_cal * config["fat_pct"]) / 9)        # 9 cal/g

    return {
        "daily_calories": daily_cal,
        "daily_protein_g": protein_g,
        "daily_carbs_g": carbs_g,
        "daily_fat_g": fat_g,
    }


@router.get("", response_model=BiometricsResponse)
async def get_biometrics(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Retrieve the current user's biometric data and calculated macro targets."""
    user_id = int(user["sub"])

    async with db.cursor() as cur:
        await cur.execute(
            """
            SELECT user_id, gender, age, height_cm, weight_kg, activity_level,
                   dietary_goal, daily_calories, daily_protein_g, daily_carbs_g, daily_fat_g
            FROM user_biometrics WHERE user_id = %s
            """,
            (user_id,),
        )
        bio = await cur.fetchone()

    if not bio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Biometrics not found")

    return BiometricsResponse(**bio)


@router.put("", response_model=BiometricsResponse)
async def update_biometrics(
    body: BiometricsUpdate,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Update user biometrics and automatically recalculate daily macro targets.
    Only provided fields are updated — unset fields are left unchanged.
    """
    user_id = int(user["sub"])

    async with db.cursor() as cur:
        # Fetch current biometrics
        await cur.execute("SELECT * FROM user_biometrics WHERE user_id = %s", (user_id,))
        current = await cur.fetchone()

        if not current:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Biometrics not found")

        # Merge provided fields with current values
        updated = {
            "gender":         body.gender         or current["gender"],
            "age":            body.age            if body.age is not None else current["age"],
            "height_cm":      body.height_cm      if body.height_cm is not None else current["height_cm"],
            "weight_kg":      body.weight_kg      if body.weight_kg is not None else float(current["weight_kg"]),
            "activity_level": body.activity_level  or current["activity_level"],
            "dietary_goal":   body.dietary_goal    or current["dietary_goal"],
        }

        # Recalculate macros with new values
        macros = calculate_macros(
            updated["gender"], updated["age"], updated["height_cm"],
            updated["weight_kg"], updated["activity_level"], updated["dietary_goal"],
        )

        # Update database
        await cur.execute(
            """
            UPDATE user_biometrics SET
                gender = %s, age = %s, height_cm = %s, weight_kg = %s,
                activity_level = %s, dietary_goal = %s,
                daily_calories = %s, daily_protein_g = %s,
                daily_carbs_g = %s, daily_fat_g = %s
            WHERE user_id = %s
            """,
            (
                updated["gender"], updated["age"], updated["height_cm"],
                updated["weight_kg"], updated["activity_level"], updated["dietary_goal"],
                macros["daily_calories"], macros["daily_protein_g"],
                macros["daily_carbs_g"], macros["daily_fat_g"],
                user_id,
            ),
        )
        await db.commit()

        logger.info(f"Biometrics updated for user {user_id}: {macros}")

    return BiometricsResponse(
        user_id=user_id,
        **updated,
        **macros,
    )


@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Retrieve the full user profile including biometrics."""
    user_id = int(user["sub"])

    async with db.cursor() as cur:
        await cur.execute(
            "SELECT id, email, first_name, last_name FROM users WHERE id = %s",
            (user_id,),
        )
        user_data = await cur.fetchone()

        await cur.execute(
            """
            SELECT user_id, gender, age, height_cm, weight_kg, activity_level,
                   dietary_goal, daily_calories, daily_protein_g, daily_carbs_g, daily_fat_g
            FROM user_biometrics WHERE user_id = %s
            """,
            (user_id,),
        )
        bio = await cur.fetchone()

    if not user_data or not bio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return UserProfileResponse(
        id=user_data["id"],
        email=user_data["email"],
        first_name=user_data["first_name"],
        last_name=user_data["last_name"],
        biometrics=BiometricsResponse(**bio),
    )
