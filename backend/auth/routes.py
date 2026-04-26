"""
Smart Meal Planner — Authentication Routes
POST /auth/register  — Create a new user account
POST /auth/login     — Authenticate and receive a JWT token
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status

from database import get_db
import random
import json
from auth.jwt_handler import hash_password, verify_password, create_access_token
from auth.models import RegisterRequest, LoginRequest, AuthResponse, PhoneRequest, VerifyOTPRequest

# In-memory OTP storage (linked to phone number)
otp_storage = {}

logger = logging.getLogger("smartmeal.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db=Depends(get_db)):
    """
    Register a new user account.
    - Validates email uniqueness
    - Hashes the password with bcrypt
    - Creates default biometric profile
    - Returns JWT access token
    """
    async with db.cursor() as cur:
        # Check if email already exists
        await cur.execute("SELECT id FROM users WHERE email = %s", (body.email,))
        existing = await cur.fetchone()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            )

        # Hash password and insert user
        hashed = hash_password(body.password)
        await cur.execute(
            """
            INSERT INTO users (email, password_hash, first_name, last_name)
            VALUES (%s, %s, %s, %s)
            """,
            (body.email, hashed, body.first_name, body.last_name),
        )
        await db.commit()
        user_id = cur.lastrowid

        # Create default biometric profile for the new user
        await cur.execute(
            """
            INSERT INTO user_biometrics (user_id, gender, age, height_cm, weight_kg, activity_level,
                                         daily_calories, daily_protein_g, daily_carbs_g, daily_fat_g)
            VALUES (%s, 'male', 25, 170, 70.0, 'moderate', 2200, 165, 220, 73)
            """,
            (user_id,),
        )
        await db.commit()

        logger.info(f"New user registered: {body.email} (ID: {user_id})")

    # Generate JWT token
    token = create_access_token(user_id, body.email)

    return AuthResponse(
        access_token=token,
        user_id=user_id,
        email=body.email,
        first_name=body.first_name,
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db=Depends(get_db)):
    """
    Authenticate a user with email and password.
    Returns a JWT access token on success.
    """
    async with db.cursor() as cur:
        await cur.execute(
            "SELECT id, email, password_hash, first_name FROM users WHERE email = %s AND is_active = TRUE",
            (body.email,),
        )
        user = await cur.fetchone()

    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(user["id"], user["email"])
    logger.info(f"User logged in: {user['email']}")

    return AuthResponse(
        access_token=token,
        user_id=user["id"],
        email=user["email"],
        first_name=user["first_name"],
    )


@router.post("/send-otp")
async def send_otp(body: PhoneRequest, db=Depends(get_db)):
    """
    Generate a 6-digit OTP and 'send' it (console mock).
    Also runs an auto-migration to ensure phone_number column exists.
    """
    # 1. Auto-migration (safe check)
    async with db.cursor() as cur:
        try:
            await cur.execute("SHOW COLUMNS FROM users LIKE 'phone_number'")
            if not await cur.fetchone():
                logger.info("Auto-migrating: Adding phone_number column to users table")
                await cur.execute("ALTER TABLE users ADD COLUMN phone_number VARCHAR(20) UNIQUE DEFAULT NULL AFTER email")
                await db.commit()
        except Exception as e:
            logger.error(f"Migration check failed: {e}")

    # 2. Generate OTP
    otp = str(random.randint(100000, 999999))
    otp_storage[body.phone_number] = otp

    # 3. Handle 'sending' (Console Mock)
    logger_msg = f"\n[SMS MOCK] To: {body.phone_number}\n[SMS MOCK] Body: Your SmartMeal verification code is: {otp}\n"
    print(logger_msg)
    logger.info(f"OTP sent to {body.phone_number}: {otp}")
    
    return {"message": "OTP sent successfully", "phone": body.phone_number}


@router.post("/verify-otp", response_model=AuthResponse)
async def verify_otp(body: VerifyOTPRequest, db=Depends(get_db)):
    """
    Verify the 6-digit OTP and log the user in.
    If the user doesn't exist by phone, it creates a skeleton account.
    """
    # 1. Check OTP storage
    saved_otp = otp_storage.get(body.phone_number)
    if not saved_otp or saved_otp != body.otp:
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")
    
    # Clear OTP
    del otp_storage[body.phone_number]

    # 2. Check user by phone
    async with db.cursor() as cur:
        await cur.execute("SELECT id, email, first_name FROM users WHERE phone_number = %s", (body.phone_number,))
        user = await cur.fetchone()

        if not user:
            # Create a skeleton account for the new phone user
            temp_email = f"user_{body.phone_number.replace('+', '')}@smartmeal.local"
            # Check if this email exists (collision safety)
            await cur.execute("SELECT id FROM users WHERE email = %s", (temp_email,))
            if await cur.fetchone():
                temp_email = f"user_{random.randint(1000, 9999)}_{body.phone_number.replace('+', '')}@smartmeal.local"

            await cur.execute(
                "INSERT INTO users (email, password_hash, first_name, phone_number) VALUES (%s, %s, %s, %s)",
                (temp_email, "PHONE_TOKEN_AUTH", "New", body.phone_number)
            )
            await db.commit()
            user_id = cur.lastrowid
            
            # Create default biometrics
            await cur.execute(
                "INSERT INTO user_biometrics (user_id) VALUES (%s)",
                (user_id,)
            )
            await db.commit()
            
            user = {
                "id": user_id,
                "email": temp_email,
                "first_name": "New"
            }
            logger.info(f"New phone user registered: {body.phone_number}")

    token = create_access_token(user["id"], user["email"])
    
    return AuthResponse(
        access_token=token,
        user_id=user["id"],
        email=user["email"],
        first_name=user["first_name"],
    )
