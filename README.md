# 🥗 SmartMeal Planner

A premium, AI-powered meal planning and grocery aggregation platform built with **Next.js 16 (Turbopack)** and **Tailwind CSS**.

![SmartMeal Dashboard](https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80)

## ✨ Features

- **Modular Dashboard Architecture**: A beautiful, single-page dashboard utilizing a strict 8-point Tailwind grid, smooth transitions, and premium typography (`Plus Jakarta Sans`).
- **Smart Grocery Aggregation**: A custom algorithm automatically scans your weekly meal plan, merges duplicate ingredients, combines metrics, and sorts everything into distinct supermarket aisles.
- **Interactive Progress Hub**: Visual circular progress rings mapping your daily caloric intake, protein, carbs, and fat, alongside a 7-day streak tracker and hydration logging.
- **Instacart Integration**: Ready-to-scan QR codes to instantly add your aggregated grocery list to Instacart or local grocers.
- **Mock Authentication**: Built-in mock authentication flow (Email, Google, Apple) for rapid prototyping and demonstration purposes without needing a backend server.
- **Global Theme Engine**: Complete Light/Dark mode support across the entire interface.

## 🛠️ Tech Stack

- **Framework**: [Next.js 16.2.4](https://nextjs.org/) (App Router & Turbopack)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Charts**: [Recharts](https://recharts.org/)

## 🚀 Getting Started

First, install dependencies:

```bash
cd frontend
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. The application is entirely front-end driven using local storage for state persistence, so no backend database is required to test the functionality!

## 📱 Navigation

- `/auth` - The stunning authentication portal with interactive particle background and AI chatbot.
- `/dashboard` - The core application interface housing the Progress Hub, Meal Plan, Grocery List, Analytics, and Settings views.

## 🎨 Design System
- **Typography:** `Plus Jakarta Sans`
- **Border Radius:** Global standard of `16px` (`rounded-2xl`) for cards and inputs.
- **Interactivity:** All clickable components feature a scale-down effect (`active:scale-95`) with smooth `duration-200` transitions for a premium, tactile feel.