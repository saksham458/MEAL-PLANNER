"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface DailyProgress {
  consumed_calories: number;
  consumed_protein_g: number;
  consumed_carbs_g: number;
  consumed_fat_g: number;
  water_glasses: number;
  active_calories: number;
}

export interface MealChoice {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: { name: string; amount: number; unit: string; aisle: string }[];
}

// Map of Day (e.g. "Mon") -> Map of Timestamp (e.g. "Breakfast") -> Selected Meal ID
export type SelectedMealsState = Record<string, Record<string, MealChoice | null>>;

interface ProgressContextType {
  dailyProgress: DailyProgress;
  updateDailyProgress: (updates: Partial<DailyProgress>) => void;
  selectedMeals: SelectedMealsState;
  selectMeal: (day: string, timestamp: string, meal: MealChoice | null) => void;
  streak: number;
}

const defaultProgress: DailyProgress = {
  consumed_calories: 0,
  consumed_protein_g: 0,
  consumed_carbs_g: 0,
  consumed_fat_g: 0,
  water_glasses: 0,
  active_calories: 0,
};

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [dailyProgress, setDailyProgress] = useState<DailyProgress>(defaultProgress);
  const [selectedMeals, setSelectedMeals] = useState<SelectedMealsState>({});
  const [streak, setStreak] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedProgress = localStorage.getItem('smartmeal_progress');
      if (savedProgress) setDailyProgress(JSON.parse(savedProgress));

      const savedMeals = localStorage.getItem('smartmeal_selected_meals');
      if (savedMeals) setSelectedMeals(JSON.parse(savedMeals));

      const savedStreak = localStorage.getItem('smartmeal_streak');
      if (savedStreak) setStreak(Number(savedStreak));
    } catch (err) {
      console.error("Failed to load progress:", err);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('smartmeal_progress', JSON.stringify(dailyProgress));
      localStorage.setItem('smartmeal_selected_meals', JSON.stringify(selectedMeals));
      localStorage.setItem('smartmeal_streak', streak.toString());
    }
  }, [dailyProgress, selectedMeals, streak, isLoaded]);

  const updateDailyProgress = (updates: Partial<DailyProgress>) => {
    setDailyProgress(prev => ({ ...prev, ...updates }));
  };

  const selectMeal = (day: string, timestamp: string, meal: MealChoice | null) => {
    setSelectedMeals(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [timestamp]: meal,
      }
    }));
  };

  return (
    <ProgressContext.Provider value={{ dailyProgress, updateDailyProgress, selectedMeals, selectMeal, streak }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (context === undefined) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
}
