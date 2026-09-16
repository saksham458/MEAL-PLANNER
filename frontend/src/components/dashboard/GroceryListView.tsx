import { useState } from "react";
import { useProgress } from "@/lib/progress-context";
import { generateGroceryList } from "@/utils/grocery";
import { CheckCircle2, Circle, ShoppingBag, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function GroceryListView() {
  const { selectedMeals } = useProgress();
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [showQRModal, setShowQRModal] = useState(false);

  const groceryList = generateGroceryList(selectedMeals);
  const aisles = Object.keys(groceryList).sort();

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const totalItems = Object.values(groceryList).flat().length;
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

  if (totalItems === 0) {
    return (
      <div className="max-w-3xl mx-auto flex flex-col items-center justify-center py-20 text-center animate-in fade-in">
        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
          <span className="text-4xl">🛒</span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">Your Cart is Empty</h2>
        <p className="text-slate-500 font-medium max-w-sm">
          Select some meals in the Meal Plan tab, and we'll automatically aggregate your smart grocery list here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
      
      {/* Header & Progress */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Smart Grocery List</h2>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-sm font-bold text-slate-500 uppercase tracking-widest">{checkedCount} / {totalItems} Items</span>
            <button 
              onClick={() => setShowQRModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              Instacart
            </button>
          </div>
        </div>
        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 transition-all duration-500 ease-out rounded-full" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      </div>

      {/* Aisle Grid */}
      <div className="grid md:grid-cols-2 gap-8">
        {aisles.map(aisle => {
          const items = groceryList[aisle];
          if (!items || items.length === 0) return null;

          return (
            <div key={aisle} className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                {aisle}
              </h3>
              <div className="space-y-3">
                {items.map(item => {
                  const isChecked = checkedItems[item.id];
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleCheck(item.id)}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group text-left"
                    >
                      <div className="flex items-center gap-3">
                        {isChecked ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
                        )}
                        <span className={`font-semibold text-sm transition-all ${
                          isChecked 
                            ? "text-slate-400 dark:text-slate-500 line-through" 
                            : "text-slate-700 dark:text-slate-200"
                        }`}>
                          {item.name}
                        </span>
                      </div>
                      <span className={`text-xs font-extrabold uppercase tracking-widest transition-all ${
                        isChecked ? "text-slate-300 dark:text-slate-600" : "text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {item.amount} {item.unit}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQRModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQRModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-card rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-500" /> Checkout
                </h2>
                <button 
                  onClick={() => setShowQRModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 flex flex-col items-center text-center">
                <p className="text-slate-500 font-medium mb-6">
                  Scan this code with your phone to instantly add these items to your Instacart or local grocer.
                </p>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
                  <img 
                    src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://instacart.com" 
                    alt="QR Code" 
                    className="w-48 h-48"
                  />
                </div>
                <button 
                  onClick={() => setShowQRModal(false)}
                  className="w-full bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
