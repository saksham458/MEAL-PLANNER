"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSettings } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

// Components
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { ProgressHub } from "@/components/dashboard/ProgressHub";
import { MealPlanView } from "@/components/dashboard/MealPlanView";
import { GroceryListView } from "@/components/dashboard/GroceryListView";
import { AnalyticsView } from "@/components/dashboard/AnalyticsView";
import { SettingsView } from "@/components/dashboard/SettingsView";
import { ProfileModal } from "@/components/dashboard/ProfileModal";

export default function Dashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  
  const [activeView, setActiveView] = useState("dashboard");
  const [bio, setBio] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    // Auth Check
    const token = localStorage.getItem("smartmeal_token");
    if (!token) {
      router.push("/auth");
      return;
    }

    const loadData = async () => {
      try {
        const bioRes = await getSettings();
        setBio(bioRes.biometrics);
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load user data", err);
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
        <aside className="w-64 bg-card border-r border-slate-200 dark:border-slate-800 hidden lg:flex flex-col p-6">
          <Skeleton className="h-10 w-40 mb-10" />
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </aside>
        <main className="flex-1 p-4 lg:p-10">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 transition-colors">
      
      {/* Human-Engineered Navigation */}
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <Header user={user} onLogout={logout} openProfile={() => setIsProfileModalOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-10 lg:pt-10 pt-24 min-h-full">
          {activeView === "dashboard" && <ProgressHub user={user} bio={bio} />}
          {activeView === "planner" && <MealPlanView />}
          {activeView === "grocery" && <GroceryListView />}
          {activeView === "analytics" && <AnalyticsView />}
          {activeView === "settings" && <SettingsView />}
        </div>
      </main>

      {/* Global Profile Modal */}
      <ProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
        bio={bio}
        setBio={setBio}
      />
      
    </div>
  );
}
