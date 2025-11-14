from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import json
from datetime import datetime, timedelta
import numpy as np
from sklearn.mixture import GaussianMixture
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import logging
import requests
from crpark_manager import CRParkManager
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from auth import router as auth_router


# -----------------------------
# 🧠 CONFIGURATION
# -----------------------------
load_dotenv()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# -----------------------------
# 🚀 FASTAPI SETUP
# -----------------------------
app = FastAPI(
    title="Smart Parking System API",
    description="CRPark-Inspired Smart Parking with Bengaluru Locations (MongoDB + INR)",
    version="2.0.0"
)
app.include_router(auth_router)
crpark = CRParkManager()


# Allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB
client = AsyncIOMotorClient(MONGODB_URL)
db = client.smart_parking


# -----------------------------
# 🧩 MODELS
# -----------------------------
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


# -----------------------------
# 🔌 WEBSOCKET MANAGER
# -----------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass


manager = ConnectionManager()


# -----------------------------
# 🧮 COST CALCULATION LOGIC
# -----------------------------
def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = np.radians(lat2 - lat1)
    dlng = np.radians(lon2 - lon1)
    a = np.sin(dlat/2)**2 + np.cos(np.radians(lat1))*np.cos(np.radians(lat2))*np.sin(dlng/2)**2
    c = 2*np.arcsin(np.sqrt(a))
    return R * c


def calculate_driving_time(current, lot):
    try:
        if GOOGLE_MAPS_API_KEY:
            url = "https://maps.googleapis.com/maps/api/distancematrix/json"
            params = {
                "origins": f"{current['lat']},{current['lng']}",
                "destinations": f"{lot['lat']},{lot['lng']}",
                "mode": "driving",
                "key": GOOGLE_MAPS_API_KEY
            }
            resp = requests.get(url, params=params)
            data = resp.json()
            if data.get("status") == "OK":
                element = data["rows"][0]["elements"][0]
                if element.get("status") == "OK":
                    return element["duration"]["value"] / 60
    except Exception as e:
        logger.warning(f"Google Maps API failed: {e}")

    distance = haversine_distance(current["lat"], current["lng"], lot["lat"], lot["lng"])
    return float(np.clip(distance / 30 * 60, 10, 20))  # in minutes


def calculate_walking_time(lot, destination):
    distance = haversine_distance(lot["lat"], lot["lng"], destination["lat"], destination["lng"])
    return float(min(distance / 5 * 60, 10))  # minutes


def calculate_expected_waiting_time(utilization):
    base_wait = 3 + utilization * 5
    return float(np.clip(base_wait, 2, 8))


def calculate_parking_cost(request: ParkingRequest, lot: dict) -> Dict[str, float]:
    """Returns detailed cost breakdown (INR)"""
    driving_time = calculate_driving_time(request.current_location, lot["location"])
    walking_time = calculate_walking_time(lot["location"], request.destination)
    utilization = (lot["occupied_slots"] + lot["reserved_slots"]) / lot["total_slots"]
    waiting_time = calculate_expected_waiting_time(utilization)

    base_parking = lot.get("hourly_rate", 40.0)
    driving_cost = driving_time * 2.0
    walking_cost = walking_time * 0.5
    waiting_cost = waiting_time * 3.0
    reservation_cost = base_parking + driving_cost + walking_cost
    competition_cost = reservation_cost + waiting_cost
    pa_i = lot.get("pa_i", 0.7)
    total_cost = pa_i * reservation_cost + (1 - pa_i) * competition_cost
    total_cost = min(total_cost, 200.0)

    return {
        "total_cost": round(total_cost, 2),
        "driving_time": round(driving_time, 2),
        "walking_time": round(walking_time, 2),
        "waiting_time": round(waiting_time, 2),
        "reservation_cost": round(reservation_cost, 2),
        "competition_cost": round(competition_cost, 2),
        "success_probability": pa_i
    }


# -----------------------------
# 🧠 GMM MODEL
# -----------------------------
gmm_model: Optional[GaussianMixture] = None


def train_gmm_model():
    global gmm_model
    np.random.seed(42)
    hours = np.random.randint(0, 24, 1000)
    days = np.random.randint(0, 7, 1000)
    features = np.column_stack([hours, days])
    gmm_model = GaussianMixture(n_components=3, random_state=42)
    gmm_model.fit(features)
    logger.info("✅ GMM model trained successfully")


# -----------------------------
# 🌐 API ROUTES
# -----------------------------
@app.on_event("startup")
async def startup_event():
    train_gmm_model()
    logger.info("🚀 Smart Parking API Initialized (Bengaluru Version)")


@app.get("/")
async def root():
    return {"message": "Smart Parking System API (Bengaluru)", "version": "2.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}


@app.get("/parking-lots")
async def get_parking_lots():
    lots_cursor = db.parking_lots.find({})
    lots = []
    async for lot in lots_cursor:
        lot["_id"] = str(lot["_id"])
        lot["location"] = {
            "lat": lot["location"]["coordinates"][1],
            "lng": lot["location"]["coordinates"][0]
        }
        lots.append(lot)
    return {"count": len(lots), "currency": "INR", "lots": lots}



@app.post("/predict-cost")
async def predict_parking_cost(request: ParkingRequest):
    lots_cursor = db.parking_lots.find({})
    costs = {}
    lots_data = []
    async for lot in lots_cursor:
        lot["_id"] = str(lot["_id"])
        lot["location"] = {
            "lat": lot["location"]["coordinates"][1],
            "lng": lot["location"]["coordinates"][0]
        }
        lots_data.append(lot)

    for lot in lots_data:
        costs[lot["lot_id"]] = calculate_parking_cost(request, lot)

    optimal_lot = min(costs.keys(), key=lambda x: costs[x]["total_cost"])
    return {
        "optimal_lot": optimal_lot,
        "currency": "INR",
        "costs": costs,
        "recommendation": {
            "lot_id": optimal_lot,
            "lot_name": next(l["name"] for l in lots_data if l["lot_id"] == optimal_lot),
            "estimated_cost": costs[optimal_lot]["total_cost"]
        }
    }

@app.post("/sensor-data")
async def receive_sensor_data(data: SensorData):
    """Process IoT sensor data and update the MongoDB lot status"""
    lot = await db.parking_lots.find_one({"lot_id": data.lot_id})
    if not lot:
        raise HTTPException(status_code=404, detail="Parking lot not found")

    # Update slot counts
    occupied = lot.get("occupied_slots", 0)
    reserved = lot.get("reserved_slots", 0)
    total = lot.get("total_slots", 0)

    if data.status == "occupied" and occupied < total - reserved:
        occupied += 1
    elif data.status == "free" and occupied > 0:
        occupied -= 1

    competitive = max(total - reserved - occupied, 0)

    # Update MongoDB document
    await db.parking_lots.update_one(
        {"lot_id": data.lot_id},
        {"$set": {
            "occupied_slots": occupied,
            "competitive_slots": competitive,
            "updated_at": datetime.now()
        }}
    )

    # Save sensor reading
    await db.sensor_data.insert_one(data.dict())

    # Broadcast real-time update
    await manager.broadcast(json.dumps({
        "type": "sensor_update",
        "lot_id": data.lot_id,
        "occupied_slots": occupied,
        "competitive_slots": competitive,
        "timestamp": data.timestamp.isoformat()
    }))

    return {"status": "success", "message": "Sensor data processed"}

def simulated_annealing_vns():
    """Mock optimization algorithm that adjusts pa_i and rs_i dynamically."""
    results = {}
    lots = db.parking_lots.find({})
    return_params = {}
    # NOTE: Motor async cursor requires async loop; here we just simulate.
    # For simplicity, return random updates for now.
    for lot_id in ["lot_001", "lot_002", "lot_003", "lot_004", "lot_005", "lot_006", "lot_007", "lot_008"]:
        return_params[lot_id] = {
            "pa_i": round(np.clip(np.random.uniform(0.6, 0.9), 0, 1), 2),
            "rs_i": round(np.clip(np.random.uniform(0.1, 0.3), 0, 1), 2)
        }
    return return_params

@app.post("/optimize")
async def trigger_optimization():
    try:
        best_params = simulated_annealing_vns()
        optimization_result = {
            "timestamp": datetime.now(),
            "parameters": best_params,
            "status": "completed"
        }
        await db.optimization_logs.insert_one(optimization_result)
        return {"success": True, "message": "Optimization completed", "parameters": best_params}
    except Exception as e:
        logger.error(f"Optimization failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Optimization failed")



# -----------------------------
# 🧠 CRPark Reservation API
# -----------------------------
# replace the existing /api/reserve function with this block
@app.post("/api/reserve")
@app.post("/reserve")   # alias for integration tests / older clients
async def reserve_with_crpark(request: Request):
    """
    CRPark-based probabilistic reservation (two-stage request model).
    This endpoint returns whether reservation is accepted (first or second attempt)
    and broadcasts a reservation_update message over websocket so frontends can sync.
    """
    body = await request.json()
    lot_id = body.get("parking_lot_id")
    first_request = body.get("first_request", True)

    # process using your CRPark manager (synchronous in your code)
    result = crpark.process_reservation(lot_id, first_request)

    # build a consistent reservation_id and payload
    reservation_id = f"resv-{int(datetime.utcnow().timestamp() * 1000)}"
    payload = {
        "type": "reservation_update",
        "reservation_id": reservation_id,
        "lot_id": lot_id,
        "accepted": bool(result.get("accepted", False)),
        "Pa": result.get("Pa"),
        "slot_type": result.get("slot_type"),
        "Tdl": result.get("Tdl"),
        "timestamp": datetime.utcnow().isoformat()
    }

    # broadcast to connected websocket clients (safe attempt)
    try:
        await manager.broadcast(json.dumps(payload))
    except Exception as e:
        logger.warning(f"Broadcast failed: {e}")

    # return structured response
    return {
        "status": "accepted" if result.get("accepted") else "pending",
        "slot_type": result.get("slot_type"),
        "success_probability": result.get("Pa"),
        "estimated_waiting_time": 5 if result.get("slot_type") == "C" else 0,
        "second_request_deadline": result.get("Tdl"),
        "reservation_id": reservation_id
    }



@app.get("/api/lots")
async def get_lot_status():
    """
    Return current CRPark lot parameters (Pa, Rs, available slots).
    """
    return {"lots": crpark.lots}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("WebSocket client disconnected")


# -----------------------------
# 🧠 ANALYTICS ENDPOINT
# -----------------------------
@app.get("/analytics")
async def get_system_analytics():
    lots_cursor = db.parking_lots.find({})
    analytics = {}
    async for lot in lots_cursor:
        utilization = (lot["occupied_slots"] + lot["reserved_slots"]) / lot["total_slots"]
        analytics[lot["lot_id"]] = {
            "name": lot["name"],
            "utilization": round(utilization, 2),
            "efficiency": round(utilization * lot.get("pa_i", 0.7), 2),
            "pa_i": lot.get("pa_i", 0.7),
            "rs_i": lot.get("rs_i", 0.2),
            "hourly_rate": lot.get("hourly_rate", 40.0)
        }
    return analytics


# -----------------------------
# ▶️ RUN LOCALLY
# -----------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
