import { useSettings } from "@/lib/settings-context";
import { Settings as SettingsIcon, Monitor, Sun, Moon, Type, Scale } from "lucide-react";

export function SettingsView() {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
      
      <div className="mb-10">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">App Settings</h2>
        <p className="text-slate-500 font-medium">Manage your global application preferences.</p>
      </div>

      <div className="space-y-6">
        
        {/* Appearance Settings */}
        <section className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <SettingsIcon className="w-6 h-6 text-emerald-500" />
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Appearance</h3>
          </div>

          <div className="space-y-8">
            {/* Theme */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Theme Preference</label>
              <div className="flex gap-4">
                <button
                  onClick={() => updateSettings({ themePref: 'light' })}
                  className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all border ${
                    settings.themePref === 'light' 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <Sun className="w-4 h-4" /> Light
                </button>
                <button
                  onClick={() => updateSettings({ themePref: 'dark' })}
                  className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all border ${
                    settings.themePref === 'dark' 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <Moon className="w-4 h-4" /> Dark
                </button>
                <button
                  onClick={() => updateSettings({ themePref: 'system' })}
                  className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all border ${
                    settings.themePref === 'system' 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <Monitor className="w-4 h-4" /> System
                </button>
              </div>
            </div>

            {/* Typography */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Typography</label>
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                {['Plus Jakarta Sans', 'Inter', 'Roboto'].map(font => (
                  <button
                    key={font}
                    onClick={() => updateSettings({ fontFamily: font })}
                    className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all ${
                      settings.fontFamily === font 
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Type className="w-4 h-4" /> {font}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Measurement Units */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Measurement Units</label>
              <div className="flex gap-4">
                <button
                  onClick={() => updateSettings({ unitPref: 'metric' })}
                  className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all border ${
                    settings.unitPref === 'metric' 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <Scale className="w-4 h-4" /> Metric (kg/cm)
                </button>
                <button
                  onClick={() => updateSettings({ unitPref: 'imperial' })}
                  className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all border ${
                    settings.unitPref === 'imperial' 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <Scale className="w-4 h-4" /> Imperial (lbs/in)
                </button>
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}
