# backend/auth/router.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta

from auth.utils import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_access_token,
)
from core.config import logger

# ------------------------
# SETUP
# ------------------------
router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()
client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client.smart_parking
users_col = db.users

# ------------------------
# SCHEMAS
# ------------------------
class UserIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

# ------------------------
# AUTH HELPERS
# ------------------------
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_access_token(token)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    user = await users_col.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

# ------------------------
# ROUTES
# ------------------------
@router.post("/register", response_model=UserOut)
async def register(user_in: UserIn):
    existing = await users_col.find_one({"email": user_in.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_pw = get_password_hash(user_in.password)
    user_doc = {"email": user_in.email, "hashed_password": hashed_pw, "created_at": datetime.utcnow()}
    res = await users_col.insert_one(user_doc)
    logger.info(f"🧾 New user registered: {user_in.email}")
    return UserOut(id=str(res.inserted_id), email=user_in.email)

@router.post("/login", response_model=Token)
async def login(user_in: UserIn):
    user = await users_col.find_one({"email": user_in.email})
    if not user or not verify_password(user_in.password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    token_data = {"user_id": str(user["_id"]), "email": user["email"]}
    token = create_access_token(token_data)
    logger.info(f"✅ Login successful for {user_in.email}")
    return {"access_token": token, "token_type": "bearer"}

@router.post("/logout")
async def logout():
    """
    Since JWT is stateless, we can't invalidate tokens server-side without a blacklist.
    The frontend should simply delete the token.
    """
    return {"message": "User logged out"}
