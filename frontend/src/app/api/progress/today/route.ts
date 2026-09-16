import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    date: new Date().toISOString().split('T')[0],
    calories: { consumed: 0, target: 2200, percentage: 0, unit: 'kcal' },
    protein: { consumed: 0, target: 165, percentage: 0 },
    carbs: { consumed: 0, target: 220, percentage: 0 },
    fat: { consumed: 0, target: 73, percentage: 0 },
    water_glasses: 0, steps: 0, meals_logged: 0, total_meals: 4
  });
}
