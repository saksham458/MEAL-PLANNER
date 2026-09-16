import { useState } from "react";
import { MealChoice, useProgress } from "@/lib/progress-context";
import { useToast } from "@/lib/toast-context";
import { CheckCircle2, Circle } from "lucide-react";

// Mock Database of Meal Choices
const MOCK_MEALS: Record<string, MealChoice[]> = {
  Breakfast: [
    { id: "b1", name: "Oatmeal & Berries", calories: 350, protein: 12, carbs: 60, fat: 8, ingredients: [{ name: "Oats", amount: 50, unit: "g", aisle: "Pantry" }, { name: "Mixed Berries", amount: 100, unit: "g", aisle: "Produce" }] },
    { id: "b2", name: "Egg White Omelette", calories: 280, protein: 28, carbs: 5, fat: 15, ingredients: [{ name: "Eggs", amount: 4, unit: "pcs", aisle: "Dairy" }, { name: "Spinach", amount: 50, unit: "g", aisle: "Produce" }] },
    { id: "b3", name: "Protein Smoothie", calories: 400, protein: 35, carbs: 45, fat: 10, ingredients: [{ name: "Protein Powder", amount: 30, unit: "g", aisle: "Pantry" }, { name: "Banana", amount: 1, unit: "pc", aisle: "Produce" }] },
  ],
  Lunch: [
    { id: "l1", name: "Grilled Chicken Salad", calories: 450, protein: 45, carbs: 20, fat: 18, ingredients: [{ name: "Chicken Breast", amount: 150, unit: "g", aisle: "Meat" }, { name: "Mixed Greens", amount: 100, unit: "g", aisle: "Produce" }] },
    { id: "l2", name: "Quinoa Bowl", calories: 500, protein: 20, carbs: 75, fat: 12, ingredients: [{ name: "Quinoa", amount: 100, unit: "g", aisle: "Pantry" }, { name: "Black Beans", amount: 50, unit: "g", aisle: "Pantry" }] },
    { id: "l3", name: "Turkey Wrap", calories: 420, protein: 35, carbs: 40, fat: 14, ingredients: [{ name: "Turkey Breast", amount: 100, unit: "g", aisle: "Meat" }, { name: "Tortilla", amount: 1, unit: "pc", aisle: "Pantry" }] },
  ],
  Snacks: [
    { id: "s1", name: "Greek Yogurt", calories: 150, protein: 15, carbs: 10, fat: 5, ingredients: [{ name: "Greek Yogurt", amount: 150, unit: "g", aisle: "Dairy" }] },
    { id: "s2", name: "Almonds & Apple", calories: 220, protein: 6, carbs: 25, fat: 14, ingredients: [{ name: "Almonds", amount: 30, unit: "g", aisle: "Pantry" }, { name: "Apple", amount: 1, unit: "pc", aisle: "Produce" }] },
    { id: "s3", name: "Protein Bar", calories: 200, protein: 20, carbs: 22, fat: 8, ingredients: [{ name: "Protein Bar", amount: 1, unit: "pc", aisle: "Pantry" }] },
  ],
  Dinner: [
    { id: "d1", name: "Salmon & Asparagus", calories: 550, protein: 40, carbs: 15, fat: 30, ingredients: [{ name: "Salmon", amount: 150, unit: "g", aisle: "Meat" }, { name: "Asparagus", amount: 100, unit: "g", aisle: "Produce" }] },
    { id: "d2", name: "Lean Beef Stir Fry", calories: 600, protein: 45, carbs: 55, fat: 18, ingredients: [{ name: "Lean Beef", amount: 150, unit: "g", aisle: "Meat" }, { name: "Rice", amount: 100, unit: "g", aisle: "Pantry" }] },
    { id: "d3", name: "Lentil Soup", calories: 400, protein: 22, carbs: 65, fat: 5, ingredients: [{ name: "Lentils", amount: 100, unit: "g", aisle: "Pantry" }, { name: "Carrots", amount: 50, unit: "g", aisle: "Produce" }] },
  ],
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMESTAMPS = ["Breakfast", "Lunch", "Snacks", "Dinner"];

export function MealPlanView() {
  const { selectedMeals, selectMeal, dailyProgress, updateDailyProgress } = useProgress();
  const { toast } = useToast();
  const [activeDay, setActiveDay] = useState(DAYS[0]);
  const [eatenMeals, setEatenMeals] = useState<Record<string, boolean>>({});

  const handleSelectMeal = (timestamp: string, meal: MealChoice) => {
    selectMeal(activeDay, timestamp, meal);
    toast(`${meal.name} selected for ${activeDay} ${timestamp}`, "success");
  };

  const handleMarkEaten = (timestamp: string, meal: MealChoice) => {
    const key = `${activeDay}-${timestamp}-${meal.id}`;
    if (eatenMeals[key]) return; // already eaten

    setEatenMeals(prev => ({ ...prev, [key]: true }));
    updateDailyProgress({
      consumed_calories: dailyProgress.consumed_calories + meal.calories,
      consumed_protein_g: dailyProgress.consumed_protein_g + meal.protein,
      consumed_carbs_g: dailyProgress.consumed_carbs_g + meal.carbs,
      consumed_fat_g: dailyProgress.consumed_fat_g + meal.fat,
    });
    toast(`Logged ${meal.calories} kcal for ${meal.name}`, "success");
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
      
      {/* Horizontal Day Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 hide-scrollbar">
        {DAYS.map(day => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`flex-shrink-0 px-6 py-3 rounded-2xl font-extrabold text-sm transition-all border ${
              activeDay === day 
                ? "bg-slate-900 dark:bg-emerald-600 text-white border-transparent shadow-md"
                : "bg-card border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="space-y-12">
        {TIMESTAMPS.map(ts => {
          const currentlySelected = selectedMeals[activeDay]?.[ts];

          return (
            <div key={ts} className="space-y-4">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight border-b border-slate-100 dark:border-slate-800 pb-2">
                {ts}
              </h3>
              
              <div className="grid lg:grid-cols-3 gap-6">
                {MOCK_MEALS[ts].map(meal => {
                  const isSelected = currentlySelected?.id === meal.id;
                  const key = `${activeDay}-${ts}-${meal.id}`;
                  const isEaten = eatenMeals[key];

                  return (
                    <div 
                      key={meal.id} 
                      className={`relative bg-card border rounded-2xl p-5 transition-all ${
                        isSelected 
                          ? "border-emerald-500 shadow-md ring-1 ring-emerald-500/20" 
                          : "border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="mb-4">
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-lg leading-tight mb-1">{meal.name}</h4>
                        <div className="flex items-center gap-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
                          <span className="text-orange-500">{meal.calories} kcal</span>
                          <span>{meal.protein}g P</span>
                          <span>{meal.carbs}g C</span>
                        </div>
                      </div>
                      
                      {isSelected ? (
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-xs font-extrabold text-emerald-600 uppercase tracking-widest">Selected</span>
                          <button
                            onClick={() => handleMarkEaten(ts, meal)}
                            disabled={isEaten}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              isEaten 
                                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 opacity-50 cursor-not-allowed"
                                : "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/60"
                            }`}
                          >
                            {isEaten ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            {isEaten ? "Eaten" : "Mark Eaten"}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSelectMeal(ts, meal)}
                          className="mt-6 w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-extrabold transition-colors"
                        >
                          Select Meal
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
