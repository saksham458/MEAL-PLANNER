"""
Smart Meal Planner — Meal Plan Routes
POST /api/meals/generate   — Generate a 7-day meal plan from Edamam
GET  /api/meals/plan        — Get the user's active weekly plan
POST /api/meals/swap        — Swap a meal in the current plan
POST /api/meals/log         — Log a meal as consumed
DELETE /api/meals/{meal_id} — Remove a meal from the plan
"""

import json
import logging
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status

from database import get_db
from auth.jwt_handler import get_current_user
from meals.models import (
    GeneratePlanRequest, SwapMealRequest, LogMealRequest,
    MealResponse, WeeklyPlanResponse,
    ProposedMeal, WeeklyPlanProposal, ConfirmPlanRequest,
)
from meals.edamam_service import edamam

logger = logging.getLogger("smartmeal.meals")
router = APIRouter(prefix="/api/meals", tags=["Meal Plans"])

# Meal type queries for Edamam — maps meal_type to search parameters
MEAL_QUERIES = {
    "breakfast": {"query": "healthy breakfast", "meal_type": "Breakfast", "max_cal": 500},
    "lunch":     {"query": "high protein lunch", "meal_type": "Lunch", "max_cal": 700},
    "dinner":    {"query": "lean dinner", "meal_type": "Dinner", "max_cal": 700},
    "snack":     {"query": "protein snack", "meal_type": "Snack", "max_cal": 300},
}

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


@router.post("/generate", response_model=WeeklyPlanResponse, status_code=status.HTTP_201_CREATED)
async def generate_plan(
    body: GeneratePlanRequest,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Generate a personalized 7-day meal plan.

    Steps:
    1. Fetch user biometrics to determine calorie and macro targets
    2. Archive any existing active plans
    3. Query Edamam API for breakfast, lunch, dinner, and snack recipes
    4. Save the plan and individual meals to the database
    5. Return the complete plan with all meals
    """
    user_id = int(user["sub"])

    async with db.cursor() as cur:
        # 1. Get user biometrics
        await cur.execute(
            "SELECT daily_calories, daily_protein_g FROM user_biometrics WHERE user_id = %s",
            (user_id,),
        )
        bio = await cur.fetchone()
        if not bio:
            raise HTTPException(status_code=404, detail="Please complete your biometric profile first")

        max_cal_per_meal = bio["daily_calories"] // 3  # Rough per-meal budget
        min_protein = bio["daily_protein_g"] // 4      # Minimum protein per meal

        # 2. Archive existing active plans
        await cur.execute(
            "UPDATE weekly_plans SET status = 'archived' WHERE user_id = %s AND status = 'active'",
            (user_id,),
        )

        # 3. Calculate week range (Monday to Sunday)
        today = date.today()
        monday = today - timedelta(days=today.weekday())
        sunday = monday + timedelta(days=6)

        # 4. Create the weekly plan record
        await cur.execute(
            """
            INSERT INTO weekly_plans (user_id, week_start, week_end, status)
            VALUES (%s, %s, %s, 'active')
            """,
            (user_id, monday, sunday),
        )
        await db.commit()
        plan_id = cur.lastrowid

        # 5. Fetch recipes from Edamam for each meal type
        all_meals = []
        total_cal = 0
        total_protein = 0

        for meal_type, config in MEAL_QUERIES.items():
            # Build search query incorporating user preferences
            query = config["query"]
            if body.dietary_preferences:
                query = f"{body.dietary_preferences} {query}"

            try:
                recipes = await edamam.search_recipes(
                    query=query,
                    meal_type=config["meal_type"],
                    max_calories=config["max_cal"],
                    min_protein=min_protein if meal_type != "snack" else None,
                    excluded_ingredients=body.excluded_ingredients or None,
                    count=7,  # Get 7 recipes (one per day)
                )
            except Exception as e:
                logger.error(f"Edamam search failed for {meal_type}: {e}")
                # Fallback: create placeholder meals when API fails
                recipes = _generate_fallback_meals(meal_type, 7)

            # 6. Assign one recipe per day
            for day_idx in range(7):
                recipe = recipes[day_idx % len(recipes)] if recipes else _fallback_meal(meal_type)

                ingredients_json = json.dumps(
                    recipe.get("ingredient_lines", recipe.get("ingredients", []))
                )

                await cur.execute(
                    """
                    INSERT INTO plan_meals
                        (plan_id, user_id, day_of_week, meal_type,
                         edamam_uri, recipe_label, recipe_image, recipe_url, recipe_yield,
                         calories, protein_g, carbs_g, fat_g, fiber_g, ingredients_json)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        plan_id, user_id, day_idx, meal_type,
                        recipe.get("edamam_uri", ""),
                        recipe.get("recipe_label", "Meal"),
                        recipe.get("recipe_image", ""),
                        recipe.get("recipe_url", ""),
                        recipe.get("recipe_yield", 4),
                        recipe.get("calories", 0),
                        recipe.get("protein_g", 0),
                        recipe.get("carbs_g", 0),
                        recipe.get("fat_g", 0),
                        recipe.get("fiber_g", 0),
                        ingredients_json,
                    ),
                )

                total_cal += recipe.get("calories", 0)
                total_protein += recipe.get("protein_g", 0)

                all_meals.append({
                    "id": cur.lastrowid,
                    "day_of_week": day_idx,
                    "meal_type": meal_type,
                    "recipe_label": recipe.get("recipe_label", "Meal"),
                    "recipe_image": recipe.get("recipe_image"),
                    "recipe_url": recipe.get("recipe_url"),
                    "calories": recipe.get("calories", 0),
                    "protein_g": recipe.get("protein_g", 0),
                    "carbs_g": recipe.get("carbs_g", 0),
                    "fat_g": recipe.get("fat_g", 0),
                    "is_logged": False,
                    "is_high_protein": recipe.get("protein_g", 0) >= 25,
                })

        # 7. Update plan totals
        await cur.execute(
            "UPDATE weekly_plans SET total_calories = %s, total_protein_g = %s WHERE id = %s",
            (total_cal, int(total_protein), plan_id),
        )
        await db.commit()

    logger.info(f"Generated 7-day plan #{plan_id} for user {user_id} ({len(all_meals)} meals)")

    return WeeklyPlanResponse(
        plan_id=plan_id,
        week_start=str(monday),
        week_end=str(sunday),
        status="active",
        total_calories=total_cal,
        total_protein_g=int(total_protein),
        meals=[MealResponse(**m) for m in all_meals],
    )


@router.post("/propose", response_model=WeeklyPlanProposal)
async def propose_plan(
    body: GeneratePlanRequest,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Generate a 7-day meal plan proposal entirely in memory.
    Does NOT save to the database.
    """
    user_id = int(user["sub"])

    async with db.cursor() as cur:
        # Get user biometrics
        await cur.execute(
            "SELECT daily_calories, daily_protein_g FROM user_biometrics WHERE user_id = %s",
            (user_id,),
        )
        bio = await cur.fetchone()
        if not bio:
            raise HTTPException(status_code=404, detail="Please complete your biometric profile first")

        max_cal = bio["daily_calories"] // 3
        min_protein = bio["daily_protein_g"] // 4

    all_meals = []

    for meal_type, config in MEAL_QUERIES.items():
        query = config["query"]
        if body.dietary_preferences:
            query = f"{body.dietary_preferences} {query}"

        try:
            recipes = await edamam.search_recipes(
                query=query,
                meal_type=config["meal_type"],
                max_calories=config["max_cal"],
                min_protein=min_protein if meal_type != "snack" else None,
                excluded_ingredients=body.excluded_ingredients or None,
                count=7,
            )
        except Exception as e:
            logger.error(f"Edamam search failed for {meal_type}: {e}")
            recipes = _generate_fallback_meals(meal_type, 7)

        for day_idx in range(7):
            recipe = recipes[day_idx % len(recipes)] if recipes else _fallback_meal(meal_type)

            ingredients_json = json.dumps(
                recipe.get("ingredient_lines", recipe.get("ingredients", []))
            )

            all_meals.append(ProposedMeal(
                temp_id=f"temp_{day_idx}_{meal_type}",
                day_of_week=day_idx,
                meal_type=meal_type,
                recipe_label=recipe.get("recipe_label", "Meal"),
                recipe_image=recipe.get("recipe_image", ""),
                recipe_url=recipe.get("recipe_url", ""),
                recipe_yield=recipe.get("recipe_yield", 4),
                calories=recipe.get("calories", 0),
                protein_g=recipe.get("protein_g", 0),
                carbs_g=recipe.get("carbs_g", 0),
                fat_g=recipe.get("fat_g", 0),
                fiber_g=recipe.get("fiber_g", 0),
                ingredients_json=ingredients_json,
                edamam_uri=recipe.get("edamam_uri", ""),
                is_high_protein=recipe.get("protein_g", 0) >= 25,
            ))

    return WeeklyPlanProposal(meals=all_meals)


@router.post("/confirm", response_model=WeeklyPlanResponse, status_code=status.HTTP_201_CREATED)
async def confirm_plan(
    body: ConfirmPlanRequest,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Accepts a finalized list of proposed meals and saves them to the DB.
    """
    user_id = int(user["sub"])
    
    if not body.meals:
        raise HTTPException(status_code=400, detail="Cannot save an empty meal plan.")

    async with db.cursor() as cur:
        try:
            # 1. Archive existing active plans
            await cur.execute(
                "UPDATE weekly_plans SET status = 'archived' WHERE user_id = %s AND status = 'active'",
                (user_id,),
            )

            today = date.today()
            monday = today - timedelta(days=today.weekday())
            sunday = monday + timedelta(days=6)

            # 2. Create the weekly plan record
            await cur.execute(
                """
                INSERT INTO weekly_plans (user_id, week_start, week_end, status)
                VALUES (%s, %s, %s, 'active')
                """,
                (user_id, monday, sunday),
            )
            
            # captured immediately after the relevant INSERT
            plan_id = cur.lastrowid
            
            if not plan_id:
                raise Exception("Failed to retrieve plan_id after insertion.")

            total_cal = 0
            total_protein = 0
            saved_meals = []

            # 3. Insert confirmed meals
            for meal in body.meals:
                await cur.execute(
                    """
                    INSERT INTO plan_meals
                        (plan_id, user_id, day_of_week, meal_type,
                         edamam_uri, recipe_label, recipe_image, recipe_url, recipe_yield,
                         calories, protein_g, carbs_g, fat_g, fiber_g, ingredients_json)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        plan_id, user_id, meal.day_of_week, meal.meal_type,
                        meal.edamam_uri, meal.recipe_label, meal.recipe_image, meal.recipe_url, meal.recipe_yield,
                        meal.calories, meal.protein_g, meal.carbs_g, meal.fat_g, meal.fiber_g, meal.ingredients_json,
                    ),
                )
                
                db_id = cur.lastrowid
                total_cal += meal.calories
                total_protein += meal.protein_g
                
                saved_meals.append(MealResponse(
                    id=db_id,
                    day_of_week=meal.day_of_week,
                    meal_type=meal.meal_type,
                    recipe_label=meal.recipe_label,
                    recipe_image=meal.recipe_image,
                    recipe_url=meal.recipe_url,
                    calories=meal.calories,
                    protein_g=meal.protein_g,
                    carbs_g=meal.carbs_g,
                    fat_g=meal.fat_g,
                    is_logged=False,
                    is_high_protein=meal.is_high_protein
                ))

            # 4. Update plan totals based on confirmed meals
            await cur.execute(
                "UPDATE weekly_plans SET total_calories = %s, total_protein_g = %s WHERE id = %s",
                (total_cal, int(total_protein), plan_id),
            )
            
            # Single commit at the end for all operations if autocommit was off, 
            # though it's True in pool config, calling it here ensures consistency.
            await db.commit()

            logger.info(f"Confirmed 7-day plan #{plan_id} for user {user_id} ({len(saved_meals)} meals)")

            return WeeklyPlanResponse(
                plan_id=plan_id,
                week_start=str(monday),
                week_end=str(sunday),
                status="active",
                total_calories=total_cal,
                total_protein_g=int(total_protein),
                meals=saved_meals,
            )
        except Exception as e:
            logger.error(f"Failed to confirm meal plan for user {user_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error during confirmation: {str(e)}"
            )


@router.get("/plan", response_model=WeeklyPlanResponse)
async def get_active_plan(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Retrieve the user's currently active weekly meal plan."""
    user_id = int(user["sub"])

    async with db.cursor() as cur:
        await cur.execute(
            "SELECT * FROM weekly_plans WHERE user_id = %s AND status = 'active' ORDER BY created_at DESC LIMIT 1",
            (user_id,),
        )
        plan = await cur.fetchone()
        if not plan:
            raise HTTPException(status_code=404, detail="No active meal plan found. Generate one first!")

        await cur.execute(
            """
            SELECT id, day_of_week, meal_type, recipe_label, recipe_image, recipe_url,
                   calories, protein_g, carbs_g, fat_g, is_logged
            FROM plan_meals WHERE plan_id = %s ORDER BY day_of_week, FIELD(meal_type, 'breakfast', 'lunch', 'dinner', 'snack')
            """,
            (plan["id"],),
        )
        meals = await cur.fetchall()

    meal_list = [
        MealResponse(
            **m,
            is_high_protein=float(m["protein_g"]) >= 25,
        )
        for m in meals
    ]

    return WeeklyPlanResponse(
        plan_id=plan["id"],
        week_start=str(plan["week_start"]),
        week_end=str(plan["week_end"]),
        status=plan["status"],
        total_calories=plan["total_calories"],
        total_protein_g=plan["total_protein_g"],
        meals=meal_list,
    )


@router.post("/swap", response_model=MealResponse)
async def swap_meal(body: SwapMealRequest, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """
    Swap a meal in the current plan with a new recipe from Edamam.
    Keeps the same day_of_week and meal_type but replaces the recipe.
    """
    user_id = int(user["sub"])

    async with db.cursor() as cur:
        # Get the existing meal
        await cur.execute(
            "SELECT * FROM plan_meals WHERE id = %s AND user_id = %s",
            (body.meal_id, user_id),
        )
        old_meal = await cur.fetchone()
        if not old_meal:
            raise HTTPException(status_code=404, detail="Meal not found")

        # Search for a replacement
        query = body.new_query or f"healthy {old_meal['meal_type']} recipe"
        config = MEAL_QUERIES.get(old_meal["meal_type"], MEAL_QUERIES["lunch"])

        try:
            recipes = await edamam.search_recipes(
                query=query,
                meal_type=config["meal_type"],
                max_calories=config["max_cal"],
                count=3,
            )
        except Exception:
            recipes = _generate_fallback_meals(old_meal["meal_type"], 1)

        if not recipes:
            raise HTTPException(status_code=404, detail="No replacement recipes found")

        new_recipe = recipes[0]
        ingredients_json = json.dumps(
            new_recipe.get("ingredient_lines", new_recipe.get("ingredients", []))
        )

        # Update the meal in the database
        await cur.execute(
            """
            UPDATE plan_meals SET
                edamam_uri = %s, recipe_label = %s, recipe_image = %s,
                recipe_url = %s, recipe_yield = %s,
                calories = %s, protein_g = %s, carbs_g = %s, fat_g = %s,
                fiber_g = %s, ingredients_json = %s, is_logged = FALSE
            WHERE id = %s
            """,
            (
                new_recipe.get("edamam_uri", ""),
                new_recipe["recipe_label"],
                new_recipe.get("recipe_image", ""),
                new_recipe.get("recipe_url", ""),
                new_recipe.get("recipe_yield", 4),
                new_recipe.get("calories", 0),
                new_recipe.get("protein_g", 0),
                new_recipe.get("carbs_g", 0),
                new_recipe.get("fat_g", 0),
                new_recipe.get("fiber_g", 0),
                ingredients_json,
                body.meal_id,
            ),
        )
        await db.commit()

    logger.info(f"Swapped meal #{body.meal_id} → {new_recipe['recipe_label']}")

    return MealResponse(
        id=body.meal_id,
        day_of_week=old_meal["day_of_week"],
        meal_type=old_meal["meal_type"],
        recipe_label=new_recipe["recipe_label"],
        recipe_image=new_recipe.get("recipe_image"),
        recipe_url=new_recipe.get("recipe_url"),
        calories=new_recipe.get("calories", 0),
        protein_g=new_recipe.get("protein_g", 0),
        carbs_g=new_recipe.get("carbs_g", 0),
        fat_g=new_recipe.get("fat_g", 0),
        is_logged=False,
        is_high_protein=new_recipe.get("protein_g", 0) >= 25,
    )


@router.post("/log")
async def log_meal(body: LogMealRequest, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Mark a meal as consumed and update daily progress."""
    user_id = int(user["sub"])
    today = date.today()

    async with db.cursor() as cur:
        # Get meal data
        await cur.execute(
            "SELECT * FROM plan_meals WHERE id = %s AND user_id = %s",
            (body.meal_id, user_id),
        )
        meal = await cur.fetchone()
        if not meal:
            raise HTTPException(status_code=404, detail="Meal not found")

        # Toggle logged state
        new_state = not meal["is_logged"]
        await cur.execute(
            "UPDATE plan_meals SET is_logged = %s WHERE id = %s",
            (new_state, body.meal_id),
        )

        # Update or create daily progress entry
        await cur.execute(
            "SELECT id FROM daily_progress WHERE user_id = %s AND log_date = %s",
            (user_id, today),
        )
        progress = await cur.fetchone()

        cal_delta = meal["calories"] if new_state else -meal["calories"]
        protein_delta = float(meal["protein_g"]) if new_state else -float(meal["protein_g"])
        carbs_delta = float(meal["carbs_g"]) if new_state else -float(meal["carbs_g"])
        fat_delta = float(meal["fat_g"]) if new_state else -float(meal["fat_g"])

        if progress:
            await cur.execute(
                """
                UPDATE daily_progress SET
                    consumed_calories = GREATEST(0, consumed_calories + %s),
                    consumed_protein_g = GREATEST(0, consumed_protein_g + %s),
                    consumed_carbs_g = GREATEST(0, consumed_carbs_g + %s),
                    consumed_fat_g = GREATEST(0, consumed_fat_g + %s)
                WHERE id = %s
                """,
                (cal_delta, protein_delta, carbs_delta, fat_delta, progress["id"]),
            )
        else:
            # Fetch current targets
            await cur.execute(
                "SELECT daily_calories, daily_protein_g, daily_carbs_g, daily_fat_g FROM user_biometrics WHERE user_id = %s",
                (user_id,),
            )
            bio = await cur.fetchone()

            await cur.execute(
                """
                INSERT INTO daily_progress
                    (user_id, log_date, consumed_calories, consumed_protein_g, consumed_carbs_g, consumed_fat_g,
                     target_calories, target_protein_g, target_carbs_g, target_fat_g)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    user_id, today,
                    max(0, meal["calories"]) if new_state else 0,
                    max(0, float(meal["protein_g"])) if new_state else 0,
                    max(0, float(meal["carbs_g"])) if new_state else 0,
                    max(0, float(meal["fat_g"])) if new_state else 0,
                    bio["daily_calories"], bio["daily_protein_g"],
                    bio["daily_carbs_g"], bio["daily_fat_g"],
                ),
            )

        await db.commit()

    return {"message": f"Meal {'logged' if new_state else 'unlogged'}", "is_logged": new_state}


@router.delete("/{meal_id}")
async def delete_meal(meal_id: int, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Remove a specific meal from the user's plan."""
    user_id = int(user["sub"])

    async with db.cursor() as cur:
        await cur.execute(
            "DELETE FROM plan_meals WHERE id = %s AND user_id = %s",
            (meal_id, user_id),
        )
        await db.commit()

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Meal not found")

    return {"message": "Meal deleted", "meal_id": meal_id}


# ── Fallback Meals (when Edamam API is unavailable) ───────────
def _fallback_meal(meal_type: str) -> dict:
    """Returns a single placeholder meal when API fails."""
    fallbacks = {
        "breakfast": {"recipe_label": "Oatmeal with Berries", "calories": 320, "protein_g": 12, "carbs_g": 52, "fat_g": 8},
        "lunch":     {"recipe_label": "Grilled Chicken Salad", "calories": 480, "protein_g": 42, "carbs_g": 22, "fat_g": 18},
        "dinner":    {"recipe_label": "Salmon with Vegetables", "calories": 520, "protein_g": 38, "carbs_g": 28, "fat_g": 22},
        "snack":     {"recipe_label": "Greek Yogurt & Almonds", "calories": 200, "protein_g": 15, "carbs_g": 18, "fat_g": 8},
    }
    base = fallbacks.get(meal_type, fallbacks["lunch"])
    base.update({
        "edamam_uri": f"placeholder:{meal_type}",
        "recipe_image": "",
        "recipe_url": "",
        "recipe_yield": 1,
        "fiber_g": 4,
        "ingredient_lines": ["Placeholder ingredients"],
        "ingredients": [],
    })
    return base


def _generate_fallback_meals(meal_type: str, count: int) -> list[dict]:
    """Generate multiple fallback meals."""
    return [_fallback_meal(meal_type) for _ in range(count)]
