# backend/routes/reservation_routes.py

from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from services import crpark_service
from core import database
from ws.manager import manager as ws_manager
from datetime import datetime
import json
import logging
import inspect
import asyncio
from services import cost_service  # used for fallback lot selection

logger = logging.getLogger("smart_parking")
router = APIRouter()

crpark_manager = crpark_service.CRParkManagerSimple()


class ReservationRequest(BaseModel):
    lot_id: str
    first_request: bool = True
    user_id: str | None = None


def _extract_field(data: dict, *variants, default=None):
    if not isinstance(data, dict):
        return default
    for v in variants:
        if v in data:
            return data[v]
    for k, val in data.items():
        for v in variants:
            if k.lower() == v.lower():
                return val
    return default


async def _select_fallback_lot(req_body: dict):
    db = database.db
    if not db:
        return None

    lots_cursor = db.parking_lots.find({})
    lots = []
    async for lot in lots_cursor:
        lot["_id"] = str(lot["_id"])

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

        lot["location"] = {
            "lat": lat if lat is not None else 12.9716,
            "lng": lng if lng is not None else 77.5946
        }
        lot["occupied_slots"] = lot.get("occupied_slots", 1)
        lot["reserved_slots"] = lot.get("reserved_slots", 0)
        lot["total_slots"] = lot.get("total_slots", 10)
        lot["hourly_rate"] = lot.get("hourly_rate", 40.0)
        lot["pa_i"] = lot.get("pa_i", 0.7)

        lots.append(lot)

    costs = {}
    for lot in lots:
        try:
            class _TmpReq:
                def __init__(self, body):
                    self.current_location = (
                        body.get("current_location")
                        or body.get("currentLocation")
                        or {"lat": 12.9716, "lng": 77.5946}
                    )
                    self.destination = (
                        body.get("destination")
                        or body.get("dest")
                        or {"lat": 12.9716, "lng": 77.5946}
                    )

            tmp = _TmpReq(req_body or {})
            costs[lot["lot_id"]] = cost_service.calculate_parking_cost(tmp, lot)

        except Exception as e:
            logger.debug("Fallback cost calc failed for %s: %s", lot.get("lot_id"), e)
            continue

    if not costs:
        return None

    optimal = min(costs.keys(), key=lambda x: costs[x]["total_cost"])
    return optimal


@router.post("/reserve", tags=["reservation"])
@router.post("/api/reserve", tags=["reservation"])
async def reserve_spot(body: dict = Body(...)):
    lot_id = _extract_field(body, "lot_id", "lotId", "lot")
    first_request = _extract_field(body, "first_request", "firstRequest", default=True)
    user_id = _extract_field(body, "user_id", "userId", "user")

    if isinstance(first_request, str):
        fr = first_request.lower()
        first_request = fr in ("true", "1", "yes", "y")

    # If lot_id missing → fallback
    if not lot_id:
        lot_id = await _select_fallback_lot(body)
        if not lot_id:
            raise HTTPException(status_code=400, detail="Missing lot_id and no fallback available")

    # ============================
    # FIXED: CRPark Logic (Correct Position)
    # ============================
    try:
        result = crpark_manager.process_reservation(lot_id, first_request)
    except Exception as e:
        logger.exception(f"CRPark Reservation Logic Failed: {e}")
        raise HTTPException(status_code=500, detail=f"CRPark reservation failure: {e}")

    reservation_id = f"resv-{int(datetime.utcnow().timestamp() * 1000)}"

    payload = {
        "type": "reservation_update",
        "reservation_id": reservation_id,
        "lot_id": lot_id,
        "accepted": result.get("accepted"),
        "Pa": result.get("Pa"),
        "slot_type": result.get("slot_type"),
        "Tdl": result.get("Tdl"),
        "timestamp": datetime.utcnow().isoformat()
    }

    # ============================
    # Safe WebSocket Broadcast
    # ============================
    try:
        await ws_manager.broadcast(json.dumps(payload))
    except Exception as e:
        logger.warning("Websocket broadcast failed: %s", e)

    # ============================
    # Safe DB Write
    # ============================
    try:
        db = database.db
        if db and hasattr(db, "reservations") and hasattr(db.reservations, "insert_one"):
            insert_fn = db.reservations.insert_one

            data_to_insert = {
                "reservation_id": reservation_id,
                "lot_id": lot_id,
                "user_id": user_id,
                "result": result,
                "created_at": datetime.utcnow()
            }

            if inspect.iscoroutinefunction(insert_fn):
                await insert_fn(data_to_insert)
            else:
                insert_fn(data_to_insert)

    except Exception as db_err:
        logger.warning("DB write failed: %s", db_err)

    return {
        "success": True,
        "message": "Reservation processed",
        "status": "accepted" if result.get("accepted") else "pending",
        "slot_type": result.get("slot_type"),
        "success_probability": result.get("Pa"),
        "estimated_waiting_time": 5 if result.get("slot_type") == "C" else 0,
        "second_request_deadline": result.get("Tdl"),
        "reservation_id": reservation_id
    }



@router.get("/api/lots", tags=["reservation"])
async def get_crpark_lots():
    return {"lots": crpark_manager.lots}
