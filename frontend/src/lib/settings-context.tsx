'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AppSettings {
  fontFamily: string;
  themePref: string; // 'light', 'dark', 'system'
  unitPref: string;  // 'metric', 'imperial'
  dietaryType: string;
  allergies: string[];
  dislikedIngredients: string[];
  mealsPerDay: string;
  autoMacros: boolean;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  cookingPrefs: string[];
  mealReminders: boolean;
  waterReminders: boolean;
  weeklyCheckins: boolean;
}

const defaultSettings: AppSettings = {
  fontFamily: 'Inter',
  themePref: 'system',
  unitPref: 'metric',
  dietaryType: 'omnivore',
  allergies: [],
  dislikedIngredients: [],
  mealsPerDay: '3-meals',
  autoMacros: true,
  proteinPct: 30,
  carbsPct: 40,
  fatPct: 30,
  cookingPrefs: [],
  mealReminders: true,
  waterReminders: true,
  weeklyCheckins: true,
};

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  isBudgetFriendly: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('smartmeal_app_settings');
      if (saved) {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever settings change (after initial load)
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('smartmeal_app_settings', JSON.stringify(settings));
    }
  }, [settings, isLoaded]);

  // Apply Font and Theme to document root
  useEffect(() => {
    if (!isLoaded) return;
    
    const root = document.documentElement;
    
    // Apply Font
    if (settings.fontFamily === 'Inter') root.style.fontFamily = 'var(--font-inter)';
    else if (settings.fontFamily === 'Roboto') root.style.fontFamily = 'var(--font-roboto)';
    else if (settings.fontFamily === 'Outfit') root.style.fontFamily = 'var(--font-outfit)';
    else root.style.fontFamily = settings.fontFamily;
    
    // Apply Theme
    if (settings.themePref === 'dark' || (settings.themePref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.fontFamily, settings.themePref, isLoaded]);

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const isBudgetFriendly = settings.cookingPrefs.includes('budget');

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isBudgetFriendly }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
