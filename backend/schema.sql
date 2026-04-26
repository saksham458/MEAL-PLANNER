-- ============================================================
-- SMART MEAL PLANNER — Complete MySQL Database Schema
-- ACID-Compliant | Fully Relational | Production-Ready
-- ============================================================

-- Create the database
CREATE DATABASE IF NOT EXISTS smartmeal
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE smartmeal;

-- ════════════════════════════════════════════════════════════
-- TABLE 1: users
-- Core authentication & profile data
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,
    first_name      VARCHAR(100)    NOT NULL,
    last_name       VARCHAR(100)    NOT NULL DEFAULT '',
    avatar_url      VARCHAR(512)    DEFAULT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    is_verified     BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_users_email (email),
    INDEX idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ════════════════════════════════════════════════════════════
-- TABLE 2: user_biometrics
-- Stores physical metrics + calculated macro goals
-- One-to-one relationship with users
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_biometrics (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED    NOT NULL UNIQUE,
    gender          ENUM('male', 'female', 'other') NOT NULL DEFAULT 'male',
    age             TINYINT UNSIGNED  NOT NULL DEFAULT 25,
    height_cm       SMALLINT UNSIGNED NOT NULL DEFAULT 170 COMMENT 'Height in centimeters',
    weight_kg       DECIMAL(5,1)    NOT NULL DEFAULT 70.0 COMMENT 'Weight in kilograms',
    activity_level  ENUM('sedentary', 'moderate', 'active', 'athlete') NOT NULL DEFAULT 'moderate',

    -- Calculated daily goals (auto-recalculated on biometric update)
    daily_calories  SMALLINT UNSIGNED NOT NULL DEFAULT 2000,
    daily_protein_g SMALLINT UNSIGNED NOT NULL DEFAULT 150 COMMENT 'Grams of protein per day',
    daily_carbs_g   SMALLINT UNSIGNED NOT NULL DEFAULT 250 COMMENT 'Grams of carbs per day',
    daily_fat_g     SMALLINT UNSIGNED NOT NULL DEFAULT 67  COMMENT 'Grams of fat per day',

    dietary_goal    ENUM('lose_weight', 'maintain', 'build_muscle', 'high_protein') NOT NULL DEFAULT 'maintain',

    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_biometrics_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ════════════════════════════════════════════════════════════
-- TABLE 3: weekly_plans
-- Each row = one 7-day meal plan generated for a user
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS weekly_plans (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED    NOT NULL,
    week_start      DATE            NOT NULL COMMENT 'Monday of the plan week',
    week_end        DATE            NOT NULL COMMENT 'Sunday of the plan week',
    status          ENUM('active', 'archived', 'draft') NOT NULL DEFAULT 'active',
    total_calories  INT UNSIGNED    DEFAULT 0,
    total_protein_g INT UNSIGNED    DEFAULT 0,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_plans_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    INDEX idx_plans_user_week (user_id, week_start),
    INDEX idx_plans_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ════════════════════════════════════════════════════════════
-- TABLE 4: plan_meals
-- Individual meals within a weekly plan (linked to Edamam)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS plan_meals (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plan_id         INT UNSIGNED    NOT NULL,
    user_id         INT UNSIGNED    NOT NULL,

    -- Scheduling
    day_of_week     TINYINT UNSIGNED NOT NULL COMMENT '0=Monday, 6=Sunday',
    meal_type       ENUM('breakfast', 'lunch', 'dinner', 'snack') NOT NULL,

    -- Edamam recipe data (cached locally)
    edamam_uri      VARCHAR(512)    NOT NULL COMMENT 'Edamam recipe unique URI',
    recipe_label    VARCHAR(255)    NOT NULL,
    recipe_image    VARCHAR(512)    DEFAULT NULL COMMENT 'Edamam image URL',
    recipe_url      VARCHAR(512)    DEFAULT NULL COMMENT 'Original recipe source URL',
    recipe_yield    TINYINT UNSIGNED DEFAULT 4 COMMENT 'Number of servings',

    -- Macronutrients per serving
    calories        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    protein_g       DECIMAL(5,1)    NOT NULL DEFAULT 0.0,
    carbs_g         DECIMAL(5,1)    NOT NULL DEFAULT 0.0,
    fat_g           DECIMAL(5,1)    NOT NULL DEFAULT 0.0,
    fiber_g         DECIMAL(5,1)    DEFAULT 0.0,

    -- Ingredients (stored as JSON for grocery extraction)
    ingredients_json JSON           NOT NULL COMMENT 'Array of ingredient lines from Edamam',

    is_logged       BOOLEAN         NOT NULL DEFAULT FALSE COMMENT 'User marked this meal as eaten',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_meals_plan
        FOREIGN KEY (plan_id) REFERENCES weekly_plans(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT fk_meals_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    INDEX idx_meals_plan_day (plan_id, day_of_week),
    INDEX idx_meals_user (user_id),
    INDEX idx_meals_logged (is_logged)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ════════════════════════════════════════════════════════════
-- TABLE 5: daily_progress
-- Tracks daily macro consumption vs goals
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS daily_progress (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED    NOT NULL,
    log_date        DATE            NOT NULL,

    -- Consumed totals (updated as meals are logged)
    consumed_calories   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    consumed_protein_g  DECIMAL(5,1)  NOT NULL DEFAULT 0.0,
    consumed_carbs_g    DECIMAL(5,1)  NOT NULL DEFAULT 0.0,
    consumed_fat_g      DECIMAL(5,1)  NOT NULL DEFAULT 0.0,

    -- Snapshot of user's goals for this day (in case they change later)
    target_calories     SMALLINT UNSIGNED NOT NULL DEFAULT 2000,
    target_protein_g    SMALLINT UNSIGNED NOT NULL DEFAULT 150,
    target_carbs_g      SMALLINT UNSIGNED NOT NULL DEFAULT 250,
    target_fat_g        SMALLINT UNSIGNED NOT NULL DEFAULT 67,

    water_glasses       TINYINT UNSIGNED DEFAULT 0,
    steps               INT UNSIGNED DEFAULT 0,
    notes               TEXT DEFAULT NULL,

    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_progress_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    UNIQUE INDEX idx_progress_user_date (user_id, log_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ════════════════════════════════════════════════════════════
-- TABLE 6: notifications
-- In-app notification storage with read tracking
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED    NOT NULL,
    type            ENUM('meal_reminder', 'goal_achieved', 'grocery_ready',
                         'plan_generated', 'weekly_summary', 'system')
                    NOT NULL DEFAULT 'system',
    title           VARCHAR(255)    NOT NULL,
    message         TEXT            NOT NULL,
    icon            VARCHAR(10)     DEFAULT '🔔',
    is_read         BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notif_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    INDEX idx_notif_user_unread (user_id, is_read),
    INDEX idx_notif_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ════════════════════════════════════════════════════════════
-- TABLE 7: saved_carts
-- Stores "Buy Later" cart state for users
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS saved_carts (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED    NOT NULL,
    cart_data       JSON            NOT NULL COMMENT 'Serialized cart items array',
    item_count      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_cart_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    INDEX idx_cart_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ════════════════════════════════════════════════════════════
-- TABLE 8: transactions
-- Payment transaction records (supports mock + Razorpay)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS transactions (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             INT UNSIGNED    NOT NULL,
    transaction_id      VARCHAR(64)     NOT NULL UNIQUE,
    order_id            VARCHAR(64)     NOT NULL UNIQUE,
    payment_method      VARCHAR(20)     NOT NULL DEFAULT 'qr',    -- qr | phonepe | wallet | card | razorpay
    amount              DECIMAL(10,2)   NOT NULL,
    status              VARCHAR(20)     NOT NULL DEFAULT 'pending',-- created | pending | paid | success | failed | refunded
    upi_string          TEXT            DEFAULT NULL,
    items_json          JSON            NOT NULL,

    -- Razorpay-specific fields (NULL for mock payments)
    razorpay_order_id   VARCHAR(128)    DEFAULT NULL,
    razorpay_payment_id VARCHAR(128)    DEFAULT NULL,
    razorpay_signature  VARCHAR(256)    DEFAULT NULL,

    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_txn_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    INDEX idx_txn_user (user_id),
    INDEX idx_txn_status (status),
    INDEX idx_txn_rzp_order (razorpay_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

