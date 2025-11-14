# backend/routes/parking_routes.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict
from core import database
from services import cost_service
import logging

logger = logging.getLogger("smart_parking")

router = APIRouter()


class ParkingRequest(BaseModel):
    user_id: str
    current_location: Dict[str, float]
    destination: Dict[str, float]
    arrival_time: str = None
    duration: int = 60


# ============================================================
# GET PARKING LOTS
# ============================================================
@router.get("/parking-lots", tags=["parking"])
async def get_parking_lots():
    db = database.db
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    lots_cursor = db.parking_lots.find({})
    lots = []

    async for lot in lots_cursor:
        lot["_id"] = str(lot["_id"])

        # Normalize location
        loc = lot.get("location", {})
        if isinstance(loc, dict):
            if "coordinates" in loc and isinstance(loc["coordinates"], list):
                lng, lat = loc["coordinates"][0], loc["coordinates"][1]
            else:
                lat = loc.get("lat")
                lng = loc.get("lng")
        else:
            lat = lng = None

        # Safe defaults
        lot["location"] = {
            "lat": lat if lat is not None else 12.9716,
            "lng": lng if lng is not None else 77.5946,
        }

        lots.append(lot)

    return {"count": len(lots), "currency": "INR", "lots": lots}


# ============================================================
# COST PREDICTION (FULLY UPDATED)
# ============================================================
@router.post("/predict-cost", tags=["parking"])
async def predict_parking_cost(req: ParkingRequest):
    db = database.db
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    lots_cursor = db.parking_lots.find({})
    lots_data = []

    async for lot in lots_cursor:
        lot["_id"] = str(lot["_id"])

        # Normalize location
        loc = lot.get("location", {})
        if isinstance(loc, dict):
            if "coordinates" in loc and isinstance(loc["coordinates"], list):
                lat = loc["coordinates"][1]
                lng = loc["coordinates"][0]
            else:
                lat = loc.get("lat")
                lng = loc.get("lng")
        else:
            lat = lng = None

        # Safe defaults for cost calc
        lot["location"] = {
            "lat": lat if lat is not None else 12.9716,
            "lng": lng if lng is not None else 77.5946,
        }

        lot["occupied_slots"] = lot.get("occupied_slots", 1)
        lot["reserved_slots"] = lot.get("reserved_slots", 0)
        lot["total_slots"] = lot.get("total_slots", 10)
        lot["hourly_rate"] = lot.get("hourly_rate", 40.0)
        lot["pa_i"] = lot.get("pa_i", 0.7)

        lots_data.append(lot)

    if not lots_data:
        raise HTTPException(status_code=400, detail="No parking lots available")

    costs = {}
    for lot in lots_data:
        try:
            # KEY FIX: pass req (model), not req.dict()
            costs[lot["lot_id"]] = cost_service.calculate_parking_cost(req, lot)
        except Exception as e:
            logger.exception("Cost calc failed for lot %s: %s", lot.get("lot_id"), e)

    if not costs:
        raise HTTPException(status_code=400, detail="No valid parking lots found")

    optimal_lot = min(costs.keys(), key=lambda x: costs[x]["total_cost"])
    lot_name = next(
        (l["name"] for l in lots_data if l["lot_id"] == optimal_lot), "Unknown"
    )

    return {
        "optimal_lot": optimal_lot,
        "currency": "INR",
        "costs": costs,
        "recommendation": {
            "lot_id": optimal_lot,
            "lot_name": lot_name,
            "estimated_cost": costs[optimal_lot]["total_cost"]
        }
    }
