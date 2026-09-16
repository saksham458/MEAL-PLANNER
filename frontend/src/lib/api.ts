/**
 * SmartMeal API Client
 * Fetches real data from the Next.js API Routes.
 */

const API_BASE = '/api';

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

  const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('smartmeal_token') : null);
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  } catch (err) {
    console.error(`🔴 Network Error: Failed to fetch ${API_BASE}${path}.`, err);
    throw new ApiError(503, "Could not connect to the API server.");
  }

  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

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
  return api<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export async function registerUser(email: string, password: string, firstName: string, lastName: string = ''): Promise<AuthResponse> {
  return api<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName }) });
}

// ── Settings / Biometrics ───────────────────────────────────
export interface Biometrics {
  gender: string; age: number; height_cm: number; weight_kg: number;
  activity_level: string; daily_calories: number; daily_protein_g: number;
  daily_carbs_g: number; daily_fat_g: number; dietary_goal: string;
}

export interface SettingsResponse {
  user: { id: number; email: string; first_name: string; last_name: string; };
  biometrics: Biometrics;
}

export async function getSettings(): Promise<SettingsResponse> {
  return api<SettingsResponse>('/profile');
}

export async function updateSettings(data: Partial<Biometrics>): Promise<SettingsResponse> {
  return api<SettingsResponse>('/profile', { method: 'POST', body: JSON.stringify(data) });
}

// ── Meals ───────────────────────────────────────────────────
export interface MealIngredient {
  name: string;
  amount: number;
  unit: string;
  category?: string;
}

export interface MealOption {
  option_id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  ingredients: MealIngredient[];
  is_logged?: boolean;
}

export interface MealTimestamp {
  type: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  options: MealOption[];
}

export interface DailyPlan {
  day_of_week: string; // 'Monday', 'Tuesday', etc.
  timestamps: MealTimestamp[];
}

export interface WeeklyProposedPlan {
  days: DailyPlan[];
}

export async function proposeMealPlan(preferences?: string): Promise<WeeklyProposedPlan> {
  return api<WeeklyProposedPlan>('/meals/propose', {
    method: 'POST',
    body: JSON.stringify({ dietary_preferences: preferences }),
  });
}

export async function confirmMealPlan(plan: WeeklyProposedPlan): Promise<{ status: string }> {
  return api<{ status: string }>('/meals/confirm', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
}

// Aliases for compatibility
export type Meal = MealOption;
export type ProposedMealPlan = WeeklyProposedPlan;

export interface GroceryItem {
  name: string;
  category: string;
  weight_g: number;
  aisle: string;
}

// ── Grocery ─────────────────────────────────────────────────
export interface GroceryAisle {
  name: string;
  emoji: string;
  items: GroceryItem[];
}

export interface GroceryListResponse {
  aisles: GroceryAisle[];
}

export async function getGroceryList(): Promise<GroceryListResponse> {
  return api<GroceryListResponse>('/grocery-list');
}

export async function saveGroceryCart(items: string[]): Promise<{ status: string }> {
  return api<{ status: string }>('/grocery-list/save', { method: 'POST', body: JSON.stringify({ cart_json: items }) });
}

export async function getSavedGroceryCart(): Promise<{ items: string[] }> {
  return api<{ items: string[] }>('/grocery-list/saved');
}

// ── Progress ────────────────────────────────────────────────
export interface MacroProgress {
  consumed: number; target: number; percentage: number; unit?: string;
}

export interface DailyProgress {
  date: string;
  consumed_calories: number;
  consumed_protein_g: number;
  consumed_carbs_g: number;
  consumed_fat_g: number;
  water_glasses: number; steps: number; meals_logged: number; total_meals: number;
}

export async function getTodayProgress(): Promise<DailyProgress> {
  return api<DailyProgress>('/progress/today');
}

export async function logWaterIntake(glasses: number): Promise<{ message: string, glasses: number }> {
  return api<{ message: string, glasses: number }>('/progress/water', { method: 'POST', body: JSON.stringify({ glasses }) });
}

export async function logSteps(steps: number): Promise<{ message: string, steps: number }> {
  return api<{ message: string, steps: number }>('/progress/steps', { method: 'POST', body: JSON.stringify({ steps }) });
}

export async function logMeal(mealId: string | number): Promise<{ message: string }> {
  return api<{ message: string }>('/progress/meal', { method: 'POST', body: JSON.stringify({ mealId }) });
}
