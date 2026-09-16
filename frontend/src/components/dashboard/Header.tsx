import { useState } from "react";
import { Utensils, LogOut, User } from "lucide-react";
import Link from "next/link";

interface HeaderProps {
  user: any;
  onLogout: () => void;
  openProfile: () => void;
}

export function Header({ user, onLogout, openProfile }: HeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const initials = ((user?.first_name?.[0] || "") + (user?.last_name?.[0] || "")).toUpperCase() || "U";

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-slate-200 dark:border-slate-800 z-50 flex items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <img 
            src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=200&h=200&q=80" 
            alt="SmartMeal Logo" 
            className="w-8 h-8 rounded-xl object-cover shadow-md border border-slate-200 dark:border-slate-700 shrink-0" 
          />
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-slate-900 dark:text-white">Smart</span>
            <span className="text-emerald-600">Meal</span>
          </span>
        </Link>
      </div>

      {/* Desktop/Global Top Right Nav */}
      <div className="hidden lg:flex absolute top-6 right-8 z-50 items-center gap-4">
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm border-2 border-white dark:border-slate-800 shadow-sm transition-transform hover:scale-105"
          >
            {initials}
          </button>
          
          {showDropdown && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute right-0 mt-3 w-56 bg-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-2 z-50 animate-in slide-in-from-top-2">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
                
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    openProfile();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors"
                >
                  <User className="w-4 h-4" />
                  Profile & Biometrics
                </button>
                
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors mt-1"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
