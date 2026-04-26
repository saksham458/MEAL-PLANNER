/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import WorkingQR from '@/components/WorkingQR';
import { useAuth } from '@/lib/auth-context';
import {
  getSettings,
  proposeMealPlan,
  confirmMealPlan,
  getTodayProgress,
  getGroceryList,
  saveGroceryCart,
  getSavedGroceryCart,
  logWaterIntake,
  logSteps,
  updateSettings,
  type Biometrics,
  type Meal,
  type ProposedMeal,
  type DailyProgress,
  type GroceryAisle,
} from '@/lib/api';

// ── Animation Variants ──────────────────────────────────────
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

// ── Types ───────────────────────────────────────────────────
interface MealsByDay {
  [day: number]: Meal[];
}

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const mealTypeIcons: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
};

// ── Sidebar Nav Items ───────────────────────────────────────
const navItems = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'meals', icon: '🍽️', label: 'Meal Plan' },
  { id: 'grocery', icon: '🛒', label: 'Grocery List' },
  { id: 'progress', icon: '📈', label: 'Progress' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();

  const [activeView, setActiveView] = useState('dashboard');
  const [bio, setBio] = useState<Biometrics | null>(null);
  const [meals, setMeals] = useState<MealsByDay>({});
  const [progress, setProgress] = useState<DailyProgress | null>(null);
  const [planMeta, setPlanMeta] = useState<{ week_start: string; week_end: string } | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isProposing, setIsProposing] = useState(false);
  const [proposedMeals, setProposedMeals] = useState<ProposedMeal[]>([]);
  const [selectedTempIds, setSelectedTempIds] = useState<Set<string>>(new Set());
  const [confirmingPlan, setConfirmingPlan] = useState(false);

  const [groceryAisles, setGroceryAisles] = useState<GroceryAisle[]>([]);
  const [checkedGroceryItems, setCheckedGroceryItems] = useState<Set<string>>(new Set());
  
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutTab, setCheckoutTab] = useState<'wallet' | 'upi' | 'card' | 'qr'>('qr');

  // ── Redirect if not authenticated ─────────────────────────
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth');
    }
  }, [isLoading, isAuthenticated, router]);

  // ── Load user data on mount ───────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const settings = await getSettings();
      if (settings.biometrics) setBio(settings.biometrics);
    } catch {
      // Use defaults
    }

    try {
      const prog = await getTodayProgress();
      setProgress(prog);
    } catch {
      // No progress data yet
    }

    try {
      const groceries = await getGroceryList();
      if (groceries.aisles) setGroceryAisles(groceries.aisles);
      const savedCart = await getSavedGroceryCart();
      if (savedCart.items) setCheckedGroceryItems(new Set(savedCart.items));
    } catch {
      // no grocery list available
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated, loadData]);

  // ── Generate & Confirm Meal Plan ──────────────────────────
  const handleGeneratePlan = async () => {
    setLoadingPlan(true);
    try {
      const proposal = await proposeMealPlan();
      setProposedMeals(proposal.meals);
      setSelectedTempIds(new Set(proposal.meals.map(m => m.temp_id)));
      setIsProposing(true);
    } catch (err) {
      console.error("Meal proposal failed, using fallback demo data:", err);
      // Show fallback data for demo
      const demoRecipes = [
        { label: 'Greek Yogurt Bowl', cal: 320, p: 18, c: 28, f: 14, type: 'breakfast', img: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&h=200&fit=crop&q=80' },
        { label: 'Grilled Chicken Salad', cal: 480, p: 42, c: 18, f: 22, type: 'lunch', img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=200&fit=crop&q=80' },
        { label: 'Salmon with Quinoa', cal: 520, p: 38, c: 42, f: 18, type: 'dinner', img: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=300&h=200&fit=crop&q=80' },
      ];
      const demoProposed: ProposedMeal[] = [];
      for (let d = 0; d < 7; d++) {
        for (let m = 0; m < 3; m++) {
          const rec = demoRecipes[m];
          demoProposed.push({
            temp_id: `temp_${d}_${rec.type}`,
            day_of_week: d,
            meal_type: rec.type,
            recipe_label: rec.label,
            recipe_image: rec.img,
            recipe_url: null,
            recipe_yield: 1,
            calories: rec.cal,
            protein_g: rec.p,
            carbs_g: rec.c,
            fat_g: rec.f,
            fiber_g: 5,
            ingredients_json: '[]', // Must be valid JSON string
            edamam_uri: `demo_${d}_${rec.type}`,
            is_high_protein: rec.p > 25
          });
        }
      }
      setProposedMeals(demoProposed);
      setSelectedTempIds(new Set(demoProposed.map(m => m.temp_id)));
      setIsProposing(true);
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleConfirmPlan = async () => {
    setConfirmingPlan(true);
    try {
      const selectedMealsToSave = proposedMeals.filter(m => selectedTempIds.has(m.temp_id));
      const confirmedPlan = await confirmMealPlan(selectedMealsToSave);
      
      const grouped: MealsByDay = {};
      confirmedPlan.meals.forEach((m) => {
        if (!grouped[m.day_of_week]) grouped[m.day_of_week] = [];
        grouped[m.day_of_week].push(m);
      });
      setMeals(grouped);
      setPlanMeta({ week_start: confirmedPlan.week_start, week_end: confirmedPlan.week_end });
      setIsProposing(false);
    } catch {
      alert("Failed to confirm plan");
    } finally {
      setConfirmingPlan(false);
    }
  };

  const toggleMealSelection = (tempId: string) => {
    setSelectedTempIds(prev => {
      const next = new Set(prev);
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });
  };

  // ── Grocery Cart Handlers ─────────────────────────────────
  const toggleGroceryItem = (itemName: string) => {
    setCheckedGroceryItems(prev => {
      const next = new Set(prev);
      if (next.has(itemName)) next.delete(itemName);
      else next.add(itemName);
      return next;
    });
  };

  const handleSaveCart = async () => {
    try {
      await saveGroceryCart(Array.from(checkedGroceryItems));
      alert("Cart saved securely to your profile!");
    } catch {
      alert("Failed to save cart.");
    }
  };

  const handleCancelCart = () => {
    setCheckedGroceryItems(new Set());
  };

  const checkoutTotal = Math.max(0, Array.from(checkedGroceryItems).length * 50); // Flat mock mapping

  // ── Progress Handlers ─────────────────────────────────────
  const handleLogWater = async (glasses: number) => {
    // Optimistic UI update
    if (progress) setProgress({ ...progress, water_glasses: glasses });
    try {
      await logWaterIntake(glasses);
    } catch {
      alert("Failed to log water");
    }
  };

  const handleLogSteps = async (steps: number) => {
    // Optimistic UI update
    if (progress) setProgress({ ...progress, steps });
    try {
      await logSteps(steps);
    } catch {
      alert("Failed to log steps");
    }
  };

  // ── Settings Handlers ─────────────────────────────────────
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const handleUpdateSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    const formData = new FormData(e.currentTarget);
    const updates = {
      age: Number(formData.get('age')),
      weight_kg: Number(formData.get('weight_kg')),
      height_cm: Number(formData.get('height_cm')),
      activity_level: formData.get('activity_level') as string,
      dietary_goal: formData.get('dietary_goal') as string,
    };
    try {
      const res = await updateSettings(updates);
      setBio(res.biometrics);
      alert('Settings updated securely!');
    } catch {
      alert('Failed to update settings.');
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  // ── Macro Ring SVG ────────────────────────────────────────
  const MacroRing = ({ value, max, color, label, size = 110, stroke = 8 }: {
    value: number; max: number; color: string; label: string; size?: number; stroke?: number;
  }) => {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const pct = Math.min(value / max, 1);
    const offset = circumference - circumference * pct;

    return (
      <div className="flex flex-col items-center gap-2">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--slate-100)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        <div className="text-center" style={{ marginTop: -size / 2 - 16 }}>
          <div className="text-xl font-bold" style={{ color }}>{value}</div>
          <div className="text-xs font-medium" style={{ color: 'var(--slate-400)' }}>/ {max}g</div>
        </div>
        <div className="text-xs font-semibold mt-6" style={{ color: 'var(--slate-600)' }}>{label}</div>
      </div>
    );
  };

  // ── Loading state ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--slate-50)' }}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-emerald flex items-center justify-center animate-pulse-glow">
            <span className="text-2xl">🥗</span>
          </div>
          <p style={{ color: 'var(--slate-400)' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Greeting ──────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const initials = ((user?.first_name?.[0] || '') + '').toUpperCase();

  const calories = bio?.daily_calories || 2200;
  const protein = bio?.daily_protein_g || 165;
  const carbs = bio?.daily_carbs_g || 220;
  const fat = bio?.daily_fat_g || 73;

  const consumedCal = progress?.consumed_calories || 0;
  const consumedP = progress?.consumed_protein_g || 0;
  const consumedC = progress?.consumed_carbs_g || 0;
  const consumedF = progress?.consumed_fat_g || 0;

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--slate-50)' }}>
      {/* ── Sidebar ──────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <motion.aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-72 z-50 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <div className="px-6 py-6 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #059669, #34d399)',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
            }}
          >
            <span className="text-lg">🥗</span>
          </div>
          <span className="text-lg font-extrabold text-white">SmartMeal</span>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveView(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                activeView === item.id ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              style={activeView === item.id ? {
                background: 'linear-gradient(135deg, rgba(5,150,105,0.25), rgba(5,150,105,0.1))',
                border: '1px solid rgba(52,211,153,0.2)',
              } : { background: 'transparent', border: '1px solid transparent' }}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User Info */}
        <div className="px-4 py-4 border-t border-white/8">
          <div className="flex items-center gap-3 px-4 py-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}
            >
              {initials || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.first_name || 'User'}</p>
              <p className="text-xs truncate" style={{ color: 'var(--slate-400)' }}>{user?.email}</p>
            </div>
            <button
              onClick={() => { logout(); router.replace('/auth'); }}
              className="text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
              title="Logout"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </motion.aside>

      {/* ── Main Content ─────────────────────────────────── */}
      <main className="flex-1 min-h-screen overflow-y-auto">
        {/* Top Bar (mobile) */}
        <div className="lg:hidden sticky top-0 z-30 glass px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-black/5 cursor-pointer">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold" style={{ color: 'var(--slate-900)' }}>SmartMeal</span>
          <div className="w-8 h-8 rounded-full gradient-emerald flex items-center justify-center text-white text-xs font-bold">
            {initials || 'U'}
          </div>
        </div>

        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
          {/* ── Dashboard View ───────────────────────────── */}
          {activeView === 'dashboard' && (
            <motion.div variants={stagger} initial="initial" animate="animate">
              {/* Greeting */}
              <motion.div variants={fadeUp} className="mb-8">
                <h1 className="text-3xl font-extrabold mb-1" style={{ color: 'var(--slate-900)' }}>
                  {greeting}, {user?.first_name || 'there'} 👋
                </h1>
                <p style={{ color: 'var(--slate-400)' }}>Here&apos;s your nutrition overview for today</p>
              </motion.div>

              {/* Macro Overview Bento Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                {/* Calories Card */}
                <motion.div variants={fadeUp} className="bento-card col-span-1 md:col-span-2 xl:col-span-1">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold" style={{ color: 'var(--slate-400)' }}>Daily Calories</span>
                    <span className="text-lg">🔥</span>
                  </div>
                  <div className="text-4xl font-black mb-1" style={{ color: 'var(--slate-900)' }}>
                    {consumedCal.toLocaleString()}
                  </div>
                  <p className="text-sm" style={{ color: 'var(--slate-400)' }}>/ {calories.toLocaleString()} kcal</p>
                  <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: 'var(--slate-100)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #059669, #34d399)' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((consumedCal / calories) * 100, 100)}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  </div>
                </motion.div>

                {/* Protein Ring */}
                <motion.div variants={fadeUp} className="bento-card flex items-center justify-center py-6">
                  <MacroRing value={consumedP} max={protein} color="#059669" label="Protein" />
                </motion.div>

                {/* Carbs Ring */}
                <motion.div variants={fadeUp} className="bento-card flex items-center justify-center py-6">
                  <MacroRing value={consumedC} max={carbs} color="#f59e0b" label="Carbs" />
                </motion.div>

                {/* Fat Ring */}
                <motion.div variants={fadeUp} className="bento-card flex items-center justify-center py-6">
                  <MacroRing value={consumedF} max={fat} color="#8b5cf6" label="Fat" />
                </motion.div>
              </div>

              {/* Quick Actions */}
              <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setActiveView('meals'); handleGeneratePlan(); }}
                  className="bento-card flex items-center gap-4 cursor-pointer text-left"
                  style={{ border: '2px solid rgba(5,150,105,0.15)' }}
                >
                  <div className="w-12 h-12 rounded-xl gradient-emerald flex items-center justify-center text-xl">🍽️</div>
                  <div>
                    <p className="font-bold" style={{ color: 'var(--slate-900)' }}>Generate Meal Plan</p>
                    <p className="text-xs" style={{ color: 'var(--slate-400)' }}>AI-powered 7-day plan</p>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveView('grocery')}
                  className="bento-card flex items-center gap-4 cursor-pointer text-left"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(245,158,11,0.1)' }}>🛒</div>
                  <div>
                    <p className="font-bold" style={{ color: 'var(--slate-900)' }}>Grocery List</p>
                    <p className="text-xs" style={{ color: 'var(--slate-400)' }}>C-engine sorted by aisle</p>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveView('progress')}
                  className="bento-card flex items-center gap-4 cursor-pointer text-left"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(139,92,246,0.1)' }}>📈</div>
                  <div>
                    <p className="font-bold" style={{ color: 'var(--slate-900)' }}>Daily Progress</p>
                    <p className="text-xs" style={{ color: 'var(--slate-400)' }}>Track water, steps, meals</p>
                  </div>
                </motion.button>
              </motion.div>

              {/* Today's Targets */}
              <motion.div variants={fadeUp} className="bento-card">
                <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--slate-900)' }}>Your Daily Targets</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Calories', val: `${calories.toLocaleString()} kcal`, icon: '🔥', color: '#059669' },
                    { label: 'Protein', val: `${protein}g`, icon: '💪', color: '#059669' },
                    { label: 'Carbs', val: `${carbs}g`, icon: '🌾', color: '#f59e0b' },
                    { label: 'Fat', val: `${fat}g`, icon: '🥑', color: '#8b5cf6' },
                  ].map((t, i) => (
                    <div key={i} className="p-4 rounded-xl text-center" style={{ background: 'var(--slate-50)' }}>
                      <span className="text-2xl block mb-2">{t.icon}</span>
                      <p className="text-xl font-extrabold" style={{ color: t.color }}>{t.val}</p>
                      <p className="text-xs font-medium mt-1" style={{ color: 'var(--slate-400)' }}>{t.label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ── Meals View ───────────────────────────────── */}
          {activeView === 'meals' && (
            <motion.div variants={stagger} initial="initial" animate="animate">
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h1 className="text-3xl font-extrabold mb-1" style={{ color: 'var(--slate-900)' }}>
                    {isProposing ? '✨ Proposed Meal Plan' : '🍽️ Weekly Meal Plan'}
                  </h1>
                  {planMeta && !isProposing && (
                    <p style={{ color: 'var(--slate-400)' }}>{planMeta.week_start} — {planMeta.week_end}</p>
                  )}
                  {isProposing && (
                    <p style={{ color: 'var(--emerald)' }} className="font-medium">
                      Select the dishes you want to keep. Swap or deselect the rest!
                    </p>
                  )}
                </div>
                {!isProposing && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="btn-primary shrink-0"
                    onClick={handleGeneratePlan}
                    disabled={loadingPlan}
                  >
                    {loadingPlan ? 'Generating...' : '✨ Create New Plan'}
                  </motion.button>
                )}
              </motion.div>

              {/* ── Active Plan (Not Proposing) ── */}
              {!isProposing && Object.keys(meals).length === 0 ? (
                <motion.div variants={fadeUp} className="bento-card text-center py-20">
                  <span className="text-6xl block mb-6">🥗</span>
                  <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--slate-900)' }}>No meal plan yet</h3>
                  <p className="mb-6" style={{ color: 'var(--slate-400)' }}>
                    Generate an AI-powered plan based on your unique biometrics and targets.
                  </p>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn-primary" onClick={handleGeneratePlan} disabled={loadingPlan}>
                    {loadingPlan ? 'Generating...' : '✨ Generate My Plan'}
                  </motion.button>
                </motion.div>
              ) : !isProposing ? (
                // Active Plan Grid
                <div className="space-y-6">
                  {dayNames.map((day, idx) => {
                    const dayMeals = meals[idx] || [];
                    if (dayMeals.length === 0) return null;
                    return (
                      <motion.div key={idx} variants={fadeUp} className="bento-card">
                        <div className="flex items-center gap-3 mb-5">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white"
                            style={{ background: 'linear-gradient(135deg, #059669, #34d399)' }}
                          >
                            {day.slice(0, 2)}
                          </div>
                          <h3 className="text-lg font-bold" style={{ color: 'var(--slate-900)' }}>{day}</h3>
                          <span className="ml-auto text-sm font-medium px-3 py-1 rounded-full" style={{ background: 'var(--slate-100)', color: 'var(--slate-500)' }}>
                            {dayMeals.reduce((s, m) => s + m.calories, 0)} kcal
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {dayMeals.map((meal) => (
                            <motion.div
                              key={meal.id}
                              whileHover={{ y: -3, boxShadow: '0 12px 30px rgba(0,0,0,0.1)' }}
                              className="rounded-xl overflow-hidden border transition-all"
                              style={{ borderColor: 'var(--slate-200)', background: 'white' }}
                            >
                              {meal.recipe_image && (
                                <div className="h-36 overflow-hidden">
                                  <img src={meal.recipe_image} alt={meal.recipe_label} className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
                                </div>
                              )}
                              <div className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm">{mealTypeIcons[meal.meal_type] || '🍽️'}</span>
                                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--emerald)' }}>{meal.meal_type}</span>
                                </div>
                                <h4 className="font-bold text-sm mb-3 leading-snug" style={{ color: 'var(--slate-900)' }}>{meal.recipe_label}</h4>
                                <div className="flex items-center gap-3 text-xs font-medium" style={{ color: 'var(--slate-400)' }}>
                                  <span>🔥 {meal.calories}</span><span>💪 {meal.protein_g}g</span><span>🌾 {meal.carbs_g}g</span><span>🥑 {meal.fat_g}g</span>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : null}

              {/* ── Proposal Plan (Interactive Selection) ── */}
              {isProposing && (
                <div className="space-y-6 pb-24">
                  {dayNames.map((day, dIdx) => {
                    const dayMeals = proposedMeals.filter(m => m.day_of_week === dIdx);
                    if (dayMeals.length === 0) return null;
                    return (
                      <motion.div key={dIdx} variants={fadeUp} className="bento-card">
                        <div className="flex items-center gap-3 mb-5">
                          <h3 className="text-lg font-bold" style={{ color: 'var(--slate-900)' }}>{day}</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {dayMeals.map((meal) => {
                            const isSelected = selectedTempIds.has(meal.temp_id);
                            return (
                              <motion.div
                                key={meal.temp_id}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => toggleMealSelection(meal.temp_id)}
                                className="rounded-xl overflow-hidden border-2 cursor-pointer transition-all relative group"
                                style={{
                                  borderColor: isSelected ? 'var(--emerald)' : 'transparent',
                                  background: isSelected ? 'white' : 'var(--slate-100)',
                                  opacity: isSelected ? 1 : 0.6,
                                  boxShadow: isSelected ? '0 10px 25px rgba(5,150,105,0.15)' : 'none'
                                }}
                              >
                                {isSelected && (
                                  <div className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full gradient-emerald flex items-center justify-center text-white shadow-md">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                  </div>
                                )}
                                {meal.recipe_image && (
                                  <div className="h-36 overflow-hidden">
                                    <img src={meal.recipe_image} alt={meal.recipe_label} className={`w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'group-hover:scale-110' : 'grayscale'}`} />
                                  </div>
                                )}
                                <div className="p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">{mealTypeIcons[meal.meal_type] || '🍽️'}</span>
                                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--emerald)' }}>{meal.meal_type}</span>
                                    </div>
                                    {!isSelected && <span className="text-xs font-bold text-slate-400">Skipped</span>}
                                  </div>
                                  <h4 className="font-bold text-sm mb-3 leading-snug" style={{ color: 'var(--slate-900)' }}>{meal.recipe_label}</h4>
                                  <div className="flex items-center gap-3 text-xs font-medium" style={{ color: 'var(--slate-400)' }}>
                                    <span>🔥 {meal.calories}</span><span>💪 {meal.protein_g}g</span><span>🌾 {meal.carbs_g}g</span><span>🥑 {meal.fat_g}g</span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  })}
                  
                  {/* Floating Action Bar */}
                  <motion.div 
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    className="fixed bottom-0 left-0 lg:left-72 right-0 p-4 z-40"
                  >
                    <div className="max-w-4xl mx-auto glass rounded-2xl shadow-2xl p-4 flex items-center justify-between border border-emerald-100/30">
                      <div className="hidden sm:block">
                        <p className="font-bold text-emerald-900">{selectedTempIds.size} / 21 Meals Selected</p>
                        <p className="text-xs text-emerald-700">Deselected meals will be skipped tracking.</p>
                      </div>
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button 
                          onClick={handleGeneratePlan}
                          disabled={confirmingPlan || loadingPlan}
                          className="flex-1 sm:flex-none px-4 py-3 rounded-xl font-bold text-sm bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-colors"
                        >
                          🔄 Regenerate All
                        </button>
                        <button 
                          onClick={handleConfirmPlan}
                          disabled={selectedTempIds.size === 0 || confirmingPlan}
                          className="flex-1 sm:flex-none btn-primary shadow-emerald-500/30"
                        >
                          {confirmingPlan ? 'Saving...' : '✅ Confirm Final Plan'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Grocery View ───────────────────────────────── */}
          {activeView === 'grocery' && (
            <motion.div variants={stagger} initial="initial" animate="animate">
              <motion.div variants={fadeUp} className="mb-8">
                <h1 className="text-3xl font-extrabold mb-1" style={{ color: 'var(--slate-900)' }}>
                  🛒 Smart Grocery List
                </h1>
                <p style={{ color: 'var(--slate-400)' }}>Sorted with C-Engine algorithm by Supermarket Aisle</p>
              </motion.div>

              {groceryAisles.length === 0 ? (
                <motion.div variants={fadeUp} className="bento-card text-center py-20">
                   <h3 className="text-xl font-bold mb-2">No items found</h3>
                   <p className="text-slate-400">Generate a meal plan first to populate your cart.</p>
                </motion.div>
              ) : (
                <div className="space-y-6 pb-24">
                  {groceryAisles.map((aisle, idx) => (
                    <motion.div key={idx} variants={fadeUp} className="bento-card">
                      <div className="flex items-center gap-3 mb-5 border-b pb-3" style={{ borderColor: 'var(--slate-200)' }}>
                        <span className="text-2xl">{aisle.emoji}</span>
                        <h3 className="text-lg font-bold" style={{ color: 'var(--slate-900)' }}>{aisle.name} Aisle</h3>
                        <span className="ml-auto text-sm font-medium px-3 py-1 bg-slate-100 text-slate-500 rounded-full">
                          {aisle.items.length} items
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {aisle.items.map((item, itemIdx) => {
                          const isChecked = checkedGroceryItems.has(item.name);
                          return (
                            <div 
                              key={itemIdx} 
                              onClick={() => toggleGroceryItem(item.name)}
                              className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-slate-50 transition-all"
                              style={{ 
                                borderColor: isChecked ? 'var(--emerald)' : 'var(--slate-200)',
                                background: isChecked ? 'rgba(5, 150, 105, 0.05)' : 'white'
                              }}
                            >
                              <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${isChecked ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                                {isChecked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold truncate ${isChecked ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{item.name}</p>
                                <p className="text-xs text-slate-400">{item.weight_g.toFixed(0)}g • {item.category}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}

                  {/* Fixed Cart Footer */}
                  <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-0 left-0 lg:left-72 right-0 p-4 z-40">
                    <div className="max-w-5xl mx-auto glass rounded-2xl shadow-2xl p-4 flex flex-col sm:flex-row items-center justify-between border border-slate-200 gap-4">
                      
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm border border-slate-100">
                          🛍️
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{checkedGroceryItems.size} <span className="text-slate-500 font-medium whitespace-nowrap">Items Selected</span></p>
                          <p className="text-xs text-slate-400">Fixed rate mapping applied</p>
                        </div>
                      </div>

                      <div className="flex w-full sm:w-auto items-center gap-3">
                        <button onClick={handleCancelCart} disabled={checkedGroceryItems.size === 0} className="px-4 py-3 rounded-xl font-bold text-sm bg-white text-rose-500 border border-slate-200 hover:bg-rose-50 transition-colors disabled:opacity-50">
                          ✕ Cancel
                        </button>
                        <button onClick={handleSaveCart} disabled={checkedGroceryItems.size === 0} className="px-4 py-3 rounded-xl font-bold text-sm bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50">
                          💾 Buy Later
                        </button>
                        <button onClick={() => setIsCheckoutOpen(true)} disabled={checkedGroceryItems.size === 0} className="flex-1 sm:flex-none btn-primary flex items-center gap-2 justify-center">
                          <span>💳 Buy</span>
                          <span className="bg-white/20 px-2 py-0.5 rounded text-xs">₹{checkoutTotal}</span>
                        </button>
                      </div>

                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Progress & Tracking View ───────────────────── */}
          {activeView === 'progress' && (
            <motion.div variants={stagger} initial="initial" animate="animate">
              <motion.div variants={fadeUp} className="mb-8">
                <h1 className="text-3xl font-extrabold mb-1" style={{ color: 'var(--slate-900)' }}>
                  📈 Daily Progress
                </h1>
                <p style={{ color: 'var(--slate-400)' }}>Track your macros, water, and activity</p>
              </motion.div>

              {!progress || (progress.calories.consumed === 0 && progress.water_glasses === 0 && progress.steps === 0) ? (
                <motion.div variants={fadeUp} className="bento-card text-center p-12 lg:p-20 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #0f766e, #059669)', color: 'white' }}>
                  <div className="relative z-10 max-w-lg mx-auto">
                    <span className="text-7xl block mb-6 drop-shadow-lg">🚀</span>
                    <h2 className="text-4xl font-black mb-4">Day 1: Zero to Hero</h2>
                    <p className="text-lg opacity-90 mb-8 font-medium">Every grand journey starts with a single step. Or a single glass of water.</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button onClick={() => setActiveView('meals')} className="px-6 py-3 rounded-xl font-bold bg-white text-emerald-700 hover:scale-105 transition-transform shadow-xl">
                        🍽️ Log First Meal
                      </button>
                      <button onClick={() => handleLogWater(1)} className="px-6 py-3 rounded-xl font-bold bg-emerald-800 text-white hover:bg-emerald-900 transition-colors border border-emerald-600/50">
                        💧 +1 Glass of Water
                      </button>
                    </div>
                  </div>
                  {/* Decorative background elements */}
                  <div className="absolute top-[-20%] left-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-black/10 rounded-full blur-3xl pointer-events-none" />
                </motion.div>
              ) : (
                <div className="space-y-6">
                  {/* Macros 2x2 Grid */}
                  <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { icon: '🔥', label: 'Calories', ...progress.calories, color: '#059669' },
                      { icon: '💪', label: 'Protein', ...progress.protein, color: '#34d399' },
                      { icon: '🌾', label: 'Carbs', ...progress.carbs, color: '#f59e0b' },
                      { icon: '🥑', label: 'Fat', ...progress.fat, color: '#8b5cf6' },
                    ].map((macro, idx) => (
                      <div key={idx} className="bento-card text-center flex flex-col items-center justify-center relative overflow-hidden group">
                        <div className="mb-2 text-xl">{macro.icon}</div>
                        <MacroRing value={macro.consumed} max={macro.target} color={macro.color} label={macro.label} size={110} stroke={10} />
                        <div className="mt-4">
                          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--slate-400)' }}>{macro.label}</p>
                          <p className="text-sm font-semibold" style={{ color: 'var(--slate-900)' }}>{macro.consumed.toFixed(0)} <span className="text-xs text-slate-400">/ {macro.target.toFixed(0)}{macro.unit || 'g'}</span></p>
                        </div>
                      </div>
                    ))}
                  </motion.div>

                  {/* Supplemental Trackers Grid */}
                  <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bento-card flex flex-col justify-between" style={{ background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-sky-900">Hydration</h3>
                        <span className="text-2xl">💧</span>
                      </div>
                      <div className="mb-6">
                        <p className="text-4xl font-black text-sky-700 mb-1">{progress.water_glasses} <span className="text-lg font-medium text-sky-600 opacity-80">/ 8</span></p>
                        <p className="text-sm font-bold text-sky-600/70">Glasses of Water</p>
                      </div>
                      <button onClick={() => handleLogWater(progress.water_glasses + 1)} className="w-full py-3 rounded-xl font-bold bg-white text-sky-600 hover:bg-sky-50 transition-colors shadow-sm">
                        +1 Glass
                      </button>
                    </div>

                    <div className="bento-card flex flex-col justify-between" style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-amber-900">Activity</h3>
                        <span className="text-2xl">👟</span>
                      </div>
                      <div className="mb-6">
                        <p className="text-4xl font-black text-amber-700 mb-1">{progress.steps.toLocaleString()} <span className="text-lg font-medium text-amber-600 opacity-80">/ 10,000</span></p>
                        <p className="text-sm font-bold text-amber-600/70">Daily Steps</p>
                      </div>
                      <button onClick={() => handleLogSteps(progress.steps + 1000)} className="w-full py-3 rounded-xl font-bold bg-white text-amber-600 hover:bg-amber-50 transition-colors shadow-sm">
                        +1000 Steps
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Settings View ────────────────────────────── */}
          {activeView === 'settings' && bio && (
            <motion.div variants={stagger} initial="initial" animate="animate">
              <motion.div variants={fadeUp} className="mb-8 border-b pb-6" style={{ borderColor: 'var(--slate-200)' }}>
                <h1 className="text-3xl font-extrabold mb-1" style={{ color: 'var(--slate-900)' }}>⚙️ Dashboard Settings</h1>
                <p style={{ color: 'var(--slate-400)' }}>Manage your personal biometrics securely.</p>
              </motion.div>

              <motion.div variants={fadeUp} className="max-w-2xl">
                <form onSubmit={handleUpdateSettings} className="bento-card relative overflow-hidden">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 rounded-full gradient-emerald text-white flex items-center justify-center text-2xl font-black shadow-lg">
                      {user?.email?.[0].toUpperCase() || 'U'}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold" style={{ color: 'var(--slate-900)' }}>{user?.email}</h2>
                      <p className="text-sm px-2 py-0.5 mt-1 inline-block bg-slate-100 text-slate-500 rounded font-bold uppercase">{bio.activity_level}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 border-y py-6 border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Age</label>
                      <input type="number" name="age" defaultValue={bio.age} required className="w-full form-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Weight (kg)</label>
                      <input type="number" step="0.1" name="weight_kg" defaultValue={bio.weight_kg} required className="w-full form-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Height (cm)</label>
                      <input type="number" step="0.1" name="height_cm" defaultValue={bio.height_cm} required className="w-full form-input" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Dietary Goal</label>
                      <select name="dietary_goal" defaultValue={bio.dietary_goal} className="w-full form-input">
                        <option value="lose">Lose Weight</option>
                        <option value="maintain">Maintain Weight</option>
                        <option value="gain">Gain Muscle</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Activity Level</label>
                      <select name="activity_level" defaultValue={bio.activity_level} className="w-full form-input">
                        <option value="sedentary">Sedentary</option>
                        <option value="moderate">Moderate</option>
                        <option value="active">Active</option>
                        <option value="very_active">Very Active</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-8">
                    <button type="submit" disabled={isUpdatingSettings} className="btn-primary w-full sm:w-auto shadow-emerald-500/30">
                      {isUpdatingSettings ? 'Recalculating...' : '✓ Update Biometrics'}
                    </button>
                  </div>
                  
                  {/* Decorative Elements */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full -z-10" />
                </form>
              </motion.div>
            </motion.div>
          )}

          {/* ── UI MODALS ─────────────────────────────── */}
          {isCheckoutOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsCheckoutOpen(false)} />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col"
              >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">Checkout</h3>
                    <p className="text-sm text-slate-500">{checkedGroceryItems.size} items securely encrypted</p>
                  </div>
                  <button onClick={() => setIsCheckoutOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                    ✕
                  </button>
                </div>

                {/* Amount Highlight */}
                <div className="bg-slate-50 px-6 py-6 text-center border-b border-slate-100">
                  <p className="text-sm font-bold text-slate-400 mb-1 tracking-widest uppercase">Amount Payable</p>
                  <h2 className="text-5xl font-black text-slate-900 tracking-tight">₹{checkoutTotal}</h2>
                </div>

                <div className="flex bg-slate-100 p-2 gap-1 m-6 mb-2 rounded-xl">
                  {['wallet', 'upi', 'card', 'qr'].map(tab => (
                    <button 
                      key={tab}
                      onClick={() => setCheckoutTab(tab as 'wallet' | 'upi' | 'card' | 'qr')}
                      className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-colors ${checkoutTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="p-6 mb-4 min-h-[300px] flex items-center justify-center bg-white">
                  {checkoutTab === 'qr' ? (
                    <div className="text-center w-full max-w-[280px]">
                      <div className="p-4 bg-white border-2 border-slate-100 rounded-3xl mb-4 shadow-sm inline-block">
                        <WorkingQR 
                          payeeVpa="merchant@razorpay" 
                          payeeName="SmartMeal Provider" 
                          amount={checkoutTotal} 
                          transactionNote="SmartMeal Grocery Delivery"
                        />
                      </div>
                      <p className="text-sm font-bold text-slate-700">Scan with any UPI App</p>
                      <p className="text-xs text-slate-400 mt-1">GPay, PhonePe, Paytm supported</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <span className="text-4xl mb-4 block opacity-50">🔒</span>
                      <h4 className="font-bold text-slate-900 mb-1">Coming Soon</h4>
                      <p className="text-sm text-slate-500">Only QR scanning is currently live in this environment.</p>
                    </div>
                  )}
                </div>

                {/* Secure Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  <p className="text-xs font-bold text-slate-500">Secured by Razorpay Encryption</p>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
