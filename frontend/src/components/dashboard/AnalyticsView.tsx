import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Activity, Scale } from "lucide-react";

const mockAnalyticsData = [
  { name: "Mon", calories: 2100, weight: 75.5 },
  { name: "Tue", calories: 2350, weight: 75.4 },
  { name: "Wed", calories: 2200, weight: 75.6 },
  { name: "Thu", calories: 1950, weight: 75.3 },
  { name: "Fri", calories: 2400, weight: 75.2 },
  { name: "Sat", calories: 2800, weight: 75.5 },
  { name: "Sun", calories: 2100, weight: 75.1 },
];

export function AnalyticsView() {
  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
      
      <div className="mb-10">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">Analytics</h2>
        <p className="text-slate-500 font-medium">Track your weekly caloric intake against your body weight trend.</p>
      </div>

      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-6 lg:p-8 shadow-sm mb-8">
        <div className="flex items-center gap-6 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Caloric Intake (kcal)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Body Weight (kg)</span>
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={mockAnalyticsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
              <XAxis 
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fontWeight: 700, fill: "var(--color-slate-400)" }}
                dy={10}
              />
              
              {/* Primary Y Axis for Calories */}
              <YAxis 
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fontWeight: 700, fill: "var(--color-slate-400)" }}
              />
              
              {/* Secondary Y Axis for Weight */}
              <YAxis 
                yAxisId="right"
                orientation="right"
                domain={['dataMin - 1', 'dataMax + 1']}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fontWeight: 700, fill: "var(--color-slate-400)" }}
              />
              
              <Tooltip 
                contentStyle={{ 
                  borderRadius: "16px", 
                  border: "1px solid var(--color-slate-200)", 
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  fontWeight: 700
                }} 
              />
              
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="calories" 
                stroke="#10b981" 
                strokeWidth={4}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
              
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="weight" 
                stroke="#a855f7" 
                strokeWidth={4}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
            <Activity className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Avg Intake</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">2,271 kcal</p>
          </div>
        </div>
        
        <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
            <Scale className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Weight Change</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">-0.4 kg</p>
          </div>
        </div>
      </div>

    </div>
  );
}
