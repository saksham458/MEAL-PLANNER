"""
Smart Meal Planner — Python-to-C Bridge (ctypes)
Interfaces with the compiled C grocery sorting engine.

This module:
1. Loads the compiled shared library (grocery_sort.dll / .so)
2. Defines matching ctypes struct layouts for GroceryItem and SortResult
3. Marshals Python ingredient data into C struct arrays
4. Calls the C sort_grocery_items() function
5. Reads back the sorted data and returns structured Python dicts

The C engine sorts by supermarket aisle using a multi-key comparator
at hardware-level speed — orders of magnitude faster than Python sorting.
"""

import ctypes
import ctypes.util
import logging
import os
import time
import platform
from typing import Optional

from config import C_ENGINE_PATH

logger = logging.getLogger("smartmeal.c_bridge")

# ── C Struct Definitions (must match grocery_sort.c exactly) ──

MAX_ITEM_NAME = 256
MAX_CATEGORY = 64


class GroceryItemC(ctypes.Structure):
    """
    Maps to the C struct:
        typedef struct {
            char name[256];
            char food_category[64];
            double weight_g;
            int aisle;
        } GroceryItem;
    """
    _fields_ = [
        ("name", ctypes.c_char * MAX_ITEM_NAME),
        ("food_category", ctypes.c_char * MAX_CATEGORY),
        ("weight_g", ctypes.c_double),
        ("aisle", ctypes.c_int),
    ]


class SortResultC(ctypes.Structure):
    """
    Maps to the C struct:
        typedef struct {
            int total_items;
            int items_per_aisle[8];
            double sort_time_ms;
        } SortResult;
    """
    _fields_ = [
        ("total_items", ctypes.c_int),
        ("items_per_aisle", ctypes.c_int * 8),
        ("sort_time_ms", ctypes.c_double),
    ]


# ── Aisle Names (matching C enum order) ──────────────────────
AISLE_NAMES = [
    "Produce",
    "Meat & Seafood",
    "Dairy & Eggs",
    "Grains & Bread",
    "Pantry",
    "Frozen",
    "Beverages",
    "Other",
]

AISLE_EMOJIS = {
    "Produce": "🥬",
    "Meat & Seafood": "🥩",
    "Dairy & Eggs": "🥛",
    "Grains & Bread": "🌾",
    "Pantry": "🫙",
    "Frozen": "🧊",
    "Beverages": "🥤",
    "Other": "📦",
}


class GrocerySorter:
    """
    Python wrapper around the C grocery sorting engine.

    Loads the compiled library once and reuses it for all sort operations.
    Falls back to pure-Python sorting if the C library is unavailable.
    """

    def __init__(self, lib_path: Optional[str] = None):
        self._lib = None
        self._lib_path = lib_path or C_ENGINE_PATH
        self._load_library()

    def _load_library(self):
        """
        Attempt to load the compiled C shared library.
        Tries multiple paths and falls back to Python sorting if unavailable.
        """
        # Try the configured path first
        paths_to_try = [self._lib_path]

        # Also try platform-specific extensions in the c_engine directory
        c_dir = os.path.join(os.path.dirname(__file__), "..", "c_engine")
        if platform.system() == "Windows":
            paths_to_try.append(os.path.join(c_dir, "grocery_sort.dll"))
        else:
            paths_to_try.append(os.path.join(c_dir, "grocery_sort.so"))

        for path in paths_to_try:
            abs_path = os.path.abspath(path)
            if os.path.exists(abs_path):
                try:
                    self._lib = ctypes.CDLL(abs_path)
                    self._configure_functions()
                    logger.info(f"✅ C engine loaded: {abs_path}")
                    return
                except OSError as e:
                    logger.warning(f"Failed to load C library from {abs_path}: {e}")

        logger.warning("⚠️  C engine not found. Using Python fallback sort.")

    def _configure_functions(self):
        """Set argument and return types for the C functions."""
        # sort_grocery_items(GroceryItem *items, int count, SortResult *result)
        self._lib.sort_grocery_items.argtypes = [
            ctypes.POINTER(GroceryItemC),
            ctypes.c_int,
            ctypes.POINTER(SortResultC),
        ]
        self._lib.sort_grocery_items.restype = None

        # get_aisle_name(int aisle_index) -> const char*
        self._lib.get_aisle_name.argtypes = [ctypes.c_int]
        self._lib.get_aisle_name.restype = ctypes.c_char_p

    def sort_items(self, ingredients: list[dict]) -> dict:
        """
        Sort a list of ingredient dicts by supermarket aisle.

        Args:
            ingredients: List of dicts with keys:
                - name (str): Ingredient name
                - food_category (str): Edamam food category
                - weight_g (float): Weight in grams

        Returns:
            Dict with:
                - aisles: List of aisle groups, each with name, emoji, items
                - total_items: Total count
                - sort_time_ms: Time taken to sort
                - engine: "c" or "python"
        """
        if not ingredients:
            return {
                "aisles": [],
                "total_items": 0,
                "sort_time_ms": 0.0,
                "engine": "none",
            }

        if self._lib:
            return self._sort_with_c(ingredients)
        else:
            return self._sort_with_python(ingredients)

    def _sort_with_c(self, ingredients: list[dict]) -> dict:
        """
        Sort using the C engine via ctypes.

        Steps:
        1. Marshal Python dicts into a C array of GroceryItemC structs
        2. Call the C sort_grocery_items() function (sorts in-place)
        3. Read back the sorted array and group by aisle
        """
        count = len(ingredients)
        start_time = time.perf_counter()

        # Step 1: Create a C array of GroceryItem structs
        ItemArray = GroceryItemC * count
        c_items = ItemArray()

        for i, ing in enumerate(ingredients):
            name = (ing.get("name") or ing.get("food") or "Unknown")[:MAX_ITEM_NAME - 1]
            category = (ing.get("food_category") or "Unknown")[:MAX_CATEGORY - 1]

            c_items[i].name = name.encode("utf-8", errors="replace")
            c_items[i].food_category = category.encode("utf-8", errors="replace")
            c_items[i].weight_g = float(ing.get("weight_g", 0))
            c_items[i].aisle = 7  # Default to OTHER, C will reassign

        # Step 2: Call the C sorting function
        result = SortResultC()
        self._lib.sort_grocery_items(c_items, count, ctypes.byref(result))

        sort_time = (time.perf_counter() - start_time) * 1000  # ms

        # Step 3: Read back sorted data and group by aisle
        aisles = {}
        for i in range(count):
            aisle_idx = c_items[i].aisle
            aisle_name = AISLE_NAMES[aisle_idx] if 0 <= aisle_idx < 8 else "Other"

            if aisle_name not in aisles:
                aisles[aisle_name] = {
                    "name": aisle_name,
                    "emoji": AISLE_EMOJIS.get(aisle_name, "📦"),
                    "items": [],
                }

            aisles[aisle_name]["items"].append({
                "name": c_items[i].name.decode("utf-8", errors="replace"),
                "category": c_items[i].food_category.decode("utf-8", errors="replace"),
                "weight_g": round(c_items[i].weight_g, 1),
                "aisle": aisle_name,
            })

        # Maintain aisle order (Produce → Meat → Dairy → ...)
        ordered_aisles = []
        for aisle_name in AISLE_NAMES:
            if aisle_name in aisles:
                ordered_aisles.append(aisles[aisle_name])

        logger.info(
            f"🚀 C engine sorted {count} items in {sort_time:.3f}ms "
            f"({len(ordered_aisles)} aisles)"
        )

        return {
            "aisles": ordered_aisles,
            "total_items": count,
            "sort_time_ms": round(sort_time, 3),
            "engine": "c",
            "items_per_aisle": {
                AISLE_NAMES[i]: result.items_per_aisle[i]
                for i in range(8) if result.items_per_aisle[i] > 0
            },
        }

    def _sort_with_python(self, ingredients: list[dict]) -> dict:
        """
        Pure Python fallback when the C library is unavailable.
        Uses the same aisle classification logic but in Python.
        """
        start_time = time.perf_counter()

        # Classify and sort
        classified = []
        for ing in ingredients:
            name = ing.get("name") or ing.get("food") or "Unknown"
            category = ing.get("food_category") or "Unknown"
            aisle = self._python_classify(name, category)
            classified.append({
                "name": name,
                "category": category,
                "weight_g": round(float(ing.get("weight_g", 0)), 1),
                "aisle": aisle,
            })

        # Sort by aisle index, then name
        aisle_order = {name: i for i, name in enumerate(AISLE_NAMES)}
        classified.sort(key=lambda x: (aisle_order.get(x["aisle"], 99), x["name"].lower()))

        # Group by aisle
        aisles = {}
        for item in classified:
            aisle_name = item["aisle"]
            if aisle_name not in aisles:
                aisles[aisle_name] = {
                    "name": aisle_name,
                    "emoji": AISLE_EMOJIS.get(aisle_name, "📦"),
                    "items": [],
                }
            aisles[aisle_name]["items"].append(item)

        ordered = [aisles[name] for name in AISLE_NAMES if name in aisles]
        sort_time = (time.perf_counter() - start_time) * 1000

        logger.info(f"🐍 Python sorted {len(ingredients)} items in {sort_time:.3f}ms")

        return {
            "aisles": ordered,
            "total_items": len(ingredients),
            "sort_time_ms": round(sort_time, 3),
            "engine": "python",
        }

    @staticmethod
    def _python_classify(name: str, category: str) -> str:
        """Python fallback classification (mirrors C logic)."""
        name_l = name.lower()
        cat_l = category.lower()

        produce_kw = ["vegetable", "fruit", "produce", "herb", "green", "salad",
                       "spinach", "tomato", "lettuce", "avocado", "pepper", "onion",
                       "garlic", "lemon", "berry", "apple", "broccoli", "carrot",
                       "potato", "mushroom", "banana"]
        if any(k in cat_l or k in name_l for k in produce_kw):
            return "Produce"

        meat_kw = ["meat", "poultry", "seafood", "fish", "chicken", "beef",
                    "salmon", "turkey", "pork", "shrimp", "tuna", "lamb", "bacon", "steak"]
        if any(k in cat_l or k in name_l for k in meat_kw):
            return "Meat & Seafood"

        dairy_kw = ["dairy", "cheese", "egg", "milk", "yogurt", "butter", "cream"]
        if any(k in cat_l or k in name_l for k in dairy_kw):
            return "Dairy & Eggs"

        grain_kw = ["grain", "bread", "cereal", "pasta", "rice", "quinoa",
                     "oat", "flour", "tortilla", "noodle"]
        if any(k in cat_l or k in name_l for k in grain_kw):
            return "Grains & Bread"

        pantry_kw = ["condiment", "oil", "spice", "sauce", "canned", "nut",
                      "seed", "legume", "salt", "honey", "sugar", "vinegar",
                      "almond", "bean", "lentil"]
        if any(k in cat_l or k in name_l for k in pantry_kw):
            return "Pantry"

        if "frozen" in cat_l or "frozen" in name_l:
            return "Frozen"

        if any(k in cat_l or k in name_l for k in ["beverage", "drink", "juice", "coffee", "tea"]):
            return "Beverages"

        return "Other"


# Module-level singleton
sorter = GrocerySorter()
