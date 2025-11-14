# services/sensor_service.py
from datetime import datetime
import logging
from core import database

logger = logging.getLogger("smart_parking")

async def process_sensor_reading(reading: dict):
    """
    reading: {
      "slot_id": str,
      "lot_id": str,
      "distance": float,
      "timestamp": iso-str or datetime,
      "status": "occupied"|"free"
    }
    Updates parking_lots counts and inserts sensor_data document.
    """
    db = database.db
    if db is None:
        raise RuntimeError("Database not connected")

    lot = await db.parking_lots.find_one({"lot_id": reading["lot_id"]})
    if not lot:
        raise ValueError("Parking lot not found")

    occupied = int(lot.get("occupied_slots", 0))
    reserved = int(lot.get("reserved_slots", 0))
    total = int(lot.get("total_slots", 0))

    status = reading.get("status")
    if status == "occupied" and occupied < max(0, total - reserved):
        occupied += 1
    elif status == "free" and occupied > 0:
        occupied -= 1

    competitive = max(total - reserved - occupied, 0)

    await db.parking_lots.update_one(
        {"lot_id": reading["lot_id"]},
        {"$set": {
            "occupied_slots": occupied,
            "competitive_slots": competitive,
            "updated_at": datetime.utcnow()
        }}
    )

    # Normalize timestamp
    ts = reading.get("timestamp")
    if isinstance(ts, str):
        try:
            ts = datetime.fromisoformat(ts)
        except Exception:
            ts = datetime.utcnow()

    doc = {
        "slot_id": reading["slot_id"],
        "lot_id": reading["lot_id"],
        "distance": float(reading.get("distance", 0)),
        "timestamp": ts,
        "status": status,
    }
    await db.sensor_data.insert_one(doc)
    logger.info(f"✅ Processed sensor reading for {reading['lot_id']}")
    return {"status": "success"}
