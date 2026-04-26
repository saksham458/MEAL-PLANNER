"""
Smart Meal Planner — Grocery List Routes
GET /api/grocery-list — Aggregate ingredients from the weekly plan and sort by aisle via C engine
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from auth.jwt_handler import get_current_user
from grocery.c_bridge import sorter
from grocery.models import GroceryListResponse
from pydantic import BaseModel

class SaveCartRequest(BaseModel):
    cart_json: list[str]

logger = logging.getLogger("smartmeal.grocery")
router = APIRouter(prefix="/api", tags=["Grocery List"])


@router.get("/grocery-list", response_model=GroceryListResponse)
async def get_grocery_list(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """
    Generate a sorted grocery list from the user's active weekly meal plan.

    Process:
    1. Fetch the active weekly plan for the user
    2. Extract all ingredient data from plan_meals (JSON column)
    3. De-duplicate ingredients by name (consolidate quantities)
    4. Pass the full ingredient array to the C sorting engine
    5. Return the sorted, aisle-organized grocery list

    The C engine classifies each ingredient into a supermarket aisle
    (Produce, Meat, Dairy, Grains, Pantry) and sorts using a
    multi-key comparator — primary by aisle, secondary alphabetical.
    """
    user_id = int(user["sub"])

    async with db.cursor() as cur:
        # 1. Get the active weekly plan
        await cur.execute(
            """
            SELECT id, week_start, week_end
            FROM weekly_plans
            WHERE user_id = %s AND status = 'active'
            ORDER BY created_at DESC LIMIT 1
            """,
            (user_id,),
        )
        plan = await cur.fetchone()
        if not plan:
            raise HTTPException(
                status_code=404,
                detail="No active meal plan found. Generate a plan first!",
            )

        # 2. Fetch all meals and their ingredients
        await cur.execute(
            "SELECT ingredients_json FROM plan_meals WHERE plan_id = %s",
            (plan["id"],),
        )
        meals = await cur.fetchall()

    # 3. Extract and de-duplicate ingredients
    ingredient_map = {}  # name -> consolidated ingredient dict

    for meal in meals:
        raw = meal.get("ingredients_json")
        if not raw:
            continue

        try:
            ingredients = json.loads(raw) if isinstance(raw, str) else raw
        except (json.JSONDecodeError, TypeError):
            continue

        # Handle both structured (Edamam) and plain-text ingredient formats
        if isinstance(ingredients, list):
            for ing in ingredients:
                if isinstance(ing, dict):
                    # Structured Edamam ingredient
                    name = ing.get("food", ing.get("text", "Unknown")).strip()
                    food_cat = ing.get("food_category", "Unknown")
                    weight = float(ing.get("weight_g", ing.get("weight", 0)))
                elif isinstance(ing, str):
                    # Plain text ingredient line
                    name = ing.strip()
                    food_cat = "Unknown"
                    weight = 0.0
                else:
                    continue

                if not name:
                    continue

                # De-duplicate: consolidate same ingredients
                key = name.lower()
                if key in ingredient_map:
                    ingredient_map[key]["weight_g"] += weight
                else:
                    ingredient_map[key] = {
                        "name": name.title(),
                        "food_category": food_cat,
                        "weight_g": weight,
                    }

    all_ingredients = list(ingredient_map.values())

    if not all_ingredients:
        return GroceryListResponse(
            aisles=[],
            total_items=0,
            sort_time_ms=0.0,
            engine="none",
            plan_id=plan["id"],
            week=f"{plan['week_start']} to {plan['week_end']}",
        )

    # 4. Sort via C engine (or Python fallback)
    sorted_result = sorter.sort_items(all_ingredients)

    logger.info(
        f"Grocery list for user {user_id}: {sorted_result['total_items']} items, "
        f"sorted in {sorted_result['sort_time_ms']}ms via {sorted_result['engine']} engine"
    )

    # 5. Return structured response
    return GroceryListResponse(
        aisles=sorted_result["aisles"],
        total_items=sorted_result["total_items"],
        sort_time_ms=sorted_result["sort_time_ms"],
        engine=sorted_result["engine"],
        plan_id=plan["id"],
        week=f"{plan['week_start']} to {plan['week_end']}",
    )


@router.post("/grocery-list/save")
async def save_grocery_cart(body: SaveCartRequest, user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Saves the active checked items to User_Carts."""
    user_id = int(user["sub"])
    async with db.cursor() as cur:
        # Auto-migration if table doesn't exist
        await cur.execute("""
            CREATE TABLE IF NOT EXISTS User_Carts (
                user_id INT PRIMARY KEY,
                cart_json JSON,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)
        cart_str = json.dumps(body.cart_json)
        await cur.execute(
            """
            INSERT INTO User_Carts (user_id, cart_json)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE cart_json = VALUES(cart_json)
            """,
            (user_id, cart_str)
        )
        await db.commit()
    return {"status": "success", "message": "Cart saved"}


@router.get("/grocery-list/saved")
async def get_saved_grocery_cart(user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Loads the user's previously saved grocery cart checks."""
    user_id = int(user["sub"])
    async with db.cursor() as cur:
        try:
            await cur.execute("SELECT cart_json FROM User_Carts WHERE user_id = %s", (user_id,))
            row = await cur.fetchone()
            if row and row["cart_json"]:
                # Ensure it decodes properly
                data = json.loads(row["cart_json"]) if isinstance(row["cart_json"], str) else row["cart_json"]
                return {"items": data}
        except Exception as e:
            logger.error(f"Failed to load user cart (table might not exist yet): {e}")
            pass
    return {"items": []}
