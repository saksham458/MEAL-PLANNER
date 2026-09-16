import { NextResponse } from 'next/server';

// Mock profile data
let mockProfile = {
  gender: 'male',
  age: 25,
  height_cm: 170,
  weight_kg: 70,
  activity_level: 'moderate',
  daily_calories: 2200,
  daily_protein_g: 165,
  daily_carbs_g: 220,
  daily_fat_g: 73,
  dietary_goal: 'maintain',
};

export async function GET() {
  return NextResponse.json({
    user: { id: 1, email: 'demo@smartmeal.app', first_name: 'Demo', last_name: 'User' },
    biometrics: mockProfile,
  });
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    // Simulate database update
    mockProfile = { ...mockProfile, ...data };
    
    return NextResponse.json({
      user: { id: 1, email: 'demo@smartmeal.app', first_name: 'Demo', last_name: 'User' },
      biometrics: mockProfile,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process request' }, { status: 400 });
  }
}
