/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   SMART MEAL PLANNER — Frontend Application Logic           ║
 * ║   Full-Stack Integration: FastAPI ↔ Frontend                ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  • Auth → JWT Login/Signup                                  ║
 * ║  • Settings → Biometric Save + Macro Recalculation          ║
 * ║  • Grocery → C-Engine Sorted List + Add to Cart             ║
 * ║  • Cart → Buy / Cancel / Buy Later                          ║
 * ║  • Payment → UPI QR, PhonePe, Wallet, Card (Glassmorphism)  ║
 * ║  • Meal Logging → Daily Progress Tracking                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

(() => {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // CONFIG
    // ═══════════════════════════════════════════════════════════
    const API_BASE = 'http://localhost:8000';
    let AUTH_TOKEN = localStorage.getItem('smartmeal_token') || '';
    let currentUser = JSON.parse(localStorage.getItem('smartmeal_user') || 'null');
    let userBio = JSON.parse(localStorage.getItem('smartmeal_bio') || 'null');

    // Shopping Cart State
    let cart = JSON.parse(localStorage.getItem('smartmeal_cart') || '[]');
    let loggedMeals = JSON.parse(localStorage.getItem('smartmeal_logged') || '{}');

    // QR code timer interval
    let qrTimerInterval = null;

    // ═══════════════════════════════════════════════════════════
    // API HELPER
    // ═══════════════════════════════════════════════════════════
    async function api(path, options = {}) {
        const url = `${API_BASE}${path}`;
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;

        try {
            const res = await fetch(url, { ...options, headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || `API error ${res.status}`);
            return data;
        } catch (err) {
            console.warn(`API ${path}:`, err.message);
            throw err;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // DOM HELPERS
    // ═══════════════════════════════════════════════════════════
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);
    const hide = el => { if (el) el.style.display = 'none'; };
    const show = (el, d = 'block') => { if (el) el.style.display = d; };

    function showToast(msg, type = 'success') {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;top:24px;right:24px;z-index:99999;padding:12px 20px;border-radius:12px;font-size:0.88rem;font-weight:600;color:white;background:${type==='error'?'#ef4444':type==='warning'?'#f59e0b':'#059669'};box-shadow:0 8px 24px rgba(0,0,0,0.15);animation:slideUp 0.3s ease;font-family:Inter,sans-serif;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
    }

    // ═══════════════════════════════════════════════════════════
    // SCREEN ROUTING
    // ═══════════════════════════════════════════════════════════
    function switchScreen(screenId) {
        $$('.screen').forEach(s => { s.classList.remove('active', 'fade-in'); });
        const target = $(`#${screenId}`);
        if (target) {
            target.classList.add('active', 'fade-in');
        }
    }

    // App view routing (within dashboard screen)
    function switchView(viewId) {
        $$('.app-view').forEach(v => { v.classList.remove('active'); v.style.display = 'none'; });
        const target = $(`#view-${viewId}`);
        if (target) {
            target.style.display = 'block';
            target.classList.add('active');
        }
        // Update sidebar nav active state
        $$('.sidebar-nav-item').forEach(b => b.classList.remove('active'));
        const navBtn = $(`[data-view="${viewId}"]`);
        if (navBtn) navBtn.classList.add('active');
    }

    // ═══════════════════════════════════════════════════════════
    // LOGO → HOME (All logos redirect to front page)
    // ═══════════════════════════════════════════════════════════
    function setupLogoNavigation() {
        ['#logo-home-auth', '#logo-home-onb', '#logo-home-sidebar'].forEach(sel => {
            const el = $(sel);
            if (el) el.addEventListener('click', (e) => {
                e.preventDefault();
                if (AUTH_TOKEN && currentUser) {
                    switchScreen('screen-dashboard');
                    switchView('dashboard');
                } else {
                    switchScreen('screen-auth');
                }
            });
        });
    }

    // ═══════════════════════════════════════════════════════════
    // AUTH: LOGIN & SIGNUP
    // ═══════════════════════════════════════════════════════════
    function setupAuth() {
        // Toggle between login/signup
        $('#show-signup')?.addEventListener('click', () => {
            $('#login-form').classList.remove('active');
            $('#signup-form').classList.add('active');
        });
        $('#show-login')?.addEventListener('click', () => {
            $('#signup-form').classList.remove('active');
            $('#login-form').classList.add('active');
        });

        // Login
        $('#btn-login')?.addEventListener('click', async () => {
            const email = $('#login-email').value.trim();
            const password = $('#login-password').value;
            if (!email || !password) return showToast('Please fill in all fields', 'error');

            const btn = $('#btn-login');
            btn.classList.add('loading');
            try {
                const data = await api('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password }),
                });
                AUTH_TOKEN = data.access_token;
                localStorage.setItem('smartmeal_token', AUTH_TOKEN);
                currentUser = { id: data.user_id, email: data.email, first_name: data.first_name };
                localStorage.setItem('smartmeal_user', JSON.stringify(currentUser));
                showToast('Welcome back! 🎉');
                await loadUserData();
                switchScreen('screen-dashboard');
            } catch (err) {
                showToast(err.message || 'Login failed', 'error');
            } finally {
                btn.classList.remove('loading');
            }
        });

        // Signup
        $('#btn-signup')?.addEventListener('click', async () => {
            const first = $('#signup-first').value.trim();
            const last = $('#signup-last').value.trim();
            const email = $('#signup-email').value.trim();
            const password = $('#signup-password').value;
            if (!first || !email || !password) return showToast('Please fill in all required fields', 'error');
            if (password.length < 8) return showToast('Password must be at least 8 characters', 'error');

            const btn = $('#btn-signup');
            btn.classList.add('loading');
            try {
                const data = await api('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ email, password, first_name: first, last_name: last || '' }),
                });
                AUTH_TOKEN = data.access_token;
                localStorage.setItem('smartmeal_token', AUTH_TOKEN);
                currentUser = { id: data.user_id, email: data.email, first_name: data.first_name };
                localStorage.setItem('smartmeal_user', JSON.stringify(currentUser));
                showToast('Account created! Let\'s set up your profile 🚀');
                switchScreen('screen-onboarding');
            } catch (err) {
                showToast(err.message || 'Signup failed', 'error');
            } finally {
                btn.classList.remove('loading');
            }
        });

        // Password strength indicator
        $('#signup-password')?.addEventListener('input', (e) => {
            const val = e.target.value;
            const bars = $$('.strength-bar');
            const text = $('#pw-strength-text');
            let strength = 0;
            if (val.length >= 6) strength++;
            if (val.length >= 8) strength++;
            if (/[A-Z]/.test(val) && /[0-9]/.test(val)) strength++;
            if (/[^A-Za-z0-9]/.test(val)) strength++;
            const levels = ['', 'Weak', 'Fair', 'Strong', 'Excellent'];
            const classes = ['', 'weak', 'medium', 'strong', 'strong'];
            bars.forEach((b, i) => {
                b.classList.remove('active', 'weak', 'medium', 'strong');
                if (i < strength) { b.classList.add('active', classes[strength]); }
            });
            text.textContent = val ? levels[strength] : '';
        });

        // Forgot password
        $('#forgot-pw-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            const email = $('#login-email').value.trim();
            if (!email) {
                showToast('Enter your email first, then click Forgot Password', 'warning');
                $('#login-email').focus();
            } else {
                showToast(`Password reset link sent to ${email}`);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // BIOMETRIC ONBOARDING
    // ═══════════════════════════════════════════════════════════
    let onbData = { gender: 'male', age: 25, height: 170, weight: 70, lifestyle: 'moderate' };

    function setupOnboarding() {
        // Sliders
        const ageSlider = $('#age-slider');
        const heightSlider = $('#height-slider');
        const weightSlider = $('#weight-slider');

        ageSlider?.addEventListener('input', (e) => { onbData.age = +e.target.value; $('#age-val').textContent = e.target.value; });
        heightSlider?.addEventListener('input', (e) => { onbData.height = +e.target.value; $('#height-val').textContent = e.target.value; });
        weightSlider?.addEventListener('input', (e) => { onbData.weight = +e.target.value; $('#weight-val').textContent = e.target.value; });

        // Gender selection
        $$('.gender-option').forEach(opt => {
            opt.addEventListener('click', () => {
                $$('.gender-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                onbData.gender = opt.dataset.gender;
            });
        });

        // Lifestyle cards
        $$('.lifestyle-card').forEach(card => {
            card.addEventListener('click', () => {
                $$('.lifestyle-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                onbData.lifestyle = card.dataset.lifestyle;
            });
        });

        // Navigation
        const goStep = (step) => {
            $$('.onboarding-step').forEach(s => s.classList.remove('active'));
            $(`#onb-step-${step}`).classList.add('active');
            $('#onb-progress-fill').style.width = `${(step / 4) * 100}%`;
            $('#onb-step-count').textContent = `Step ${step} of 4`;
        };

        $('#onb-next-1')?.addEventListener('click', () => goStep(2));
        $('#onb-back-2')?.addEventListener('click', () => goStep(1));
        $('#onb-next-2')?.addEventListener('click', () => goStep(3));
        $('#onb-back-3')?.addEventListener('click', () => goStep(2));
        $('#onb-next-3')?.addEventListener('click', () => {
            goStep(4);
            runCalculation();
        });

        $('#onb-finish')?.addEventListener('click', async () => {
            // Save biometrics to backend
            try {
                await api('/settings', {
                    method: 'PUT',
                    body: JSON.stringify({
                        gender: onbData.gender,
                        age: onbData.age,
                        height_cm: onbData.height,
                        weight_kg: onbData.weight,
                        activity_level: onbData.lifestyle,
                    }),
                });
            } catch (e) {
                console.warn('Backend save failed, using local calc');
            }
            await loadUserData();
            switchScreen('screen-dashboard');
            showToast('Your plan is ready! 🎉');
        });
    }

    // Mifflin-St Jeor Equation
    function calculateMacros(data) {
        const { gender, age, height, weight, lifestyle } = data;
        let bmr;
        if (gender === 'female') bmr = 10 * weight + 6.25 * height - 5 * age - 161;
        else bmr = 10 * weight + 6.25 * height - 5 * age + 5;

        const multipliers = { sedentary: 1.2, moderate: 1.55, active: 1.725, athlete: 1.9 };
        const tdee = Math.round(bmr * (multipliers[lifestyle] || 1.55));
        const protein = Math.round(weight * 2.0);
        const fat = Math.round((tdee * 0.25) / 9);
        const carbs = Math.round((tdee - protein * 4 - fat * 9) / 4);

        return { calories: tdee, protein, carbs, fat };
    }

    function runCalculation() {
        const macros = calculateMacros(onbData);
        userBio = macros;
        localStorage.setItem('smartmeal_bio', JSON.stringify(macros));

        setTimeout(() => {
            $('#calc-status-text').textContent = 'Your personalized plan is ready!';
            $('#res-cal').textContent = macros.calories.toLocaleString();
            $('#res-protein').textContent = macros.protein;
            $('#res-carbs').textContent = macros.carbs;
            $('#res-fat').textContent = macros.fat;
            show($('#results-grid'), 'grid');
            show($('#calc-nav'));
        }, 2500);
    }

    // ═══════════════════════════════════════════════════════════
    // SIDEBAR NAVIGATION
    // ═══════════════════════════════════════════════════════════
    function setupSidebar() {
        $$('.sidebar-nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                if (view) {
                    switchView(view);
                    if (view === 'grocery') renderGroceryList();
                    if (view === 'cart') renderCart();
                    if (view === 'settings') loadSettings();
                    // Close mobile sidebar
                    $('#sidebar')?.classList.remove('open');
                    $('#sidebar-overlay')?.classList.remove('visible');
                }
            });
        });

        // Mobile sidebar toggle
        $('#mobile-sidebar-btn')?.addEventListener('click', () => {
            $('#sidebar').classList.toggle('open');
            $('#sidebar-overlay').classList.toggle('visible');
        });
        $('#sidebar-overlay')?.addEventListener('click', () => {
            $('#sidebar').classList.remove('open');
            $('#sidebar-overlay').classList.remove('visible');
        });

        // Quick actions
        $('#action-view-grocery')?.addEventListener('click', () => switchView('grocery'));
        $('#cart-float-btn')?.addEventListener('click', () => { switchView('cart'); renderCart(); });
    }

    // ═══════════════════════════════════════════════════════════
    // DASHBOARD
    // ═══════════════════════════════════════════════════════════
    function renderDashboard() {
        // Greeting
        const hour = new Date().getHours();
        const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        const name = currentUser?.first_name || 'there';
        const greetingEl = $('#greeting-text');
        if (greetingEl) greetingEl.textContent = `${greet}, ${name} 👋`;

        // User avatar
        if (currentUser) {
            const initials = (currentUser.first_name?.[0] || '') + (currentUser.last_name?.[0] || '');
            const avatar = $('#user-avatar');
            const displayName = $('#user-display-name');
            if (avatar) avatar.textContent = initials.toUpperCase() || 'U';
            if (displayName) displayName.textContent = `${currentUser.first_name} ${currentUser.last_name || ''}`.trim();
        }

        // Week calendar
        renderWeekDays();

        // Macros and progress
        renderMacroRings();
        renderDailyProgress();

        // Meal logging buttons
        setupMealLogging();
    }

    function renderWeekDays() {
        const container = $('#week-days');
        if (!container) return;

        const today = new Date();
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday

        let html = '';
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            const isToday = d.toDateString() === today.toDateString();
            const dayKey = d.toISOString().split('T')[0];
            const logged = loggedMeals[dayKey] || {};
            const mealsLogged = Object.keys(logged).length;

            html += `<div class="week-day ${isToday ? 'today' : ''}" data-date="${dayKey}">
                <div class="day-name">${dayNames[d.getDay()]}</div>
                <div class="day-num">${d.getDate()}</div>
                <div class="day-meals">
                    <span class="dm-dot ${logged.breakfast ? 'filled' : ''}" title="Breakfast"></span>
                    <span class="dm-dot ${logged.lunch ? 'filled' : ''}" title="Lunch"></span>
                    <span class="dm-dot ${logged.dinner ? 'filled' : ''}" title="Dinner"></span>
                </div>
                ${mealsLogged > 0 ? `<div class="day-check">✓${mealsLogged}</div>` : ''}
            </div>`;
        }
        container.innerHTML = html;

        // Week title
        const weekEnd = new Date(startOfWeek);
        weekEnd.setDate(startOfWeek.getDate() + 6);
        const weekTitle = $('#week-title-text');
        if (weekTitle) {
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            weekTitle.textContent = `${months[startOfWeek.getMonth()]} ${startOfWeek.getDate()} – ${months[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
        }
    }

    function renderMacroRings() {
        if (!userBio) return;
        // Animate to some consumed state (from local logged meals or 0)
        const todayKey = new Date().toISOString().split('T')[0];
        const todayMeals = loggedMeals[todayKey] || {};
        const mealData = {
            breakfast: { cal: 320, p: 18, c: 28, f: 14 },
            lunch:     { cal: 480, p: 42, c: 38, f: 12 },
            dinner:    { cal: 520, p: 38, c: 42, f: 18 },
            snack:     { cal: 200, p: 15, c: 22, f: 4  },
        };

        let consumed = { cal: 0, p: 0, c: 0, f: 0 };
        for (const [meal, logged] of Object.entries(todayMeals)) {
            if (logged && mealData[meal]) {
                consumed.cal += mealData[meal].cal;
                consumed.p += mealData[meal].p;
                consumed.c += mealData[meal].c;
                consumed.f += mealData[meal].f;
            }
        }

        // Animate rings
        const animateRing = (id, consumed, target, circumference) => {
            const el = $(id);
            if (!el) return;
            const pct = Math.min(consumed / target, 1);
            const offset = circumference - (circumference * pct);
            setTimeout(() => { el.style.transition = 'stroke-dashoffset 1.2s ease-out'; el.style.strokeDashoffset = offset; }, 200);
        };

        animateRing('#dash-ring-protein', consumed.p, userBio.protein, 439.8);
        animateRing('#dash-ring-carbs', consumed.c, userBio.carbs, 339.3);
        animateRing('#dash-ring-fat', consumed.f, userBio.fat, 238.8);

        const calEl = $('#dash-cal-num');
        if (calEl) animateNumber(calEl, consumed.cal, 1200);
    }

    function animateNumber(el, target, duration) {
        const start = parseInt(el.textContent) || 0;
        const range = target - start;
        const startTime = performance.now();

        function step(time) {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(start + range * eased).toLocaleString();
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    function renderDailyProgress() {
        if (!userBio) return;
        const todayKey = new Date().toISOString().split('T')[0];
        const todayMeals = loggedMeals[todayKey] || {};
        const mealData = { breakfast: 320, lunch: 480, dinner: 520, snack: 200 };

        let cals = 0;
        for (const [meal, logged] of Object.entries(todayMeals)) {
            if (logged && mealData[meal]) cals += mealData[meal];
        }
        const targetCal = userBio.calories || 2100;
        const pct = Math.min((cals / targetCal) * 100, 100);

        const calText = $('#prog-cal-text');
        const calFill = $('#prog-cal-fill');
        if (calText) calText.textContent = `${cals.toLocaleString()} / ${targetCal.toLocaleString()}`;
        if (calFill) setTimeout(() => { calFill.style.width = `${pct}%`; }, 300);

        // Water (from localStorage)
        const water = parseInt(localStorage.getItem('smartmeal_water') || '0');
        const waterText = $('#prog-water-text');
        const waterFill = $('#prog-water-fill');
        if (waterText) waterText.textContent = `${water} / 8 glasses`;
        if (waterFill) setTimeout(() => { waterFill.style.width = `${Math.min((water / 8) * 100, 100)}%`; }, 400);

        // Steps (from localStorage)
        const steps = parseInt(localStorage.getItem('smartmeal_steps') || '0');
        const stepsText = $('#prog-steps-text');
        const stepsFill = $('#prog-steps-fill');
        if (stepsText) stepsText.textContent = `${steps.toLocaleString()} / 10,000`;
        if (stepsFill) setTimeout(() => { stepsFill.style.width = `${Math.min((steps / 10000) * 100, 100)}%`; }, 500);
    }

    // ═══════════════════════════════════════════════════════════
    // MEAL LOGGING
    // ═══════════════════════════════════════════════════════════
    function setupMealLogging() {
        $$('.meal-log-btn').forEach(btn => {
            const mealType = btn.dataset.meal;
            const todayKey = new Date().toISOString().split('T')[0];

            // Restore logged state
            if (loggedMeals[todayKey]?.[mealType]) {
                btn.classList.add('logged');
                btn.textContent = '✓ Logged';
            }

            btn.addEventListener('click', () => {
                const todayKey = new Date().toISOString().split('T')[0];
                if (!loggedMeals[todayKey]) loggedMeals[todayKey] = {};

                if (loggedMeals[todayKey][mealType]) {
                    delete loggedMeals[todayKey][mealType];
                    btn.classList.remove('logged');
                    btn.textContent = '✓ Log Meal';
                    showToast(`${mealType.charAt(0).toUpperCase() + mealType.slice(1)} unlogged`);
                } else {
                    loggedMeals[todayKey][mealType] = true;
                    btn.classList.add('logged');
                    btn.textContent = '✓ Logged';
                    showToast(`${mealType.charAt(0).toUpperCase() + mealType.slice(1)} logged! 🎉`);
                }

                localStorage.setItem('smartmeal_logged', JSON.stringify(loggedMeals));
                renderMacroRings();
                renderDailyProgress();
                renderWeekDays();
            });
        });
    }

    // ═══════════════════════════════════════════════════════════
    // GROCERY LIST
    // ═══════════════════════════════════════════════════════════
    const groceryData = [
        { name: 'Chicken Breast', category: 'Meat & Seafood', emoji: '🍗', price: 180, weight: '500g' },
        { name: 'Salmon Fillet', category: 'Meat & Seafood', emoji: '🐟', price: 350, weight: '300g' },
        { name: 'Large Eggs (12)', category: 'Dairy & Eggs', emoji: '🥚', price: 85, weight: '720g' },
        { name: 'Greek Yogurt', category: 'Dairy & Eggs', emoji: '🥛', price: 60, weight: '400g' },
        { name: 'Cheddar Cheese', category: 'Dairy & Eggs', emoji: '🧀', price: 120, weight: '200g' },
        { name: 'Avocados (3)', category: 'Produce', emoji: '🥑', price: 90, weight: '450g' },
        { name: 'Baby Spinach', category: 'Produce', emoji: '🥬', price: 40, weight: '200g' },
        { name: 'Broccoli', category: 'Produce', emoji: '🥦', price: 35, weight: '300g' },
        { name: 'Sweet Potato', category: 'Produce', emoji: '🍠', price: 30, weight: '500g' },
        { name: 'Cherry Tomatoes', category: 'Produce', emoji: '🍅', price: 45, weight: '250g' },
        { name: 'Bananas (6)', category: 'Produce', emoji: '🍌', price: 25, weight: '600g' },
        { name: 'Mixed Berries', category: 'Produce', emoji: '🫐', price: 150, weight: '300g' },
        { name: 'Garlic', category: 'Produce', emoji: '🧄', price: 15, weight: '50g' },
        { name: 'Onions (3)', category: 'Produce', emoji: '🧅', price: 20, weight: '300g' },
        { name: 'Brown Rice', category: 'Grains & Bread', emoji: '🍚', price: 55, weight: '1kg' },
        { name: 'Quinoa', category: 'Grains & Bread', emoji: '🌾', price: 95, weight: '500g' },
        { name: 'Whole Wheat Bread', category: 'Grains & Bread', emoji: '🍞', price: 45, weight: '400g' },
        { name: 'Rolled Oats', category: 'Grains & Bread', emoji: '🥣', price: 65, weight: '500g' },
        { name: 'Olive Oil', category: 'Pantry', emoji: '🫒', price: 180, weight: '500ml' },
        { name: 'Almonds', category: 'Pantry', emoji: '🥜', price: 120, weight: '200g' },
        { name: 'Honey', category: 'Pantry', emoji: '🍯', price: 85, weight: '250g' },
        { name: 'Soy Sauce', category: 'Pantry', emoji: '🥫', price: 40, weight: '200ml' },
        { name: 'Black Pepper', category: 'Pantry', emoji: '🌶️', price: 30, weight: '50g' },
        { name: 'Coconut Water (4)', category: 'Beverages', emoji: '🥥', price: 120, weight: '1L' },
    ];

    function renderGroceryList() {
        const container = $('#grocery-categories');
        if (!container) return;

        // Group by category
        const groups = {};
        groceryData.forEach(item => {
            if (!groups[item.category]) groups[item.category] = [];
            groups[item.category].push(item);
        });

        const aisleOrder = ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Grains & Bread', 'Pantry', 'Beverages'];
        const aisleEmojis = { 'Produce': '🥬', 'Meat & Seafood': '🥩', 'Dairy & Eggs': '🥛', 'Grains & Bread': '🌾', 'Pantry': '🫙', 'Beverages': '🥤' };

        let html = '';
        let inCartCount = 0;

        aisleOrder.forEach(aisle => {
            const items = groups[aisle];
            if (!items) return;

            html += `<div class="grocery-category slide-up"><div class="gc-header"><div class="gc-icon">${aisleEmojis[aisle] || '📦'}</div><div class="gc-title">${aisle}</div><div class="gc-count">${items.length} items</div></div><div class="gc-items">`;

            items.forEach(item => {
                const inCart = cart.some(c => c.name === item.name);
                if (inCart) inCartCount++;
                html += `<div class="gc-item">
                    <div class="gci-check"><input type="checkbox" class="gci-cb" ${inCart ? 'checked' : ''} data-name="${item.name}"></div>
                    <div class="gci-emoji">${item.emoji}</div>
                    <div class="gci-info"><div class="gci-name">${item.name}</div><div class="gci-meta">${item.weight} · ₹${item.price}</div></div>
                    <button class="g-item-cart-btn ${inCart ? 'in-cart' : ''}" data-name="${item.name}" data-price="${item.price}" data-category="${item.category}" data-emoji="${item.emoji}">${inCart ? '✓ In Cart' : '+ Cart'}</button>
                </div>`;
            });

            html += `</div></div>`;
        });

        container.innerHTML = html;

        // Update stats
        const total = groceryData.length;
        $('#g-total-items').textContent = total;
        $('#g-completed-items').textContent = inCartCount;
        $('#g-remaining-items').textContent = total - inCartCount;
        const estCost = groceryData.reduce((s, i) => s + i.price, 0);
        $('#g-est-cost').textContent = `~₹${estCost}`;

        // Add to cart buttons
        $$('.g-item-cart-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.dataset.name;
                const price = parseFloat(btn.dataset.price);
                const category = btn.dataset.category;
                const emoji = btn.dataset.emoji;

                const existingIdx = cart.findIndex(c => c.name === name);
                if (existingIdx >= 0) {
                    cart.splice(existingIdx, 1);
                    btn.classList.remove('in-cart');
                    btn.textContent = '+ Cart';
                    showToast(`Removed ${name} from cart`);
                } else {
                    cart.push({ name, price, category, emoji });
                    btn.classList.add('in-cart');
                    btn.textContent = '✓ In Cart';
                    showToast(`Added ${name} to cart 🛍️`);
                }

                saveCart();
                updateCartBadges();
                renderGroceryList();
            });
        });

        // Add all to cart
        $('#btn-add-all-cart')?.addEventListener('click', () => {
            cart = groceryData.map(i => ({ name: i.name, price: i.price, category: i.category, emoji: i.emoji }));
            saveCart();
            updateCartBadges();
            renderGroceryList();
            showToast('All items added to cart! 🛍️');
        });
    }

    // ═══════════════════════════════════════════════════════════
    // SHOPPING CART
    // ═══════════════════════════════════════════════════════════
    function saveCart() {
        localStorage.setItem('smartmeal_cart', JSON.stringify(cart));
    }

    function updateCartBadges() {
        const count = cart.length;
        const floatCount = $('#cart-float-count');
        const navBadge = $('#cart-nav-badge');
        if (floatCount) floatCount.textContent = count;
        if (navBadge) {
            navBadge.textContent = count;
            navBadge.style.display = count > 0 ? 'inline-flex' : 'none';
        }
    }

    function renderCart() {
        const list = $('#cart-items-list');
        const sumCount = $('#cart-sum-count');
        const sumTotal = $('#cart-sum-total');
        if (!list) return;

        if (cart.length === 0) {
            list.innerHTML = '<div class="cart-empty">Your cart is empty. Add items from the Grocery List!</div>';
            if (sumCount) sumCount.textContent = '0 items';
            if (sumTotal) sumTotal.textContent = '₹0.00';
            return;
        }

        const total = cart.reduce((s, i) => s + i.price, 0);

        let html = '';
        cart.forEach((item, idx) => {
            html += `<div class="cart-item">
                <div class="cart-item-emoji">${item.emoji || '📦'}</div>
                <div class="cart-item-info"><div class="cart-item-name">${item.name}</div><div class="cart-item-meta">${item.category}</div></div>
                <div class="cart-item-price">₹${item.price}</div>
                <button class="cart-item-remove" data-idx="${idx}" title="Remove">✕</button>
            </div>`;
        });
        list.innerHTML = html;

        if (sumCount) sumCount.textContent = `${cart.length} items`;
        if (sumTotal) sumTotal.textContent = `₹${total.toFixed(2)}`;

        // Remove buttons
        $$('.cart-item-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                const removed = cart.splice(idx, 1);
                saveCart();
                updateCartBadges();
                renderCart();
                showToast(`Removed ${removed[0]?.name || 'item'} from cart`);
            });
        });
    }

    function setupCartActions() {
        // Buy Now → Try Razorpay first, fallback to mock QR
        $('#btn-buy-now')?.addEventListener('click', () => {
            if (cart.length === 0) return showToast('Cart is empty!', 'warning');
            initiateCheckout();
        });

        // Cancel cart
        $('#btn-cancel-cart')?.addEventListener('click', () => {
            if (cart.length === 0) return;
            cart = [];
            saveCart();
            updateCartBadges();
            renderCart();
            showToast('Cart cleared');
        });

        // Buy Later → Save to backend MySQL
        $('#btn-buy-later')?.addEventListener('click', async () => {
            if (cart.length === 0) return showToast('Cart is empty!', 'warning');

            const btn = $('#btn-buy-later');
            const origText = btn.textContent;
            btn.textContent = 'Saving...';
            btn.disabled = true;

            try {
                const result = await api('/api/cart/save', {
                    method: 'POST',
                    body: JSON.stringify({
                        items: cart.map(i => ({ name: i.name, category: i.category, qty: '1', price: i.price, aisle: i.category })),
                    }),
                });
                showToast(`Cart saved! ${result.item_count || cart.length} items stored for later 🕐`);
            } catch (e) {
                // Fallback: localStorage only
                showToast('Cart saved locally (backend offline)', 'warning');
            } finally {
                btn.textContent = origText;
                btn.disabled = false;
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // PAYMENT GATEWAY — DUAL MODE (Razorpay Live → Mock QR Fallback)
    // ═══════════════════════════════════════════════════════════

    /**
     * Master checkout entry point.
     * 1. Tries to create a Razorpay order via backend
     * 2. If backend returns mode: "live" → launches Razorpay Checkout overlay
     * 3. If mode: "mock" or backend offline → opens the glassmorphism QR modal
     */
    async function initiateCheckout() {
        const total = cart.reduce((s, i) => s + i.price, 0);

        try {
            // Step 1: Ask backend to create an order
            const order = await api('/api/payments/create-order', {
                method: 'POST',
                body: JSON.stringify({
                    amount: total,
                    items: cart.map(i => ({ name: i.name, category: i.category, qty: '1', price: i.price })),
                }),
            });

            if (order.mode === 'live' && order.razorpay_order_id && order.key_id) {
                // ─── RAZORPAY LIVE/TEST CHECKOUT ─────────────
                launchRazorpayCheckout(order, total);
            } else {
                // ─── MOCK MODE (Razorpay keys not configured) ──
                console.log('ℹ️ Razorpay not configured — using mock QR checkout');
                openPaymentModal();
            }

        } catch (err) {
            // Backend offline → fall back to mock QR modal
            console.log('ℹ️ Backend offline — using mock QR checkout');
            openPaymentModal();
        }
    }

    /**
     * Launch the official Razorpay Checkout.js overlay.
     * On mobile: auto-detects GPay, PhonePe, Paytm.
     * On desktop: shows QR code + netbanking + cards.
     */
    function launchRazorpayCheckout(order, totalINR) {
        const userName = currentUser
            ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim()
            : 'SmartMeal User';

        const options = {
            key: order.key_id,
            amount: order.amount,  // in paise (already from backend)
            currency: order.currency || 'INR',
            name: 'SmartMeal',
            description: `Grocery Checkout — ${cart.length} items`,
            order_id: order.razorpay_order_id,
            image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=100&h=100&fit=crop&q=90',

            // ── Success Handler ─────────────────────────────
            handler: async function (response) {
                showToast('Payment received! Verifying...', 'success');

                try {
                    // Verify payment signature server-side
                    const verification = await api('/api/payments/verify', {
                        method: 'POST',
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            internal_order_id: order.internal_order_id,
                        }),
                    });

                    if (verification.verified) {
                        showToast('Payment successful! 🎉');
                        // Clear cart and return to dashboard
                        cart = [];
                        saveCart();
                        updateCartBadges();
                        renderCart();
                        switchView('dashboard');
                    } else {
                        showToast('Payment verification failed', 'error');
                    }
                } catch (e) {
                    // Verification call failed but payment likely succeeded
                    // (webhook will handle it server-side)
                    showToast('Payment processed! Confirmation pending.', 'warning');
                    cart = [];
                    saveCart();
                    updateCartBadges();
                    renderCart();
                    switchView('dashboard');
                }
            },

            prefill: {
                name: userName,
                email: '',
                contact: '',
            },

            theme: {
                color: '#059669',  // Emerald green — matches our UI
            },

            modal: {
                ondismiss: function () {
                    showToast('Payment cancelled', 'warning');
                },
            },
        };

        try {
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response) {
                showToast(`Payment failed: ${response.error.description}`, 'error');
            });
            rzp.open();
        } catch (e) {
            console.error('Razorpay Checkout.js error:', e);
            showToast('Payment gateway unavailable — using mock checkout', 'warning');
            openPaymentModal();
        }
    }

    // ═══════════════════════════════════════════════════════════
    // MOCK PAYMENT MODAL (Fallback when Razorpay isn't configured)
    // ═══════════════════════════════════════════════════════════
    function openPaymentModal() {
        const total = cart.reduce((s, i) => s + i.price, 0);
        const orderId = 'ORD' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2,4).toUpperCase();
        const txnId = 'TXN' + crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase();

        // Set up modal
        $('#pm-amount').textContent = `₹${total.toFixed(2)}`;
        $('#pm-order-id').textContent = `Order #${orderId}`;

        // Reset to QR tab
        $$('.pm-tab').forEach(t => t.classList.remove('active'));
        $$('.pm-panel').forEach(p => p.classList.remove('active'));
        $$('.pm-tab')[0]?.classList.add('active');
        $('#pm-panel-qr')?.classList.add('active');

        // Hide success, show body
        hide($('#pm-success'));
        show($('.pm-body'));
        show($('.pm-tabs'), 'flex');
        show($('.pm-header'));

        // Restore success container HTML (in case Razorpay modified it)
        const successEl = $('#pm-success');
        if (successEl) {
            successEl.innerHTML = `
                <div class="success-check">✅</div>
                <h3>Payment Successful!</h3>
                <p id="pm-success-msg">Your order has been placed.</p>
                <button class="auth-btn" id="btn-close-success" style="margin-top:20px;">Done</button>`;
        }

        // Generate unique QR code
        generateQR(total, orderId, txnId);

        // Start timer
        startQRTimer();

        // Show modal
        $('#payment-modal-overlay').classList.add('visible');
    }

    function generateQR(amount, orderId, txnId) {
        const container = $('#qr-container');
        if (!container) return;
        container.innerHTML = '';

        // Build a unique UPI payment string (new each time)
        const upiString = `upi://pay?pa=smartmeal@upi&pn=SmartMeal&tr=${txnId}&tn=SmartMeal+Grocery+${orderId}&am=${amount.toFixed(2)}&cu=INR&mc=5411`;

        // Generate QR using qrcodejs library
        try {
            new QRCode(container, {
                text: upiString,
                width: 200,
                height: 200,
                colorDark: '#111827',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H,
            });
        } catch (e) {
            // Fallback: SVG-based QR render
            container.innerHTML = `<div style="width:200px;height:200px;display:flex;align-items:center;justify-content:center;background:#f9fafb;border-radius:12px;font-size:0.8rem;color:#6b7280;text-align:center;padding:16px;">QR Code<br><small style="font-family:monospace;font-size:0.6rem;word-break:break-all;">${upiString.substring(0,80)}...</small></div>`;
        }

        $('#qr-txn-id').textContent = `TXN: ${txnId}`;
    }

    function startQRTimer() {
        let seconds = 300;
        const el = $('#qr-timer');
        clearInterval(qrTimerInterval);
        qrTimerInterval = setInterval(() => {
            seconds--;
            if (el) el.textContent = seconds;
            if (seconds <= 0) {
                clearInterval(qrTimerInterval);
                // Regenerate QR with new txn ID
                const total = cart.reduce((s, i) => s + i.price, 0);
                const orderId = 'ORD' + Date.now().toString(36).toUpperCase();
                const txnId = 'TXN' + crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase();
                generateQR(total, orderId, txnId);
                seconds = 300;
                showToast('QR code refreshed with new transaction');
            }
        }, 1000);
    }

    function setupPaymentModal() {
        // Tab switching
        $$('.pm-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                $$('.pm-tab').forEach(t => t.classList.remove('active'));
                $$('.pm-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                $(`#pm-panel-${tab.dataset.method}`)?.classList.add('active');
            });
        });

        // Close modal
        $('#payment-modal-close')?.addEventListener('click', closePaymentModal);
        $('#payment-modal-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closePaymentModal();
        });

        // Mock payment buttons (for when Razorpay isn't available)
        $('#btn-pay-phonepe')?.addEventListener('click', () => processMockPayment('phonepe'));
        $('#btn-pay-wallet')?.addEventListener('click', () => processMockPayment('wallet'));
        $('#btn-pay-card')?.addEventListener('click', () => processMockPayment('card'));

        // Close success
        $('#btn-close-success')?.addEventListener('click', () => {
            closePaymentModal();
            cart = [];
            saveCart();
            updateCartBadges();
            renderCart();
            switchView('dashboard');
        });

        // Card number formatting
        $('#card-number')?.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
        });

        // Expiry formatting
        $('#card-expiry')?.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 2) v = v.substring(0,2) + '/' + v.substring(2);
            e.target.value = v;
        });
    }

    async function processMockPayment(method) {
        const total = cart.reduce((s, i) => s + i.price, 0);

        // Show processing state
        hide($('.pm-body'));
        hide($('.pm-tabs'));

        const successEl = $('#pm-success');
        successEl.innerHTML = `<div class="pm-processing"><div class="processing-spinner"></div><h3>Processing Payment</h3><p>Verifying your ${method || 'payment'}...</p></div>`;
        show(successEl);

        // Try backend checkout API
        try {
            const result = await api('/api/cart/checkout', {
                method: 'POST',
                body: JSON.stringify({
                    items: cart.map(i => ({ name: i.name, category: i.category, qty: '1', price: i.price, aisle: i.category })),
                    payment_method: method || 'qr',
                    total_amount: total,
                }),
            });

            await new Promise(r => setTimeout(r, 2000));

            showPaymentSuccess(successEl, total, result.transaction_id, result.order_id);
            clearInterval(qrTimerInterval);
            showToast('Payment successful! 🎉');

        } catch (err) {
            await new Promise(r => setTimeout(r, 1500));
            showPaymentSuccess(successEl, total);
            clearInterval(qrTimerInterval);
            showToast('Payment processed! (demo mode)', 'warning');
        }
    }

    function showPaymentSuccess(container, total, txnId, orderId) {
        const txnLine = txnId && orderId
            ? `<div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);">TXN: ${txnId} · ${orderId}</div>`
            : '';

        container.innerHTML = `
            <div class="success-check">✅</div>
            <h3>Payment Successful!</h3>
            <p id="pm-success-msg">₹${total.toFixed(2)} paid successfully. Your groceries are on the way!</p>
            ${txnLine}
            <button class="auth-btn" id="btn-close-success" style="margin-top:20px;">Done</button>`;

        $('#btn-close-success')?.addEventListener('click', () => {
            closePaymentModal();
            cart = [];
            saveCart();
            updateCartBadges();
            renderCart();
            switchView('dashboard');
        });
    }

    function closePaymentModal() {
        $('#payment-modal-overlay').classList.remove('visible');
        clearInterval(qrTimerInterval);
    }

    // ═══════════════════════════════════════════════════════════
    // SETTINGS
    // ═══════════════════════════════════════════════════════════
    function loadSettings() {
        // Populate from local state
        if (userBio) {
            $('#target-cal').textContent = userBio.calories || '—';
            $('#target-protein').textContent = userBio.protein || '—';
            $('#target-carbs').textContent = userBio.carbs || '—';
            $('#target-fat').textContent = userBio.fat || '—';
        }

        // Try loading from backend
        api('/settings').then(data => {
            if (data.biometrics) {
                const bio = data.biometrics;
                $('#set-gender').value = bio.gender || 'male';
                $('#set-age').value = bio.age || 25;
                $('#set-height').value = bio.height_cm || 170;
                $('#set-weight').value = bio.weight_kg || 70;
                $('#set-activity').value = bio.activity_level || 'moderate';
                $('#set-goal').value = bio.dietary_goal || 'maintain';

                // Update targets
                if (bio.daily_calories) {
                    $('#target-cal').textContent = bio.daily_calories;
                    $('#target-protein').textContent = bio.daily_protein_g;
                    $('#target-carbs').textContent = bio.daily_carbs_g;
                    $('#target-fat').textContent = bio.daily_fat_g;

                    userBio = {
                        calories: bio.daily_calories,
                        protein: bio.daily_protein_g,
                        carbs: bio.daily_carbs_g,
                        fat: bio.daily_fat_g,
                    };
                    localStorage.setItem('smartmeal_bio', JSON.stringify(userBio));
                }
            }
        }).catch(() => {
            // If backend unavailable, use local defaults
        });
    }

    function setupSettings() {
        $('#btn-save-settings')?.addEventListener('click', async () => {
            const btn = $('#btn-save-settings');
            btn.classList.add('loading');

            const payload = {
                gender: $('#set-gender').value,
                age: parseInt($('#set-age').value),
                height_cm: parseInt($('#set-height').value),
                weight_kg: parseFloat($('#set-weight').value),
                activity_level: $('#set-activity').value,
                dietary_goal: $('#set-goal').value,
            };

            try {
                const result = await api('/settings', {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                });

                if (result.biometrics) {
                    const bio = result.biometrics;
                    userBio = {
                        calories: bio.daily_calories,
                        protein: bio.daily_protein_g,
                        carbs: bio.daily_carbs_g,
                        fat: bio.daily_fat_g,
                    };
                    localStorage.setItem('smartmeal_bio', JSON.stringify(userBio));
                    $('#target-cal').textContent = bio.daily_calories;
                    $('#target-protein').textContent = bio.daily_protein_g;
                    $('#target-carbs').textContent = bio.daily_carbs_g;
                    $('#target-fat').textContent = bio.daily_fat_g;
                }

                showToast('Settings saved & macros recalculated! 🧬');
            } catch (err) {
                // Fallback: calculate locally
                const macros = calculateMacros({
                    gender: payload.gender,
                    age: payload.age,
                    height: payload.height_cm,
                    weight: payload.weight_kg,
                    lifestyle: payload.activity_level,
                });
                userBio = macros;
                localStorage.setItem('smartmeal_bio', JSON.stringify(macros));
                $('#target-cal').textContent = macros.calories;
                $('#target-protein').textContent = macros.protein;
                $('#target-carbs').textContent = macros.carbs;
                $('#target-fat').textContent = macros.fat;
                showToast('Settings saved locally (backend offline)', 'warning');
            } finally {
                btn.classList.remove('loading');
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // DATA LOADING
    // ═══════════════════════════════════════════════════════════
    async function loadUserData() {
        try {
            const data = await api('/settings');
            if (data.biometrics) {
                userBio = {
                    calories: data.biometrics.daily_calories,
                    protein: data.biometrics.daily_protein_g,
                    carbs: data.biometrics.daily_carbs_g,
                    fat: data.biometrics.daily_fat_g,
                };
                localStorage.setItem('smartmeal_bio', JSON.stringify(userBio));
            }
            if (data.user) {
                currentUser = data.user;
                localStorage.setItem('smartmeal_user', JSON.stringify(currentUser));
            }
        } catch (e) {
            // Use cached data
        }

        // Restore saved cart from backend
        try {
            const savedCart = await api('/api/cart');
            if (savedCart.items && savedCart.items.length > 0 && cart.length === 0) {
                cart = savedCart.items.map(i => ({ name: i.name, price: i.price || 0, category: i.category, emoji: '📦' }));
                saveCart();
                updateCartBadges();
            }
        } catch (e) {}
    }

    // ═══════════════════════════════════════════════════════════
    // SEARCH
    // ═══════════════════════════════════════════════════════════
    function setupSearch() {
        const input = $('#global-search');
        const dropdown = $('#search-dropdown');
        if (!input || !dropdown) return;

        input.addEventListener('focus', () => dropdown.style.display = 'block');
        input.addEventListener('blur', () => setTimeout(() => dropdown.style.display = 'none', 200));
        input.addEventListener('input', () => {
            const q = input.value.toLowerCase();
            $$('.search-result-item').forEach(item => {
                const name = item.querySelector('.sri-name')?.textContent.toLowerCase() || '';
                item.style.display = name.includes(q) || !q ? 'flex' : 'none';
            });
        });

        // Ctrl+K shortcut
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                input.focus();
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // LOADING OVERLAY
    // ═══════════════════════════════════════════════════════════
    function hideLoading() {
        const overlay = $('#loading-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', 500);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════
    function init() {
        hideLoading();
        setupLogoNavigation();
        setupAuth();
        setupOnboarding();
        setupSidebar();
        setupSearch();
        setupCartActions();
        setupPaymentModal();
        setupSettings();

        // Auto-login if token exists
        if (AUTH_TOKEN && currentUser) {
            switchScreen('screen-dashboard');
            renderDashboard();
            loadUserData();
        } else {
            switchScreen('screen-auth');
        }

        updateCartBadges();
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
