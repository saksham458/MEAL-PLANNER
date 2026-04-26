"""
Smart Meal Planner — Auth Pydantic Models
Request and response schemas for authentication endpoints.
"""

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """POST /auth/register request body."""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128, description="Minimum 8 characters")
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field("", max_length=100)


class LoginRequest(BaseModel):
    """POST /auth/login request body."""
    email: EmailStr
    password: str = Field(..., min_length=1)


class AuthResponse(BaseModel):
    """Response returned after successful login or registration."""
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    first_name: str


class MessageResponse(BaseModel):
    """Generic message response."""
    message: str
    success: bool = True

class PhoneRequest(BaseModel):
    """POST /auth/send-otp request body."""
    phone_number: str

class VerifyOTPRequest(BaseModel):
    """POST /auth/verify-otp request body."""
    phone_number: str
    otp: str
