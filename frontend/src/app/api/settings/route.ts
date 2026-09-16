import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    user: { id: 1, email: 'demo@example.com', first_name: 'Demo', last_name: 'User' },
    biometrics: {
      gender: 'male', age: 25, height_cm: 175, weight_kg: 70, activity_level: 'moderate',
      daily_calories: 2200, daily_protein_g: 150, daily_carbs_g: 200, daily_fat_g: 70, dietary_goal: 'maintain'
    }
  });
}

export async function PUT(req: Request) {
  const body = await req.json();
  return NextResponse.json({
    user: { id: 1, email: 'demo@example.com', first_name: 'Demo', last_name: 'User' },
    biometrics: {
      gender: 'male', age: 25, height_cm: 175, weight_kg: 70, activity_level: 'moderate',
      daily_calories: 2200, daily_protein_g: 150, daily_carbs_g: 200, daily_fat_g: 70, dietary_goal: 'maintain',
      ...body
    }
  });
}
