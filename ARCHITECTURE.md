# Smart Meal Planner & Grocery Engine — Master Architecture

> **Read this file first.** It contains the complete system blueprint, tech decisions, database schemas, API contracts, and module interconnections. Every component in this repository is part of a single cohesive, interconnected system.

---

## 1. Mission Statement

A **premium, AI-powered health and fitness platform** that generates personalized meal plans based on a user's biometrics, tracks daily macro consumption, produces C-engine-sorted grocery lists, and processes real payments through Razorpay — all wrapped in a vibrant, glassmorphism-styled UI.

---

## 2. Tech Stack Decisions

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Vanilla HTML/CSS/JS (Inter font, glassmorphism, bento-grid) | Zero build step, instant load, full control over design system |
| **Backend** | Python 3 + FastAPI (async) | Lightning-fast REST API, built-in Swagger docs, native async/await |
| **Database** | MySQL 8.0 (Docker) | ACID-compliant, relational, production-proven |
| **DB Driver** | `aiomysql` (async) | Non-blocking connection pooling for concurrent requests |
| **Auth** | JWT (python-jose + bcrypt) | Stateless session management, bcrypt password hashing |
| **Recipes** | Edamam Recipe Search API v2 | Real nutritional data, 2.3M+ recipes, macro breakdowns |
| **Sorting** | Custom C algorithm via `ctypes` | Bare-metal performance for large grocery list sorting |
| **Payments** | Razorpay SDK + Checkout.js | Licensed payment aggregator, supports UPI/GPay/PhonePe/Cards |
| **Realtime** | WebSocket + HTTP polling fallback | Push notifications without third-party services |

---

## 3. Project Structure (Monorepo)

```
d:\MEALONE\
│
├── index.html                  # Single-page frontend — auth, dashboard, grocery, cart, settings
├── styles.css                  # Complete CSS design system (2600+ lines)
├── app.js                      # Frontend logic — API calls, state management, routing
├── ARCHITECTURE.md             # ← YOU ARE HERE (God Mode context file)
├── docker-compose.yml          # One-command MySQL: `docker compose up -d`
│
├── backend/
│   ├── main.py                 # FastAPI app — CORS, lifespan, router assembly
│   ├── config.py               # All env vars: DB, JWT, Edamam, Razorpay, C-Engine
│   ├── database.py             # aiomysql connection pool (init/get/close)
│   ├── schema.sql              # All 8 MySQL tables (see Section 6)
│   ├── requirements.txt        # Python dependencies
│   ├── .env.example            # Template for secrets
│   │
│   ├── auth/                   # POST /auth/register, /auth/login
│   │   ├── routes.py           # Registration + login endpoints
│   │   ├── jwt_handler.py      # create_token(), get_current_user() dependency
│   │   └── models.py           # Pydantic: RegisterRequest, LoginRequest
│   │
│   ├── users/                  # GET/PUT /settings, /settings/profile
│   │   ├── routes.py           # Biometric CRUD + macro recalculation
│   │   └── models.py           # Pydantic: BiometricUpdate, ProfileResponse
│   │
│   ├── meals/                  # GET /api/meals/generate, POST /api/meals/log
│   │   ├── routes.py           # 7-day plan generation, meal swapping, logging
│   │   ├── edamam_service.py   # Edamam API client (httpx async)
│   │   └── models.py           # Pydantic: MealPlan, MealSwap, MealLog
│   │
│   ├── grocery/                # GET /api/grocery-list
│   │   ├── routes.py           # Grocery list extraction + C-engine sorting
│   │   ├── c_bridge.py         # ctypes wrapper for grocery_sort.dll/.so
│   │   └── models.py           # Pydantic: GroceryItem, SortedList
│   │
│   ├── progress/               # GET /api/progress/today, POST /api/progress/water
│   │   ├── routes.py           # Daily macro tracking, water/steps logging
│   │   └── models.py           # Pydantic: DailyProgress, WaterLog
│   │
│   ├── notifications/          # WS /ws/notifications, GET /api/notifications
│   │   ├── websocket.py        # WebSocket manager + HTTP polling fallback
│   │   └── models.py           # Pydantic: Notification
│   │
│   ├── cart/                   # POST /api/cart/save, /checkout
│   │   └── routes.py           # Save/load cart, mock checkout with UPI string generation
│   │
│   ├── payments/               # POST /api/payments/create-order, /verify, /webhooks/razorpay
│   │   ├── routes.py           # Razorpay order creation, verification, webhook handler
│   │   └── razorpay_service.py # SDK wrapper: create_order, verify_signature, verify_webhook
│   │
│   └── c_engine/               # Bare-metal C sorting algorithm
│       ├── grocery_sort.c      # QuickSort for grocery items by category/aisle
│       ├── grocery_sort.h      # Header file
│       └── Makefile            # Build: `make` → grocery_sort.dll (Windows) / .so (Linux)
```

---

## 4. How Everything Connects (Module Interconnections)

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND (index.html + app.js)    │
│                                                     │
│  Auth Screen ──→ POST /auth/login ──→ JWT Token     │
│       ↓                                             │
│  Dashboard ───→ GET /settings ──→ Biometrics        │
│       │         GET /api/meals/generate ──→ Edamam  │
│       │         GET /api/progress/today             │
│       ↓                                             │
│  Grocery List → GET /api/grocery-list ──→ C-Engine  │
│       ↓                                             │
│  Cart ────────→ POST /api/cart/save (Buy Later)     │
│       ↓                                             │
│  Checkout ────→ POST /api/payments/create-order     │
│       │         ├── mode: "live" → Razorpay Overlay │
│       │         └── mode: "mock" → QR Code Modal    │
│       ↓                                             │
│  Payment ─────→ POST /api/payments/verify           │
│                 POST /api/webhooks/razorpay (server) │
└─────────────────────────────────────────────────────┘
```

### Data Flow: User Signs Up → First Purchase

1. **Register:** `POST /auth/register` → bcrypt hash → `users` table
2. **Onboarding:** `PUT /settings` → `user_biometrics` table → Mifflin-St Jeor → macros calculated
3. **Meal Plan:** `GET /api/meals/generate` → Edamam API → 28 meals → `weekly_plans` + `plan_meals`
4. **Grocery List:** `GET /api/grocery-list` → extracts ingredients → C-engine sort → frontend
5. **Add to Cart:** Client-side `localStorage` → `POST /api/cart/save` → `saved_carts`
6. **Checkout:** `POST /api/payments/create-order` → Razorpay SDK → `transactions` (status: created)
7. **Pay:** User pays via UPI/Card → Razorpay fires `payment.captured` webhook → `transactions` (status: paid)
8. **Track:** `POST /api/meals/log` → `daily_progress` updated → macro rings animate

---

## 5. Macro Calculation Engine (Mifflin-St Jeor)

The backend auto-calculates personalized nutrition targets on every biometric update:

```
BMR (Male)   = 10 × weight_kg + 6.25 × height_cm - 5 × age + 5
BMR (Female) = 10 × weight_kg + 6.25 × height_cm - 5 × age - 161

Activity Multipliers:
  sedentary  = 1.2
  moderate   = 1.55
  active     = 1.725
  athlete    = 1.9

TDEE = BMR × activity_multiplier

Protein = 2g × weight_kg (or adjusted by dietary_goal)
Fat     = (TDEE × 0.25) / 9
Carbs   = (TDEE - protein×4 - fat×9) / 4
```

---

## 6. MySQL Database Schema (8 Tables)

### Table Relationship Map

```
users (1)──────(1) user_biometrics
  │
  ├──(1:many)── weekly_plans ──(1:many)── plan_meals
  │
  ├──(1:many)── daily_progress
  │
  ├──(1:many)── notifications
  │
  ├──(1:many)── saved_carts
  │
  └──(1:many)── transactions (Razorpay + mock)
```

### Table 1: `users` — Core authentication & profile
```sql
CREATE TABLE users (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL DEFAULT '',
    avatar_url      VARCHAR(512) DEFAULT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Table 2: `user_biometrics` — Physical metrics + calculated macro goals
```sql
CREATE TABLE user_biometrics (
    user_id         INT UNSIGNED PRIMARY KEY,
    gender          ENUM('male','female','other') DEFAULT 'male',
    age             TINYINT UNSIGNED DEFAULT 25,
    height_cm       SMALLINT UNSIGNED DEFAULT 170,
    weight_kg       DECIMAL(5,1) DEFAULT 70.0,
    activity_level  ENUM('sedentary','moderate','active','athlete') DEFAULT 'moderate',
    daily_calories  SMALLINT UNSIGNED DEFAULT 2000,
    daily_protein_g SMALLINT UNSIGNED DEFAULT 150,
    daily_carbs_g   SMALLINT UNSIGNED DEFAULT 250,
    daily_fat_g     SMALLINT UNSIGNED DEFAULT 67,
    dietary_goal    ENUM('lose_weight','maintain','build_muscle','high_protein') DEFAULT 'maintain',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Table 3: `weekly_plans` — 7-day meal plan containers
```sql
CREATE TABLE weekly_plans (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,
    week_start      DATE NOT NULL,
    week_end        DATE NOT NULL,
    status          ENUM('active','archived','draft') DEFAULT 'active',
    total_calories  INT UNSIGNED DEFAULT 0,
    total_protein_g INT UNSIGNED DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Table 4: `plan_meals` — Individual meals linked to Edamam recipes
```sql
CREATE TABLE plan_meals (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plan_id         INT UNSIGNED NOT NULL,
    user_id         INT UNSIGNED NOT NULL,
    day_of_week     TINYINT UNSIGNED NOT NULL,          -- 0=Monday, 6=Sunday
    meal_type       ENUM('breakfast','lunch','dinner','snack') NOT NULL,
    edamam_uri      VARCHAR(512) NOT NULL,              -- Edamam recipe unique URI
    recipe_label    VARCHAR(255) NOT NULL,
    recipe_image    VARCHAR(512),
    calories        SMALLINT UNSIGNED DEFAULT 0,
    protein_g       DECIMAL(5,1) DEFAULT 0.0,
    carbs_g         DECIMAL(5,1) DEFAULT 0.0,
    fat_g           DECIMAL(5,1) DEFAULT 0.0,
    ingredients_json JSON NOT NULL,                     -- For grocery extraction
    is_logged       BOOLEAN DEFAULT FALSE,              -- User ate this meal
    FOREIGN KEY (plan_id) REFERENCES weekly_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Table 5: `daily_progress` — Daily macro tracking
```sql
CREATE TABLE daily_progress (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             INT UNSIGNED NOT NULL,
    log_date            DATE NOT NULL,
    consumed_calories   SMALLINT UNSIGNED DEFAULT 0,
    consumed_protein_g  DECIMAL(5,1) DEFAULT 0.0,
    consumed_carbs_g    DECIMAL(5,1) DEFAULT 0.0,
    consumed_fat_g      DECIMAL(5,1) DEFAULT 0.0,
    target_calories     SMALLINT UNSIGNED DEFAULT 2000,
    target_protein_g    SMALLINT UNSIGNED DEFAULT 150,
    water_glasses       TINYINT UNSIGNED DEFAULT 0,
    steps               INT UNSIGNED DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE INDEX (user_id, log_date)
);
```

### Table 6: `notifications`
```sql
CREATE TABLE notifications (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    type        ENUM('meal_reminder','goal_achieved','grocery_ready','plan_generated','system') DEFAULT 'system',
    title       VARCHAR(255) NOT NULL,
    message     TEXT NOT NULL,
    icon        VARCHAR(10) DEFAULT '🔔',
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Table 7: `saved_carts` — "Buy Later" persistence
```sql
CREATE TABLE saved_carts (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    cart_data   JSON NOT NULL,
    item_count  SMALLINT UNSIGNED DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Table 8: `transactions` — Payment records (Mock + Razorpay)
```sql
CREATE TABLE transactions (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             INT UNSIGNED NOT NULL,
    transaction_id      VARCHAR(64) NOT NULL UNIQUE,
    order_id            VARCHAR(64) NOT NULL UNIQUE,
    payment_method      VARCHAR(20) DEFAULT 'qr',       -- qr|phonepe|wallet|card|razorpay
    amount              DECIMAL(10,2) NOT NULL,
    status              VARCHAR(20) DEFAULT 'pending',   -- created|pending|paid|success|failed|refunded
    upi_string          TEXT DEFAULT NULL,
    items_json          JSON NOT NULL,
    razorpay_order_id   VARCHAR(128) DEFAULT NULL,       -- NULL for mock payments
    razorpay_payment_id VARCHAR(128) DEFAULT NULL,
    razorpay_signature  VARCHAR(256) DEFAULT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX (razorpay_order_id)
);
```

---

## 7. Payment Flow (Dual-Mode: Razorpay Live ↔ Mock QR)

### How Real Money Moves (Production)
1. **User clicks "Buy Now"** → `initiateCheckout()` → `POST /api/payments/create-order`
2. **Backend creates Razorpay Order** → SDK `client.order.create()` → returns `razorpay_order_id`
3. **Frontend launches Razorpay Checkout.js** overlay → auto-detects GPay/PhonePe/Paytm on mobile
4. **User pays with UPI PIN** → 💰 Razorpay holds funds in escrow
5. **Razorpay fires webhook** → `POST /api/webhooks/razorpay` → HMAC-SHA256 verified → MySQL `status = 'paid'`
6. **Settlement:** Razorpay deposits to merchant bank (T+2 days, ~2% fee)

### Fallback (Demo Mode)
If `RAZORPAY_KEY_ID` is empty or starts with `rzp_test_your` → frontend opens the glassmorphism mock QR modal with generated UPI string. No real money moves.

---

## 8. API Endpoints (Full Catalog)

| Method | Endpoint | Auth | Module | Description |
|--------|----------|------|--------|-------------|
| POST | `/auth/register` | No | auth | Create account (bcrypt + JWT) |
| POST | `/auth/login` | No | auth | Login → JWT token |
| GET | `/settings` | JWT | users | Get biometrics + macro targets |
| PUT | `/settings` | JWT | users | Update biometrics → recalculate macros |
| GET | `/api/meals/generate` | JWT | meals | Generate 7-day Edamam meal plan |
| POST | `/api/meals/log` | JWT | meals | Mark meal as eaten → update progress |
| GET | `/api/grocery-list` | JWT | grocery | C-engine sorted grocery list |
| GET | `/api/progress/today` | JWT | progress | Today's consumed vs target macros |
| POST | `/api/progress/water` | JWT | progress | Log water glasses |
| POST | `/api/progress/steps` | JWT | progress | Log step count |
| WS | `/ws/notifications` | JWT | notifications | Real-time push notifications |
| GET | `/api/notifications` | JWT | notifications | Polling fallback for notifications |
| POST | `/api/cart/save` | JWT | cart | Save cart for later (MySQL) |
| GET | `/api/cart` | JWT | cart | Load saved cart |
| POST | `/api/cart/checkout` | JWT | cart | Mock checkout with UPI string |
| POST | `/api/payments/create-order` | JWT | payments | Create Razorpay order |
| POST | `/api/payments/verify` | JWT | payments | Verify payment signature (HMAC) |
| POST | `/api/webhooks/razorpay` | HMAC | payments | Server-to-server webhook |

---

## 9. Environment Variables

```bash
# MySQL Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=supersecret
DB_NAME=smartmeal

# JWT Authentication
JWT_SECRET=change-this-to-a-long-random-secret-key-in-production
JWT_EXPIRY_HOURS=24

# Edamam Recipe API (https://developer.edamam.com/)
EDAMAM_APP_ID=your_edamam_app_id
EDAMAM_APP_KEY=your_edamam_app_key

# Razorpay (https://dashboard.razorpay.com/app/keys)
RAZORPAY_KEY_ID=rzp_test_your_key_id_here
RAZORPAY_KEY_SECRET=your_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# C Engine (optional — auto-detected from backend/c_engine/)
C_ENGINE_PATH=

# CORS
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:5500
```

---

## 10. Quick Start

```bash
# 1. Start MySQL via Docker
docker compose up -d

# 2. Configure environment
cd backend
copy .env.example .env    # Edit with your credentials

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Start the API server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 5. Open the frontend
# Just open index.html in your browser (no build step!)

# 6. Verify: visit http://localhost:8000/docs for Swagger UI
```

---

## 11. Design Language

- **Theme:** Light base + emerald green (#059669) accents + vibrant citrus CTAs
- **Typography:** Inter (Google Fonts) — weights 300–900
- **Layout:** Sidebar nav (dark slate) + bento-box grid dashboard
- **Effects:** Glassmorphism (frosted headers, soft drop shadows), micro-animations
- **Images:** Real Unsplash photography only — no AI illustrations
- **Responsive:** Grid collapses on mobile, sidebar becomes hamburger menu
