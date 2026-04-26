'use client';

import { useState, useEffect } from "react";
import QRCode from "react-qr-code";

export default function WorkingQR() {
  // 1. Enter your REAL personal UPI ID here for testing
  const YOUR_UPI_ID = "your_personal_id@upi"; 
  const MERCHANT_NAME = "Smart Meal App";
  const AMOUNT = 500; // ₹500

  // Derive the string directly without useEffect to avoid cascading renders
  const upiString = `upi://pay?pa=${YOUR_UPI_ID}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${AMOUNT}&cu=INR&tn=GroceryCheckout`;

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-3xl border border-slate-200">
      <h3 className="text-xl font-bold text-slate-900 mb-2">Scan to Pay ₹{AMOUNT}</h3>
      <p className="text-sm text-slate-500 mb-6 text-center max-w-xs">
        Open PhonePe, GPay, or Paytm on your phone and scan this code.
      </p>

      {/* The Scannable QR Code */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        {upiString ? (
          <QRCode value={upiString} size={200} level="H" />
        ) : (
          <div className="w-[200px] h-[200px] bg-slate-100 animate-pulse rounded-xl" />
        )}
      </div>

      <div className="mt-6 w-full max-w-xs p-4 bg-emerald-50 text-emerald-800 rounded-xl text-sm font-medium text-center border border-emerald-100">
        Waiting for you to scan...
      </div>
    </div>
  );
}
