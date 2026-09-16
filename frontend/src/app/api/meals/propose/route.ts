import { NextResponse } from 'next/server';
import { WeeklyProposedPlan, MealTimestamp } from '@/lib/api';

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const mealTypes: ('breakfast' | 'lunch' | 'snacks' | 'dinner')[] = ['breakfast', 'lunch', 'snacks', 'dinner'];

const getMockIngredients = (type: string, opt: number) => {
  if (type === 'breakfast') {
    return opt === 1 ? [{ name: 'Oats', amount: 50, unit: 'g', category: 'Pantry' }, { name: 'Milk', amount: 100, unit: 'ml', category: 'Dairy & Eggs' }] :
           opt === 2 ? [{ name: 'Eggs', amount: 2, unit: 'pcs', category: 'Dairy & Eggs' }, { name: 'Toast', amount: 2, unit: 'slices', category: 'Bakery' }] :
           [{ name: 'Pancakes', amount: 3, unit: 'pcs', category: 'Pantry' }, { name: 'Syrup', amount: 15, unit: 'ml', category: 'Pantry' }];
  }
  if (type === 'lunch') {
    return opt === 1 ? [{ name: 'Chicken', amount: 150, unit: 'g', category: 'Meat & Seafood' }, { name: 'Rice', amount: 100, unit: 'g', category: 'Pantry' }] :
           opt === 2 ? [{ name: 'Beef', amount: 150, unit: 'g', category: 'Meat & Seafood' }, { name: 'Pasta', amount: 100, unit: 'g', category: 'Pantry' }] :
           [{ name: 'Tofu', amount: 150, unit: 'g', category: 'Produce' }, { name: 'Quinoa', amount: 100, unit: 'g', category: 'Pantry' }];
  }
  if (type === 'snacks') {
    return opt === 1 ? [{ name: 'Almonds', amount: 30, unit: 'g', category: 'Pantry' }, { name: 'Apple', amount: 1, unit: 'pc', category: 'Produce' }] :
           opt === 2 ? [{ name: 'Yogurt', amount: 150, unit: 'g', category: 'Dairy & Eggs' }, { name: 'Berries', amount: 50, unit: 'g', category: 'Produce' }] :
           [{ name: 'Protein Bar', amount: 1, unit: 'pc', category: 'Pantry' }];
  }
  return opt === 1 ? [{ name: 'Salmon', amount: 200, unit: 'g', category: 'Meat & Seafood' }, { name: 'Asparagus', amount: 100, unit: 'g', category: 'Produce' }] :
         opt === 2 ? [{ name: 'Steak', amount: 200, unit: 'g', category: 'Meat & Seafood' }, { name: 'Potato', amount: 150, unit: 'g', category: 'Produce' }] :
         [{ name: 'Lentil Soup', amount: 300, unit: 'ml', category: 'Pantry' }, { name: 'Bread', amount: 1, unit: 'slice', category: 'Bakery' }];
};

const getMockName = (type: string, opt: number) => {
  if (type === 'breakfast') return opt === 1 ? 'Oatmeal Bowl' : opt === 2 ? 'Eggs on Toast' : 'Protein Pancakes';
  if (type === 'lunch') return opt === 1 ? 'Chicken & Rice' : opt === 2 ? 'Beef Pasta' : 'Tofu Quinoa Bowl';
  if (type === 'snacks') return opt === 1 ? 'Apple & Almonds' : opt === 2 ? 'Berry Yogurt' : 'Protein Bar';
  return opt === 1 ? 'Salmon Dinner' : opt === 2 ? 'Steak & Potato' : 'Hearty Lentil Soup';
};

export async function POST() {
  const plan: WeeklyProposedPlan = {
    days: dayNames.map(day => ({
      day_of_week: day,
      timestamps: mealTypes.map(type => {
        const timestamp: MealTimestamp = {
          type,
          options: [1, 2, 3].map(opt => ({
            option_id: `${day.toLowerCase()}_${type}_opt${opt}`,
            name: getMockName(type, opt),
            calories: Math.floor(Math.random() * 200) + 300,
            protein: Math.floor(Math.random() * 20) + 15,
            carbs: Math.floor(Math.random() * 30) + 20,
            fats: Math.floor(Math.random() * 15) + 5,
            ingredients: getMockIngredients(type, opt)
          }))
        };
        return timestamp;
      })
    }))
  };

  return NextResponse.json(plan);
}
