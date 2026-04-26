/**
 * SmartMeal API Client
 * Handles all communication with the FastAPI backend at localhost:8000
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ApiOptions extends RequestInit {
  token?: string;
}

class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  // Add auth token if available
  const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('smartmeal_token') : null);
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  } catch (err) {
    console.error(`🔴 Network Error: Failed to connect to backend at ${API_BASE}${path}. Is the FastAPI server running?`, err);
    throw new ApiError(503, "Cloud not connect to the backend server. Please ensure it is running.");
  }

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, data.detail || `API error ${res.status}`);
  }

  return data as T;
}

// ── Auth Endpoints ──────────────────────────────────────────
export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  email: string;
  first_name: string;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  return api<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string = ''
): Promise<AuthResponse> {
  return api<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName }),
  });
}

// ── Settings / Biometrics ───────────────────────────────────
export interface Biometrics {
  gender: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  activity_level: string;
  daily_calories: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
  dietary_goal: string;
}

export interface SettingsResponse {
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  };
  biometrics: Biometrics;
}

export async function getSettings(): Promise<SettingsResponse> {
  return api<SettingsResponse>('/settings');
}

export async function updateSettings(data: Partial<Biometrics>): Promise<SettingsResponse> {
  return api<SettingsResponse>('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ── Meals ───────────────────────────────────────────────────
export interface Meal {
  id: number;
  day_of_week: number;
  meal_type: string;
  recipe_label: string;
  recipe_image: string | null;
  recipe_url: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  is_logged: boolean;
}

export interface ProposedMeal {
  temp_id: string;
  day_of_week: number;
  meal_type: string;
  recipe_label: string;
  recipe_image: string | null;
  recipe_url: string | null;
  recipe_yield: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  ingredients_json: string;
  edamam_uri: string;
  is_high_protein: boolean;
}

export interface WeeklyPlanProposal {
  meals: ProposedMeal[];
}

export interface MealPlanResponse {
  plan_id: number;
  week_start: string;
  week_end: string;
  meals: Meal[];
  total_calories: number;
  total_protein: number;
}

export async function generateMealPlan(): Promise<MealPlanResponse> {
  return api<MealPlanResponse>('/api/meals/generate', { method: 'POST', body: JSON.stringify({}) });
}

export async function proposeMealPlan(preferences?: string): Promise<WeeklyPlanProposal> {
  return api<WeeklyPlanProposal>('/api/meals/propose', {
    method: 'POST',
    body: JSON.stringify({ dietary_preferences: preferences }),
  });
}

export async function confirmMealPlan(meals: ProposedMeal[]): Promise<MealPlanResponse> {
  return api<MealPlanResponse>('/api/meals/confirm', {
    method: 'POST',
    body: JSON.stringify({ meals }),
  });
}

// ── Grocery ─────────────────────────────────────────────────
export interface GroceryAisle {
  name: string;
  emoji: string;
  items: { name: string; category: string; weight_g: number; aisle: string }[];
}

export interface GroceryListResponse {
  aisles: GroceryAisle[];
  total_items: number;
  sort_time_ms: number;
  engine: string;
  plan_id: number;
  week: string;
}

export async function getGroceryList(): Promise<GroceryListResponse> {
  return api<GroceryListResponse>('/api/grocery-list');
}

export async function saveGroceryCart(items: string[]): Promise<{ status: string }> {
  return api<{ status: string }>('/api/grocery-list/save', {
    method: 'POST',
    body: JSON.stringify({ cart_json: items }),
  });
}

export async function getSavedGroceryCart(): Promise<{ items: string[] }> {
  return api<{ items: string[] }>('/api/grocery-list/saved');
}

// ── Progress ────────────────────────────────────────────────
export interface MacroProgress {
  consumed: number;
  target: number;
  percentage: number;
  unit?: string;
}

export interface DailyProgress {
  date: string;
  calories: MacroProgress;
  protein: MacroProgress;
  carbs: MacroProgress;
  fat: MacroProgress;
  water_glasses: number;
  steps: number;
  meals_logged: number;
  total_meals: number;
}

export async function getTodayProgress(): Promise<DailyProgress> {
  return api<DailyProgress>('/api/progress/today');
}

export async function logWaterIntake(glasses: number): Promise<{ message: string, glasses: number }> {
  return api<{ message: string, glasses: number }>('/api/progress/water', {
    method: 'POST',
    body: JSON.stringify({ glasses }),
  });
}

export async function logSteps(steps: number): Promise<{ message: string, steps: number }> {
  return api<{ message: string, steps: number }>('/api/progress/steps', {
    method: 'POST',
    body: JSON.stringify({ steps }),
  });
}

