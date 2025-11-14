from pydantic import BaseModel
from typing import Dict, Optional
from datetime import datetime

class ParkingRequest(BaseModel):
    user_id: str
    current_location: Dict[str, float]  # {"lat": ..., "lng": ...}
    destination: Dict[str, float]       # {"lat": ..., "lng": ...}
    arrival_time: Optional[datetime] = None
    duration: int = 60

class Reservation(BaseModel):
    reservation_id: str
    user_id: str
    slot_id: str
    lot_id: str
    start_time: datetime
    end_time: datetime
    status: str
    cost: float
    qr_code: str

class SensorData(BaseModel):
    slot_id: str
    lot_id: str
    distance: float
    timestamp: datetime
    status: str
