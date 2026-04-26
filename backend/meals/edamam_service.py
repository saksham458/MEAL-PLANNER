"""
Smart Meal Planner — Edamam Recipe Search API Service
Async client for fetching real-world recipes from Edamam's Recipe Search v2 API.
Docs: https://developer.edamam.com/edamam-docs-recipe-api
"""

import logging
from typing import Optional
import httpx

from config import EDAMAM_APP_ID, EDAMAM_APP_KEY, EDAMAM_BASE_URL

logger = logging.getLogger("smartmeal.edamam")


class EdamamService:
    """
    Async service for interacting with the Edamam Recipe Search API v2.

    Usage:
        service = EdamamService()
        recipes = await service.search_recipes(
            query="high protein chicken",
            max_calories=600,
            min_protein=30,
            meal_type="lunch",
            count=5,
        )
    """

    def __init__(self):
        self.base_url = EDAMAM_BASE_URL
        self.app_id = EDAMAM_APP_ID
        self.app_key = EDAMAM_APP_KEY

    async def search_recipes(
        self,
        query: str,
        meal_type: Optional[str] = None,
        max_calories: Optional[int] = None,
        min_protein: Optional[float] = None,
        max_fat: Optional[float] = None,
        diet_labels: Optional[list[str]] = None,
        health_labels: Optional[list[str]] = None,
        excluded_ingredients: Optional[list[str]] = None,
        count: int = 7,
    ) -> list[dict]:
        """
        Search for recipes matching the user's dietary criteria.

        Args:
            query:          Natural language search (e.g., "high protein chicken")
            meal_type:      Filter by meal type: "Breakfast", "Lunch", "Dinner", "Snack"
            max_calories:   Maximum calories per serving
            min_protein:    Minimum protein grams per serving
            max_fat:        Maximum fat grams per serving
            diet_labels:    Edamam diet filters: ["high-protein", "low-fat", "balanced"]
            health_labels:  Edamam health filters: ["dairy-free", "gluten-free", "vegan"]
            excluded_ingredients: Ingredients to exclude
            count:          Number of results to return

        Returns:
            List of parsed recipe dicts with standardized fields
        """
        params = {
            "type": "public",
            "q": query,
            "app_id": self.app_id,
            "app_key": self.app_key,
        }

        # Meal type filter
        if meal_type:
            params["mealType"] = meal_type

        # Nutrient range filters (Edamam format: "MIN-MAX" or "MIN+" or "MAX")
        if max_calories:
            params["calories"] = f"0-{max_calories}"
        if min_protein:
            params["nutrients[PROCNT]"] = f"{min_protein}+"
        if max_fat:
            params["nutrients[FAT]"] = f"0-{max_fat}"

        # Diet labels (high-protein, low-carb, etc.)
        if diet_labels:
            params["diet"] = diet_labels

        # Health labels (dairy-free, gluten-free, etc.)
        if health_labels:
            params["health"] = health_labels

        # Excluded ingredients
        if excluded_ingredients:
            params["excluded"] = excluded_ingredients

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                data = response.json()

            hits = data.get("hits", [])
            recipes = []

            for hit in hits[:count]:
                recipe = hit.get("recipe", {})
                nutrients = recipe.get("totalNutrients", {})
                servings = recipe.get("yield", 4) or 4

                parsed = {
                    "edamam_uri": recipe.get("uri", ""),
                    "recipe_label": recipe.get("label", "Unknown"),
                    "recipe_image": recipe.get("image", ""),
                    "recipe_url": recipe.get("url", ""),
                    "recipe_yield": int(servings),
                    # Per-serving macros
                    "calories": round(recipe.get("calories", 0) / servings),
                    "protein_g": round(nutrients.get("PROCNT", {}).get("quantity", 0) / servings, 1),
                    "carbs_g": round(nutrients.get("CHOCDF", {}).get("quantity", 0) / servings, 1),
                    "fat_g": round(nutrients.get("FAT", {}).get("quantity", 0) / servings, 1),
                    "fiber_g": round(nutrients.get("FIBTG", {}).get("quantity", 0) / servings, 1),
                    # Raw ingredient lines for grocery list extraction
                    "ingredient_lines": recipe.get("ingredientLines", []),
                    # Structured ingredients with food categories
                    "ingredients": [
                        {
                            "text": ing.get("text", ""),
                            "food": ing.get("food", ""),
                            "quantity": ing.get("quantity", 0),
                            "measure": ing.get("measure", ""),
                            "weight_g": round(ing.get("weight", 0), 1),
                            "food_category": ing.get("foodCategory", "Unknown"),
                        }
                        for ing in recipe.get("ingredients", [])
                    ],
                }
                recipes.append(parsed)

            logger.info(f"Edamam returned {len(recipes)} recipes for query: '{query}'")
            return recipes

        except httpx.HTTPStatusError as e:
            logger.error(f"Edamam API HTTP error: {e.response.status_code} — {e.response.text}")
            raise
        except httpx.RequestError as e:
            logger.error(f"Edamam API request failed: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error calling Edamam: {e}")
            raise

    async def get_recipe_by_uri(self, uri: str) -> Optional[dict]:
        """
        Fetch a specific recipe by its Edamam URI.
        Used when swapping meals to get full recipe data.
        """
        params = {
            "type": "public",
            "app_id": self.app_id,
            "app_key": self.app_key,
            "uri": uri,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(self.base_url + "/by-uri", params=params)
                response.raise_for_status()
                data = response.json()

            hits = data.get("hits", [])
            if not hits:
                return None

            recipe = hits[0].get("recipe", {})
            nutrients = recipe.get("totalNutrients", {})
            servings = recipe.get("yield", 4) or 4

            return {
                "edamam_uri": recipe.get("uri", ""),
                "recipe_label": recipe.get("label", "Unknown"),
                "recipe_image": recipe.get("image", ""),
                "recipe_url": recipe.get("url", ""),
                "recipe_yield": int(servings),
                "calories": round(recipe.get("calories", 0) / servings),
                "protein_g": round(nutrients.get("PROCNT", {}).get("quantity", 0) / servings, 1),
                "carbs_g": round(nutrients.get("CHOCDF", {}).get("quantity", 0) / servings, 1),
                "fat_g": round(nutrients.get("FAT", {}).get("quantity", 0) / servings, 1),
                "fiber_g": round(nutrients.get("FIBTG", {}).get("quantity", 0) / servings, 1),
                "ingredient_lines": recipe.get("ingredientLines", []),
                "ingredients": [
                    {
                        "text": ing.get("text", ""),
                        "food": ing.get("food", ""),
                        "quantity": ing.get("quantity", 0),
                        "measure": ing.get("measure", ""),
                        "weight_g": round(ing.get("weight", 0), 1),
                        "food_category": ing.get("foodCategory", "Unknown"),
                    }
                    for ing in recipe.get("ingredients", [])
                ],
            }
        except Exception as e:
            logger.error(f"Failed to fetch recipe by URI: {e}")
            return None


# Module-level singleton
edamam = EdamamService()
