import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { mealId } = await request.json();
    console.log(`Meal ${mealId} logged successfully (mock).`);
    
    // In a real app, you would save this to the database to track user's meals

    return NextResponse.json({ message: 'Meal logged successfully', mealId }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to parse request' }, { status: 400 });
  }
}
