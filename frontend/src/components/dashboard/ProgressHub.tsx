import { useState } from "react";
import { useProgress } from "@/lib/progress-context";
import { Activity, Droplets, Flame, FlameKindling, Zap } from "lucide-react";
import { motion } from "framer-motion";

function CircularProgress({ 
  value, 
  max, 
  color, 
  label, 
  unit 
}: { 
  value: number; 
  max: number; 
  color: string; 
  label: string; 
  unit: string 
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24 flex items-center justify-center mb-3">
        <svg className="w-full h-full -rotate-90 transform">
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-slate-100 dark:text-slate-800"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke={color}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-extrabold text-slate-900 dark:text-white">
            {Math.round(value)}
          </span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {unit}
          </span>
        </div>
      </div>
      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}

export function ProgressHub({ user, bio }: { user: any, bio: any }) {
  const { dailyProgress, updateDailyProgress, selectedMeals, streak } = useProgress();
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityInput, setActivityInput] = useState("");

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Targets from bio
  const targetCalories = bio?.daily_calories || 2200;
  const targetProtein = bio?.daily_protein_g || 165;
  const targetCarbs = bio?.daily_carbs_g || 220;
  const targetFat = bio?.daily_fat_g || 73;

  // Hydration logic
  const handleHydrationClick = (index: number) => {
    updateDailyProgress({ water_glasses: index + 1 });
  };

  // Activity Logic
  const handleActivitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(activityInput, 10);
    if (!isNaN(val)) {
      updateDailyProgress({ active_calories: dailyProgress.active_calories + val });
    }
    setActivityInput("");
    setShowActivityModal(false);
  };

  // Today's schedule
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayName = days[new Date().getDay()];
  const todaysMeals = selectedMeals[todayName] || {};
  const timestamps = ["Breakfast", "Lunch", "Snacks", "Dinner"];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-slate-950 text-white p-8 lg:p-12 shadow-sm border border-slate-800">
        <img 
          src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80" 
          alt="Healthy Food" 
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent" />
        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4 border border-emerald-500/20">
            <FlameKindling className="w-4 h-4" />
            {streak} Day Streak
          </div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-2">
            {greeting}, <span className="text-emerald-400">{user?.first_name || "Athlete"}</span>.
          </h1>
          <p className="text-slate-300 font-medium leading-relaxed">
            Stay on track. Here is your biometric progress for today based on your custom targets.
          </p>
        </div>
      </div>

      {/* Macros Circular Progress */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex justify-center">
          <CircularProgress value={dailyProgress.consumed_calories} max={targetCalories} color="#f97316" label="Calories" unit="kcal" />
        </div>
        <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex justify-center">
          <CircularProgress value={dailyProgress.consumed_protein_g} max={targetProtein} color="#10b981" label="Protein" unit="g" />
        </div>
        <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex justify-center">
          <CircularProgress value={dailyProgress.consumed_carbs_g} max={targetCarbs} color="#eab308" label="Carbs" unit="g" />
        </div>
        <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex justify-center">
          <CircularProgress value={dailyProgress.consumed_fat_g} max={targetFat} color="#a855f7" label="Fat" unit="g" />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Today's Schedule */}
        <div className="lg:col-span-2 bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-extrabold text-slate-900 dark:text-white">Today's Schedule</h3>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{todayName}</span>
          </div>
          <div className="space-y-4">
            {timestamps.map(ts => {
              const meal = todaysMeals[ts];
              return (
                <div key={ts} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <div className="w-16 text-xs font-bold text-slate-500 uppercase tracking-widest">{ts}</div>
                  {meal ? (
                    <div className="flex-1 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{meal.name}</p>
                        <p className="text-xs text-slate-500 font-medium">{meal.calories} kcal • {meal.protein}g P</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 text-sm text-slate-400 italic">No meal selected</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Side widgets: Hydration & Activity */}
        <div className="space-y-6">
          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Droplets className="w-5 h-5 text-blue-500" />
              <h3 className="font-extrabold text-slate-900 dark:text-white">Hydration</h3>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleHydrationClick(i)}
                  className={`w-full aspect-square rounded-xl transition-all ${
                    i < dailyProgress.water_glasses
                      ? "bg-blue-500 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  }`}
                >
                  <Droplets className="w-5 h-5 mx-auto" />
                </button>
              ))}
            </div>
            <p className="text-center mt-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
              {dailyProgress.water_glasses} / 8 Glasses
            </p>
          </div>

          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-citrus" />
                <h3 className="font-extrabold text-slate-900 dark:text-white">Activity</h3>
              </div>
              <button 
                onClick={() => setShowActivityModal(true)}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                + ADD
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {dailyProgress.active_calories}
              </span>
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-widest">kcal burned</span>
            </div>
          </div>
        </div>
      </div>

      {showActivityModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="p-6">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-4">Log Activity</h3>
              <form onSubmit={handleActivitySubmit}>
                <input
                  type="number"
                  value={activityInput}
                  onChange={(e) => setActivityInput(e.target.value)}
                  placeholder="Calories burned (kcal)"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl mb-4 font-semibold outline-none"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowActivityModal(false)} className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700">Save</button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
