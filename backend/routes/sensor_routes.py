# backend/routes/sensor_routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services import sensor_service
from ws.manager import manager as ws_manager

import json
import logging

logger = logging.getLogger("smart_parking")
router = APIRouter()

class SensorDataModel(BaseModel):
    slot_id: str
    lot_id: str
    distance: float
    timestamp: str
    status: str

@router.post("/sensor-data", tags=["sensor"])
async def receive_sensor_data(data: SensorDataModel):
    try:
        payload = data.dict()
        # process and update DB
        result = await sensor_service.process_sensor_reading(payload)
        # broadcast update to clients
        message = json.dumps({
            "type": "sensor_update",
            "lot_id": payload["lot_id"],
            "occupied_slots": None,  # clients should request fresh lot info, or we can fetch it
            "competitive_slots": None,
            "timestamp": payload["timestamp"]
        })
        try:
            await ws_manager.broadcast(message)
        except Exception as e:
            logger.warning("Websocket broadcast failure: %s", e)
        return {"status": "success", "message": "Sensor data processed"}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.exception("Sensor processing failed")
        raise HTTPException(status_code=500, detail="Sensor processing failed")
