# backend/routes/base_routes.py
from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

@router.get("/", tags=["base"])
async def root():
    return {"message": "Smart Parking System API (Bengaluru)", "version": "2.0.0"}

@router.get("/health", tags=["base"])
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}
