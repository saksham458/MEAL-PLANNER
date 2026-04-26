"""
Smart Meal Planner — Progress Tracking Routes
GET  /api/progress/today  — Get today's macro progress vs goals (percentages)
POST /api/progress/water  — Update water intake
POST /api/progress/steps  — Update step count
"""

import logging
from datetime import date
from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from auth.jwt_handler import get_current_user
from progress.models import (
    DailyProgressResponse, MacroProgress, UpdateWaterRequest, UpdateStepsRequest,
)

logger = logging.getLogger("smartmeal.progress")
router = APIRouter(prefix="/api/progress", tags=["Progress Tracking"])


@router.get("/today", response_model=DailyProgressResponse)
async def get_today_progress(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """
    Calculate the user's consumed macros vs their dynamic biometric goals.
    Returns exact percentages for each macro (Protein, Carbs, Fat, Calories)
    for the frontend to render progress rings and bars.

    If no progress entry exists for today, returns zero consumed with full targets.
    """
    user_id = int(user["sub"])
    today = date.today()

    async with db.cursor() as cur:
        # Get today's progress (may not exist yet)
        await cur.execute(
            """
            SELECT consumed_calories, consumed_protein_g, consumed_carbs_g, consumed_fat_g,
                   target_calories, target_protein_g, target_carbs_g, target_fat_g,
                   water_glasses, steps
            FROM daily_progress
            WHERE user_id = %s AND log_date = %s
            """,
            (user_id, today),
        )
        progress = await cur.fetchone()

        # Get current biometric goals (in case of no progress entry)
        await cur.execute(
            "SELECT daily_calories, daily_protein_g, daily_carbs_g, daily_fat_g FROM user_biometrics WHERE user_id = %s",
            (user_id,),
        )
        bio = await cur.fetchone()
        if not bio:
            raise HTTPException(status_code=404, detail="Complete your biometric profile first")

        # Count meals logged today
        await cur.execute(
            """
            SELECT COUNT(*) as logged, (
                SELECT COUNT(*) FROM plan_meals pm
                JOIN weekly_plans wp ON pm.plan_id = wp.id
                WHERE wp.user_id = %s AND wp.status = 'active'
                AND pm.day_of_week = WEEKDAY(%s)
            ) as total
            FROM plan_meals pm
            JOIN weekly_plans wp ON pm.plan_id = wp.id
            WHERE wp.user_id = %s AND wp.status = 'active'
            AND pm.day_of_week = WEEKDAY(%s) AND pm.is_logged = TRUE
            """,
            (user_id, today, user_id, today),
        )
        meal_counts = await cur.fetchone()

    # Build response
    if progress:
        consumed_cal = progress["consumed_calories"]
        consumed_p = float(progress["consumed_protein_g"])
        consumed_c = float(progress["consumed_carbs_g"])
        consumed_f = float(progress["consumed_fat_g"])
        target_cal = progress["target_calories"]
        target_p = progress["target_protein_g"]
        target_c = progress["target_carbs_g"]
        target_f = progress["target_fat_g"]
        water = progress["water_glasses"]
        steps = progress["steps"]
    else:
        consumed_cal = consumed_p = consumed_c = consumed_f = 0
        target_cal = bio["daily_calories"]
        target_p = bio["daily_protein_g"]
        target_c = bio["daily_carbs_g"]
        target_f = bio["daily_fat_g"]
        water = 0
        steps = 0

    def pct(consumed, target):
        return round(min((consumed / target) * 100, 100), 1) if target > 0 else 0.0

    return DailyProgressResponse(
        date=str(today),
        calories=MacroProgress(
            consumed=consumed_cal, target=target_cal,
            percentage=pct(consumed_cal, target_cal), unit="kcal",
        ),
        protein=MacroProgress(
            consumed=consumed_p, target=target_p,
            percentage=pct(consumed_p, target_p),
        ),
        carbs=MacroProgress(
            consumed=consumed_c, target=target_c,
            percentage=pct(consumed_c, target_c),
        ),
        fat=MacroProgress(
            consumed=consumed_f, target=target_f,
            percentage=pct(consumed_f, target_f),
        ),
        water_glasses=water,
        steps=steps,
        meals_logged=meal_counts["logged"] if meal_counts else 0,
        total_meals=meal_counts["total"] if meal_counts else 0,
    )


@router.post("/water")
async def update_water(body: UpdateWaterRequest, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Update today's water intake (glasses)."""
    user_id = int(user["sub"])
    today = date.today()

    async with db.cursor() as cur:
        await cur.execute(
            "SELECT id FROM daily_progress WHERE user_id = %s AND log_date = %s",
            (user_id, today),
        )
        existing = await cur.fetchone()

        if existing:
            await cur.execute(
                "UPDATE daily_progress SET water_glasses = %s WHERE id = %s",
                (body.glasses, existing["id"]),
            )
        else:
            await cur.execute(
                "SELECT daily_calories, daily_protein_g, daily_carbs_g, daily_fat_g FROM user_biometrics WHERE user_id = %s",
                (user_id,),
            )
            bio = await cur.fetchone()
            await cur.execute(
                """
                INSERT INTO daily_progress (user_id, log_date, water_glasses,
                    target_calories, target_protein_g, target_carbs_g, target_fat_g)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, today, body.glasses,
                 bio["daily_calories"], bio["daily_protein_g"],
                 bio["daily_carbs_g"], bio["daily_fat_g"]),
            )
        await db.commit()

    return {"message": f"Water updated to {body.glasses} glasses", "glasses": body.glasses}


@router.post("/steps")
async def update_steps(body: UpdateStepsRequest, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Update today's step count."""
    user_id = int(user["sub"])
    today = date.today()

    async with db.cursor() as cur:
        await cur.execute(
            "SELECT id FROM daily_progress WHERE user_id = %s AND log_date = %s",
            (user_id, today),
        )
        existing = await cur.fetchone()

        if existing:
            await cur.execute(
                "UPDATE daily_progress SET steps = %s WHERE id = %s",
                (body.steps, existing["id"]),
            )
        else:
            await cur.execute(
                "SELECT daily_calories, daily_protein_g, daily_carbs_g, daily_fat_g FROM user_biometrics WHERE user_id = %s",
                (user_id,),
            )
            bio = await cur.fetchone()
            await cur.execute(
                """
                INSERT INTO daily_progress (user_id, log_date, steps,
                    target_calories, target_protein_g, target_carbs_g, target_fat_g)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, today, body.steps,
                 bio["daily_calories"], bio["daily_protein_g"],
                 bio["daily_carbs_g"], bio["daily_fat_g"]),
            )
        await db.commit()

    return {"message": f"Steps updated to {body.steps}", "steps": body.steps}
