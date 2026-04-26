'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/auth');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  // Loading state while checking auth
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--slate-50)' }}>
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-emerald flex items-center justify-center animate-pulse-glow">
          <span className="text-2xl">🥗</span>
        </div>
        <p style={{ color: 'var(--slate-400)', fontWeight: 500 }}>Loading SmartMeal...</p>
      </div>
    </div>
  );
}
