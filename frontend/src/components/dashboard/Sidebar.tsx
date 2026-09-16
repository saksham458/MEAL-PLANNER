import Link from "next/link";
import { Utensils, LayoutDashboard, CalendarDays, ShoppingCart, Activity, Settings, Crown } from "lucide-react";

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Progress Hub", icon: LayoutDashboard },
  { id: "planner", label: "Meal Plan", icon: CalendarDays },
  { id: "grocery", label: "Grocery List", icon: ShoppingCart },
  { id: "analytics", label: "Analytics", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ activeView, setActiveView }: SidebarProps) {
  return (
    <aside className="w-64 bg-card border-r border-slate-200 flex flex-col hidden lg:flex shrink-0">
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <img 
            src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=200&h=200&q=80" 
            alt="SmartMeal Logo" 
            className="w-10 h-10 rounded-xl object-cover shadow-md border border-slate-200 dark:border-slate-700 shrink-0" 
          />
          <span className="text-xl font-extrabold tracking-tight">
            <span className="text-slate-900 dark:text-white">Smart</span>
            <span className="text-emerald-600">Meal</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all relative ${
              activeView === item.id
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            {activeView === item.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-emerald-600 rounded-r-full" />
            )}
            <item.icon
              className={`w-5 h-5 ${activeView === item.id ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}
            />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-6">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-5 h-5 text-amber-500" />
            <h4 className="font-bold text-amber-900 dark:text-amber-500 text-sm">
              Unlock Premium
            </h4>
          </div>
          <p className="text-xs text-amber-700/80 dark:text-amber-600/80 mb-4 leading-relaxed font-medium">
            Get personalized insights, advanced analytics and more.
          </p>
          <button className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold py-3 rounded-xl shadow-sm transition-colors">
            Upgrade Now
          </button>
        </div>
      </div>
    </aside>
  );
}
