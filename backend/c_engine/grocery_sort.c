/*
 * ============================================================
 * SMART MEAL PLANNER — C Grocery Sorting Engine
 * High-performance multi-key sort by supermarket aisle
 * ============================================================
 *
 * This module provides ultra-fast sorting of grocery items
 * by supermarket aisle/category. It uses qsort with a
 * composite comparator for multi-key sorting:
 *   Primary:   Aisle category (Produce, Meat, Dairy, Grains, Pantry)
 *   Secondary: Alphabetical by item name within each aisle
 *
 * Compilation:
 *   Linux/Mac: gcc -shared -fPIC -O2 -o grocery_sort.so grocery_sort.c
 *   Windows:   gcc -shared -O2 -o grocery_sort.dll grocery_sort.c
 *
 * Integration: Python loads via ctypes and calls sort_grocery_items()
 */


#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

/* ── Constants ─────────────────────────────────────────────── */
#define MAX_ITEM_NAME   256
#define MAX_CATEGORY    64
#define MAX_ITEMS       2048

/* ── Aisle Priority Enum ───────────────────────────────────── */
/* Lower number = earlier in the supermarket route */
typedef enum {
    AISLE_PRODUCE   = 0,
    AISLE_MEAT      = 1,
    AISLE_DAIRY     = 2,
    AISLE_GRAINS    = 3,
    AISLE_PANTRY    = 4,
    AISLE_FROZEN    = 5,
    AISLE_BEVERAGES = 6,
    AISLE_OTHER     = 7,
} AisleCategory;

/* ── Grocery Item Struct ───────────────────────────────────── */
typedef struct {
    char name[MAX_ITEM_NAME];         /* Item name (e.g., "Chicken Breast") */
    char food_category[MAX_CATEGORY]; /* Edamam food category string */
    double weight_g;                  /* Weight in grams */
    int aisle;                        /* Computed aisle (AisleCategory) */
} GroceryItem;

/* ── Result Struct (returned to Python) ────────────────────── */
typedef struct {
    int total_items;
    int items_per_aisle[8];  /* Count per aisle category */
    double sort_time_ms;     /* Sorting duration in milliseconds */
} SortResult;


/* ────────────────────────────────────────────────────────────
 * classify_aisle()
 * Maps an Edamam food category string to our AisleCategory enum.
 * Uses keyword matching for robust classification.
 * ──────────────────────────────────────────────────────────── */
static int classify_aisle(const char *food_category, const char *name) {
    /* Work with lowercase copies for case-insensitive matching */
    char cat_lower[MAX_CATEGORY];
    char name_lower[MAX_ITEM_NAME];

    /* Convert category to lowercase */
    int i;
    for (i = 0; food_category[i] && i < MAX_CATEGORY - 1; i++) {
        cat_lower[i] = tolower((unsigned char)food_category[i]);
    }
    cat_lower[i] = '\0';

    /* Convert name to lowercase */
    for (i = 0; name[i] && i < MAX_ITEM_NAME - 1; i++) {
        name_lower[i] = tolower((unsigned char)name[i]);
    }
    name_lower[i] = '\0';

    /* ── Produce ── */
    if (strstr(cat_lower, "vegetable") || strstr(cat_lower, "fruit") ||
        strstr(cat_lower, "produce") || strstr(cat_lower, "salad") ||
        strstr(cat_lower, "herb") || strstr(cat_lower, "green") ||
        strstr(name_lower, "spinach") || strstr(name_lower, "tomato") ||
        strstr(name_lower, "lettuce") || strstr(name_lower, "avocado") ||
        strstr(name_lower, "pepper") || strstr(name_lower, "onion") ||
        strstr(name_lower, "garlic") || strstr(name_lower, "lemon") ||
        strstr(name_lower, "lime") || strstr(name_lower, "berry") ||
        strstr(name_lower, "apple") || strstr(name_lower, "banana") ||
        strstr(name_lower, "broccoli") || strstr(name_lower, "carrot") ||
        strstr(name_lower, "potato") || strstr(name_lower, "mushroom")) {
        return AISLE_PRODUCE;
    }

    /* ── Meat & Seafood ── */
    if (strstr(cat_lower, "meat") || strstr(cat_lower, "poultry") ||
        strstr(cat_lower, "seafood") || strstr(cat_lower, "fish") ||
        strstr(name_lower, "chicken") || strstr(name_lower, "beef") ||
        strstr(name_lower, "salmon") || strstr(name_lower, "turkey") ||
        strstr(name_lower, "pork") || strstr(name_lower, "shrimp") ||
        strstr(name_lower, "tuna") || strstr(name_lower, "lamb") ||
        strstr(name_lower, "bacon") || strstr(name_lower, "steak")) {
        return AISLE_MEAT;
    }

    /* ── Dairy & Eggs ── */
    if (strstr(cat_lower, "dairy") || strstr(cat_lower, "cheese") ||
        strstr(cat_lower, "egg") || strstr(cat_lower, "milk") ||
        strstr(name_lower, "yogurt") || strstr(name_lower, "milk") ||
        strstr(name_lower, "cheese") || strstr(name_lower, "butter") ||
        strstr(name_lower, "cream") || strstr(name_lower, "egg")) {
        return AISLE_DAIRY;
    }

    /* ── Grains & Bread ── */
    if (strstr(cat_lower, "grain") || strstr(cat_lower, "bread") ||
        strstr(cat_lower, "cereal") || strstr(cat_lower, "pasta") ||
        strstr(name_lower, "rice") || strstr(name_lower, "quinoa") ||
        strstr(name_lower, "oat") || strstr(name_lower, "bread") ||
        strstr(name_lower, "flour") || strstr(name_lower, "pasta") ||
        strstr(name_lower, "tortilla") || strstr(name_lower, "noodle")) {
        return AISLE_GRAINS;
    }

    /* ── Frozen ── */
    if (strstr(cat_lower, "frozen") || strstr(name_lower, "frozen")) {
        return AISLE_FROZEN;
    }

    /* ── Beverages ── */
    if (strstr(cat_lower, "beverage") || strstr(cat_lower, "drink") ||
        strstr(name_lower, "juice") || strstr(name_lower, "water") ||
        strstr(name_lower, "coffee") || strstr(name_lower, "tea")) {
        return AISLE_BEVERAGES;
    }

    /* ── Pantry (condiments, oils, spices, canned goods) ── */
    if (strstr(cat_lower, "condiment") || strstr(cat_lower, "oil") ||
        strstr(cat_lower, "spice") || strstr(cat_lower, "sauce") ||
        strstr(cat_lower, "canned") || strstr(cat_lower, "nut") ||
        strstr(cat_lower, "seed") || strstr(cat_lower, "legume") ||
        strstr(name_lower, "oil") || strstr(name_lower, "salt") ||
        strstr(name_lower, "pepper") || strstr(name_lower, "honey") ||
        strstr(name_lower, "sugar") || strstr(name_lower, "vinegar") ||
        strstr(name_lower, "sauce") || strstr(name_lower, "almond") ||
        strstr(name_lower, "nut") || strstr(name_lower, "seed") ||
        strstr(name_lower, "bean") || strstr(name_lower, "lentil")) {
        return AISLE_PANTRY;
    }

    return AISLE_OTHER;
}


/* ────────────────────────────────────────────────────────────
 * compare_items()
 * Composite comparator for qsort:
 *   1. Sort by aisle category (ascending)
 *   2. Within same aisle, sort alphabetically by name
 * ──────────────────────────────────────────────────────────── */
static int compare_items(const void *a, const void *b) {
    const GroceryItem *item_a = (const GroceryItem *)a;
    const GroceryItem *item_b = (const GroceryItem *)b;

    /* Primary sort: by aisle */
    if (item_a->aisle != item_b->aisle) {
        return item_a->aisle - item_b->aisle;
    }

    /* Secondary sort: alphabetical by name */
    return strcmp(item_a->name, item_b->name);
}


/* ════════════════════════════════════════════════════════════
 * PUBLIC API — Called from Python via ctypes
 * ════════════════════════════════════════════════════════════ */

#ifdef _WIN32
    #define EXPORT __declspec(dllexport)
#else
    #define EXPORT
#endif

/*
 * sort_grocery_items()
 *
 * Main entry point called from Python.
 * Takes an array of GroceryItem structs, classifies each into
 * an aisle, and sorts using qsort with the composite comparator.
 *
 * Parameters:
 *   items  — Pointer to array of GroceryItem structs
 *   count  — Number of items in the array
 *   result — Pointer to SortResult struct for metadata output
 *
 * The items array is sorted IN-PLACE. Python reads back
 * the sorted order from the same memory buffer.
 */
EXPORT void sort_grocery_items(GroceryItem *items, int count, SortResult *result) {
    int i;

    /* Clamp count to prevent buffer overflow */
    if (count > MAX_ITEMS) count = MAX_ITEMS;
    if (count <= 0) {
        result->total_items = 0;
        result->sort_time_ms = 0.0;
        return;
    }

    /* Phase 1: Classify each item into an aisle category */
    for (i = 0; i < count; i++) {
        items[i].aisle = classify_aisle(items[i].food_category, items[i].name);
    }

    /* Phase 2: Multi-key sort via qsort */
    qsort(items, count, sizeof(GroceryItem), compare_items);

    /* Phase 3: Count items per aisle for the result summary */
    memset(result->items_per_aisle, 0, sizeof(result->items_per_aisle));
    for (i = 0; i < count; i++) {
        if (items[i].aisle >= 0 && items[i].aisle < 8) {
            result->items_per_aisle[items[i].aisle]++;
        }
    }

    result->total_items = count;
    /* sort_time_ms is measured by the Python caller for accuracy */
    result->sort_time_ms = 0.0;
}

/*
 * get_aisle_name()
 *
 * Returns a human-readable aisle name for a given category index.
 * Called from Python to label each aisle in the response.
 */
EXPORT const char* get_aisle_name(int aisle_index) {
    switch (aisle_index) {
        case AISLE_PRODUCE:   return "Produce";
        case AISLE_MEAT:      return "Meat & Seafood";
        case AISLE_DAIRY:     return "Dairy & Eggs";
        case AISLE_GRAINS:    return "Grains & Bread";
        case AISLE_PANTRY:    return "Pantry";
        case AISLE_FROZEN:    return "Frozen";
        case AISLE_BEVERAGES: return "Beverages";
        case AISLE_OTHER:     return "Other";
        default:              return "Unknown";
    }
}

