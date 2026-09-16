import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { SettingsProvider } from "@/lib/settings-context";
import { ProgressProvider } from "@/lib/progress-context";
import { ToastProvider } from "@/lib/toast-context";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "SmartMeal — AI-Powered Meal Planning",
  description:
    "Personalized meal plans, biometric macro tracking, C-engine grocery sorting, and real-time progress — all powered by your unique body metrics.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="antialiased">
      <body className={`${jakarta.variable} font-sans`}>
        <ToastProvider>
          <SettingsProvider>
            <ProgressProvider>
              <AuthProvider>{children}</AuthProvider>
            </ProgressProvider>
          </SettingsProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
