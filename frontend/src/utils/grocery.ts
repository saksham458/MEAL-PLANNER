import { SelectedMealsState, MealChoice } from "@/lib/progress-context";

export interface GroceryItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  aisle: string;
}

export type GroceryListByAisle = Record<string, GroceryItem[]>;

/**
 * Aggregates all ingredients from the selected meals across the week.
 * Sums duplicate ingredients if they share the same unit.
 */
export function generateGroceryList(selectedMeals: SelectedMealsState): GroceryListByAisle {
  const aggregated: Record<string, GroceryItem> = {};

  // Extract all non-null meals
  const allMeals: MealChoice[] = [];
  Object.values(selectedMeals).forEach((daySchedule) => {
    Object.values(daySchedule).forEach((meal) => {
      if (meal) allMeals.push(meal);
    });
  });

  allMeals.forEach((meal) => {
    meal.ingredients.forEach((ing) => {
      // Normalize name for keying (e.g. "Oats" and "oats" are the same)
      const key = `${ing.name.toLowerCase()}_${ing.unit.toLowerCase()}`;
      
      if (aggregated[key]) {
        aggregated[key].amount += ing.amount;
      } else {
        aggregated[key] = {
          id: key,
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit,
          aisle: ing.aisle || "Pantry",
        };
      }
    });
  });

  // Group by aisle
  const grouped: GroceryListByAisle = {};
  Object.values(aggregated).forEach((item) => {
    if (!grouped[item.aisle]) {
      grouped[item.aisle] = [];
    }
    grouped[item.aisle].push(item);
  });

  return grouped;
}
