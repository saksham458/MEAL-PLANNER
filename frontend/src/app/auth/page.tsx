"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { signIn } from "next-auth/react";
import { playHapticTap } from "@/utils/haptics";
import ParticleBackground from "@/components/ParticleBackground";

// --- Custom SVGs (replacing lucide-react) ---
const MessageCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
);

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
);

export default function AuthenticationPage() {
  const router = useRouter();
  
  // UI States
  const [activeTab, setActiveTab] = useState<"EMAIL" | "PHONE">("EMAIL");
  const [step, setStep] = useState<"MAIN" | "OTP">("MAIN");

  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- Chatbot State ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [hasPopped, setHasPopped] = useState(false);
  const [messages, setMessages] = useState<{sender: 'bot'|'user', text: string}[]>([
    { sender: 'bot', text: 'Hi! I am the SmartMeal Assistant. Need help getting started?' }
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-pop the chatbot after 5 seconds of dwelling
    const timer = setTimeout(() => {
      if (!isChatOpen && !hasPopped) {
        setIsChatOpen(true);
        setHasPopped(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isChatOpen, hasPopped]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setChatInput("");

    // Simulated Logic Engine response
    setTimeout(() => {
        let botResponse = "I'm still learning! If you're having trouble logging in, double check your credentials.";
        const lower = userMsg.toLowerCase();
        if (lower.includes('help') || lower.includes('forgot')) {
          botResponse = "Need a password reset? Just click the 'Forgot password?' link above the password field!";
        } else if (lower.includes('what') && lower.includes('smart meal')) {
          botResponse = "SmartMeal is a premium AI-fueled engine that calculates your macros, generates 7-day meal plans, and auto-sorts your grocery cart by supermarket aisle!";
        } else if (lower.includes('google') || lower.includes('apple')) {
          botResponse = "Social logins map directly to your primary email. If you originally signed up with Google, you must use the Google button to sign in!";
        } else if (lower.includes('hello') || lower.includes('hi')) {
          botResponse = "Hello! Ready to take control of your nutrition?";
        }
        setMessages(prev => [...prev, { sender: 'bot', text: botResponse }]);
    }, 800);
  };

  // --- 1. Email Login Logic ---
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    playHapticTap();

    try {
      const response = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) throw new Error("Invalid email or password.");
      const data = await response.json();
      if (data.access_token) {
          localStorage.setItem("smartmeal_token", data.access_token);
          // Sync with session if necessary, or let NextAuth handles it
      }
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. Phone OTP Request Logic ---
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    playHapticTap();

    try {
      const res = await fetch("http://localhost:8000/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone }),
      });
      
      if (!res.ok) throw new Error("Failed to send OTP. Try again.");
      
      setStep("OTP"); // Slide over to the OTP screen
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 3. Phone OTP Verify Logic ---
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    playHapticTap();

    const result = await signIn("phone-otp", {
      redirect: false,
      phone: phone,
      otp: otp,
    });

    if (result?.error) {
      setError("Invalid 6-digit code.");
      setIsLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="relative min-h-screen flex overflow-hidden font-sans">
      
      {/* 1. The Interactive Background */}
      <ParticleBackground />

      {/* 2. Left Side - Inspirational Visual */}
      <div className="hidden lg:block relative z-10 w-1/2 overflow-hidden shadow-2xl">
        <img
          src="https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=1200"
          alt="Healthy fresh food bowl"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[20s] hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent" />
        <div className="absolute bottom-16 left-16 right-16 text-white max-w-lg">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">Precision Nutrition</span>
            <h2 className="text-5xl font-black mb-6 leading-tight">Fuel Your Goals.<br/><span className="text-emerald-400">Autopilot Engaged.</span></h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              Log your biometrics once. Get 7-day meal plans and automated grocery lists forever.
            </p>
          </motion.div>
        </div>
      </div>

      {/* 3. Right Side - Glassmorphism Login Form */}
      <div className="relative z-10 w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 bg-white/60 backdrop-blur-3xl border-l border-white/20">
        <div className="w-full max-w-md">
          
          <div className="flex justify-center mb-10">
              <motion.div 
               whileHover={{ rotate: 15 }}
               className="w-16 h-16 rounded-3xl gradient-emerald text-white flex items-center justify-center text-3xl shadow-xl shadow-emerald-500/20"
              >
                  🥗
              </motion.div>
          </div>

          <div className="text-left mb-10">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Access Hub</h1>
            <p className="text-slate-500 mt-2 font-medium">Powering your daily performance.</p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mb-8 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-3"
              >
                <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-xs">!</span>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* --- VIEW: MAIN LOGIN (Socials + Email/Phone) --- */}
            {step === "MAIN" && (
              <motion.div 
                key="main"
                initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
                transition={{ type: "spring", damping: 20, stiffness: 100 }}
              >
                {/* Social Login Buttons */}
                <div className="space-y-4 mb-10">
                  <button 
                    onClick={() => { playHapticTap(); signIn('google', { callbackUrl: '/dashboard' }); }} 
                    className="w-full flex items-center justify-center gap-4 bg-white border border-slate-200 text-slate-700 px-4 py-4 rounded-2xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm group"
                  >
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                    Continue with Google
                  </button>
                  <button 
                    onClick={() => { playHapticTap(); signIn('apple', { callbackUrl: '/dashboard' }); }} 
                    className="w-full flex items-center justify-center gap-4 bg-slate-900 text-white px-4 py-4 rounded-2xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl group"
                  >
                    <img src="https://www.svgrepo.com/show/511330/apple-173.svg" alt="Apple" className="w-5 h-5 filter invert" />
                    Continue with Apple
                  </button>
                </div>

                <div className="relative flex items-center py-6">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Matrix Entry</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                {/* Custom Tabs */}
                <div className="flex p-1.5 bg-slate-100/80 rounded-2xl mb-8">
                  <button onClick={() => { playHapticTap(); setActiveTab("EMAIL"); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === "EMAIL" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Email</button>
                  <button onClick={() => { playHapticTap(); setActiveTab("PHONE"); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === "PHONE" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Phone</button>
                </div>

                {/* EMAIL FORM */}
                {activeTab === "EMAIL" ? (
                  <form className="space-y-5" onSubmit={handleEmailLogin}>
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1">Identity</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="athlete@smartmeal.ai" required className="w-full px-5 py-4 bg-white/80 border border-slate-200 rounded-2xl text-sm focus:border-emerald-500 outline-none transition-all font-medium placeholder:text-slate-300 shadow-inner" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1">Keycode</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="w-full px-5 py-4 bg-white/80 border border-slate-200 rounded-2xl text-sm focus:border-emerald-500 outline-none transition-all font-medium placeholder:text-slate-300 shadow-inner" />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-emerald-600/20 mt-4 disabled:opacity-70 flex items-center justify-center gap-2">
                      {isLoading ? "Validating Matrix..." : "Initialize Dashboard"}
                    </button>
                  </form>
                ) : (
                /* PHONE FORM */
                  <form className="space-y-5" onSubmit={handleRequestOTP}>
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1">Secure Mobile</label>
                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" required className="w-full px-5 py-4 bg-white/80 border border-slate-200 rounded-2xl text-sm focus:border-emerald-500 outline-none transition-all font-medium placeholder:text-slate-300 shadow-inner" />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-emerald-600/20 mt-4 disabled:opacity-70">
                      {isLoading ? "Hashing OTP..." : "Request Signal"}
                    </button>
                  </form>
                )}
              </motion.div>
            )}

            {/* --- VIEW: OTP VERIFICATION --- */}
            {step === "OTP" && (
              <motion.div 
                key="otp"
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                transition={{ type: "spring", damping: 20, stiffness: 100 }}
                className="text-center space-y-8"
              >
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                      <div className="text-emerald-600 scale-125"><MessageCircleIcon /></div>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Check SMS</h3>
                    <p className="text-sm text-slate-500 mt-2 font-medium">Transmitting to {phone}</p>
                </div>

                <form onSubmit={handleVerifyOTP} className="space-y-6">
                  <input 
                    type="text" 
                    value={otp} 
                    onChange={(e) => setOtp(e.target.value)} 
                    placeholder="000 000" 
                    maxLength={6}
                    required 
                    className="w-full px-5 py-6 bg-white border-2 border-slate-100 rounded-2xl text-4xl tracking-widest text-center font-black focus:border-emerald-500 outline-none transition-all shadow-xl text-emerald-600" 
                  />
                  <button type="submit" disabled={isLoading} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl disabled:opacity-70">
                    {isLoading ? "Decrypting..." : "Verify Identity"}
                  </button>
                </form>

                <button onClick={() => { playHapticTap(); setStep("MAIN"); }} className="text-xs font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700">
                  Resend Signal?
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 4. Floating AI Support Chatbot Button */}
      <div className="fixed bottom-10 right-10 z-50 flex flex-col items-end">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 30, scale: 0.8, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 30, scale: 0.8, filter: 'blur(10px)' }}
              className="absolute bottom-24 right-0 w-85 bg-white/95 backdrop-blur-2xl rounded-[32px] shadow-2xl border border-white/50 overflow-hidden mb-4 flex flex-col"
              style={{ height: '480px' }}
            >
              <div className="gradient-emerald p-6 text-white flex items-center justify-between">
                <div>
                    <h3 className="font-black text-xs uppercase tracking-widest">Support Core</h3>
                    <p className="text-[10px] text-emerald-100 mt-1 uppercase font-bold">Neural Engine Active</p>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-white/20 transition-all font-black">✕</button>
              </div>
              
              <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/40">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium ${
                            m.sender === 'user' 
                            ? 'bg-emerald-600 text-white rounded-br-none shadow-lg' 
                            : 'bg-white text-slate-700 rounded-bl-none border border-slate-100 shadow-sm'
                        }`}>
                            {m.text}
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex gap-2">
                <input 
                    type="text" 
                    value={chatInput} 
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask Neural Hub..." 
                    className="flex-1 px-5 py-3 bg-slate-100/50 rounded-2xl text-xs font-bold outline-none focus:bg-white focus:ring-2 ring-emerald-500/20" 
                />
                <button type="submit" disabled={!chatInput.trim()} className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50">
                    <SendIcon />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button 
          whileHover={{ scale: 1.1, rotate: -10 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => { playHapticTap(); setIsChatOpen(!isChatOpen); setHasPopped(true); }}
          className="w-16 h-16 bg-emerald-600 text-white rounded-[24px] shadow-2xl shadow-emerald-600/40 flex items-center justify-center text-2xl transition-all"
        >
          {isChatOpen ? "✕" : <MessageCircleIcon />}
        </motion.button>
      </div>

    </div>
  );
}
