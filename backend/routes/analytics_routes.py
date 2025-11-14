# backend/routes/analytics_routes.py
from fastapi import APIRouter, HTTPException
from core import database
import logging

logger = logging.getLogger("smart_parking")
router = APIRouter()

@router.get("/analytics", tags=["analytics"])
async def get_system_analytics():
    db = database.db
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    lots_cursor = db.parking_lots.find({})
    analytics = {}
    async for lot in lots_cursor:
        total = lot.get("total_slots", 1)
        utilization = (lot.get("occupied_slots", 0) + lot.get("reserved_slots", 0)) / max(1, total)
        analytics[lot["lot_id"]] = {
            "name": lot.get("name"),
            "utilization": round(utilization, 2),
            "efficiency": round(utilization * lot.get("pa_i", 0.7), 2),
            "pa_i": lot.get("pa_i", 0.7),
            "rs_i": lot.get("rs_i", 0.2),
            "hourly_rate": lot.get("hourly_rate", 40.0)
        }
    return analytics
