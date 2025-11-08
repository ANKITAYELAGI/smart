from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import json
from datetime import datetime, timedelta
import numpy as np
from sklearn.mixture import GaussianMixture
import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Smart Parking System API",
    description="CRPark-Inspired Smart Parking with Competition-Aware Reservation",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGODB_URL)
db = client.smart_parking

# Security
security = HTTPBearer()

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass

manager = ConnectionManager()

# Pydantic models
class ParkingRequest(BaseModel):
    user_id: str
    current_location: Dict[str, float]  # {lat, lng}
    destination: Dict[str, float]      # {lat, lng}
    arrival_time: Optional[datetime] = None
    duration: int = 60  # minutes

class ParkingSlot(BaseModel):
    slot_id: str
    lot_id: str
    status: str  # "free", "occupied", "reserved"
    sensor_data: Dict[str, Any]
    coordinates: Dict[str, float]

class ParkingLot(BaseModel):
    lot_id: str
    name: str
    location: Dict[str, float]
    total_slots: int
    reserved_slots: int
    competitive_slots: int
    occupied_slots: int
    pa_i: float  # Acceptance probability
    rs_i: float  # Reserved slot ratio
    coordinates: List[Dict[str, float]]

class Reservation(BaseModel):
    reservation_id: str
    user_id: str
    slot_id: str
    lot_id: str
    start_time: datetime
    end_time: datetime
    status: str  # "active", "completed", "cancelled"
    cost: float
    qr_code: str

class SensorData(BaseModel):
    slot_id: str
    lot_id: str
    distance: float
    timestamp: datetime
    status: str

# Global variables for optimization
parking_lots: Dict[str, ParkingLot] = {}
gmm_model: Optional[GaussianMixture] = None
optimization_params: Dict[str, Any] = {}

# Initialize sample parking lots
def initialize_parking_lots():
    global parking_lots
    parking_lots = {
        "lot_001": ParkingLot(
            lot_id="lot_001",
            name="Downtown Plaza",
            location={"lat": 40.7128, "lng": -74.0060},
            total_slots=50,
            reserved_slots=10,
            competitive_slots=35,
            occupied_slots=5,
            pa_i=0.7,
            rs_i=0.2,
            coordinates=[
                {"lat": 40.7128, "lng": -74.0060},
                {"lat": 40.7130, "lng": -74.0058},
                {"lat": 40.7126, "lng": -74.0062},
                {"lat": 40.7124, "lng": -74.0064}
            ]
        ),
        "lot_002": ParkingLot(
            lot_id="lot_002",
            name="Central Station",
            location={"lat": 40.7589, "lng": -73.9851},
            total_slots=80,
            reserved_slots=15,
            competitive_slots=60,
            occupied_slots=5,
            pa_i=0.8,
            rs_i=0.19,
            coordinates=[
                {"lat": 40.7589, "lng": -73.9851},
                {"lat": 40.7591, "lng": -73.9849},
                {"lat": 40.7587, "lng": -73.9853},
                {"lat": 40.7585, "lng": -73.9855}
            ]
        ),
        "lot_003": ParkingLot(
            lot_id="lot_003",
            name="Shopping Mall",
            location={"lat": 40.7505, "lng": -73.9934},
            total_slots=120,
            reserved_slots=25,
            competitive_slots=90,
            occupied_slots=5,
            pa_i=0.6,
            rs_i=0.21,
            coordinates=[
                {"lat": 40.7505, "lng": -73.9934},
                {"lat": 40.7507, "lng": -73.9932},
                {"lat": 40.7503, "lng": -73.9936},
                {"lat": 40.7501, "lng": -73.9938}
            ]
        )
    }

# CRPark Cost Calculation Functions
def calculate_driving_time(current_loc: Dict[str, float], lot_loc: Dict[str, float]) -> float:
    """Calculate driving time based on distance (simplified)"""
    # Haversine distance calculation
    lat1, lng1 = current_loc["lat"], current_loc["lng"]
    lat2, lng2 = lot_loc["lat"], lot_loc["lng"]
    
    R = 6371  # Earth's radius in kilometers
    dlat = np.radians(lat2 - lat1)
    dlng = np.radians(lng2 - lng1)
    a = np.sin(dlat/2)**2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlng/2)**2
    c = 2 * np.arcsin(np.sqrt(a))
    distance = R * c
    
    # Assume average speed of 30 km/h in city
    return distance / 30 * 60  # Convert to minutes

def calculate_walking_time(lot_loc: Dict[str, float], destination: Dict[str, float]) -> float:
    """Calculate walking time from parking lot to destination"""
    lat1, lng1 = lot_loc["lat"], lot_loc["lng"]
    lat2, lng2 = destination["lat"], destination["lng"]
    
    R = 6371
    dlat = np.radians(lat2 - lat1)
    dlng = np.radians(lng2 - lng1)
    a = np.sin(dlat/2)**2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlng/2)**2
    c = 2 * np.arcsin(np.sqrt(a))
    distance = R * c
    
    # Assume walking speed of 5 km/h
    return distance / 5 * 60  # Convert to minutes

def calculate_expected_waiting_time(lot_id: str, current_time: datetime) -> float:
    """Calculate expected waiting time using GMM prediction"""
    if gmm_model is None:
        return np.random.uniform(5, 20)  # Default random waiting time
    
    # Extract time features
    hour = current_time.hour
    day_of_week = current_time.weekday()
    
    # Predict demand probability
    features = np.array([[hour, day_of_week]])
    demand_prob = gmm_model.predict_proba(features)[0]
    
    # Calculate expected waiting time based on demand
    lot = parking_lots[lot_id]
    utilization = (lot.occupied_slots + lot.reserved_slots) / lot.total_slots
    
    # Higher demand = longer waiting time
    base_waiting = 10
    demand_factor = np.sum(demand_prob) * 2
    utilization_factor = utilization * 15
    
    return base_waiting + demand_factor + utilization_factor

def calculate_parking_cost(request: ParkingRequest, lot_id: str) -> Dict[str, float]:
    """Calculate total parking cost for CRPark algorithm"""
    lot = parking_lots[lot_id]
    
    # Calculate individual components
    driving_time = calculate_driving_time(request.current_location, lot.location)
    walking_time = calculate_walking_time(lot.location, request.destination)
    waiting_time = calculate_expected_waiting_time(lot_id, request.arrival_time or datetime.now())
    
    # CRPark cost weights
    alpha, beta, gamma = 1.0, 1.0, 1.5
    
    # Reservation cost (if accepted)
    reservation_cost = alpha * driving_time + beta * walking_time
    
    # Competition cost (if reservation rejected)
    competition_cost = alpha * driving_time + beta * walking_time + gamma * waiting_time
    
    # Weighted cost based on acceptance probability
    pa_i = lot.pa_i
    total_cost = pa_i * reservation_cost + (1 - pa_i) * competition_cost
    
    return {
        "total_cost": total_cost,
        "driving_time": driving_time,
        "walking_time": walking_time,
        "waiting_time": waiting_time,
        "reservation_cost": reservation_cost,
        "competition_cost": competition_cost,
        "success_probability": pa_i
    }

# GMM Demand Prediction Module
def train_gmm_model():
    """Train Gaussian Mixture Model for demand prediction"""
    global gmm_model
    
    # Generate synthetic historical data for training
    np.random.seed(42)
    n_samples = 1000
    
    # Features: hour (0-23), day_of_week (0-6)
    hours = np.random.randint(0, 24, n_samples)
    days = np.random.randint(0, 7, n_samples)
    
    # Create demand patterns (rush hours, weekends)
    demand = np.zeros(n_samples)
    
    # Rush hours (7-9 AM, 5-7 PM)
    rush_mask = ((hours >= 7) & (hours <= 9)) | ((hours >= 17) & (hours <= 19))
    demand[rush_mask] += np.random.normal(0.8, 0.2, np.sum(rush_mask))
    
    # Weekend patterns
    weekend_mask = (days >= 5)
    demand[weekend_mask] += np.random.normal(0.6, 0.3, np.sum(weekend_mask))
    
    # Random base demand
    demand += np.random.normal(0.3, 0.1, n_samples)
    demand = np.clip(demand, 0, 1)
    
    # Train GMM
    features = np.column_stack([hours, days])
    gmm_model = GaussianMixture(n_components=3, random_state=42)
    gmm_model.fit(features)
    
    logger.info("GMM model trained successfully")

# SA-VNS Optimization Module
def simulated_annealing_vns():
    """Simulated Annealing with Variable Neighbourhood Search optimization"""
    global parking_lots
    
    # Initial parameters
    temperature = 100.0
    cooling_rate = 0.95
    min_temperature = 1.0
    
    best_cost = float('inf')
    best_params = {}
    
    for iteration in range(100):
        # Generate new parameters
        new_params = {}
        for lot_id in parking_lots:
            lot = parking_lots[lot_id]
            # Perturb pa_i and rs_i
            new_pa_i = np.clip(lot.pa_i + np.random.normal(0, 0.1), 0.1, 1.0)
            new_rs_i = np.clip(lot.rs_i + np.random.normal(0, 0.05), 0.1, 0.5)
            new_params[lot_id] = {"pa_i": new_pa_i, "rs_i": new_rs_i}
        
        # Calculate cost for new parameters
        total_cost = 0
        for lot_id, params in new_params.items():
            # Simulate cost calculation
            lot = parking_lots[lot_id]
            utilization = (lot.occupied_slots + lot.reserved_slots) / lot.total_slots
            
            # Cost function: minimize average cost while maintaining fairness
            cost = utilization * (1 - params["pa_i"]) * 10 + (1 - utilization) * params["rs_i"] * 5
            total_cost += cost
        
        # Accept or reject based on simulated annealing
        if total_cost < best_cost or np.random.random() < np.exp(-(total_cost - best_cost) / temperature):
            best_cost = total_cost
            best_params = new_params
            
            # Update parking lots
            for lot_id, params in new_params.items():
                parking_lots[lot_id].pa_i = params["pa_i"]
                parking_lots[lot_id].rs_i = params["rs_i"]
        
        # Cool down
        temperature *= cooling_rate
        
        if temperature < min_temperature:
            break
    
    logger.info(f"Optimization completed. Best cost: {best_cost}")
    return best_params

# API Endpoints
@app.on_event("startup")
async def startup_event():
    """Initialize the system on startup"""
    initialize_parking_lots()
    train_gmm_model()
    logger.info("Smart Parking System initialized")

@app.get("/")
async def root():
    return {"message": "Smart Parking System API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}

@app.get("/parking-lots")
async def get_parking_lots():
    """Get all parking lots with current status"""
    return list(parking_lots.values())

@app.get("/parking-lots/{lot_id}")
async def get_parking_lot(lot_id: str):
    """Get specific parking lot details"""
    if lot_id not in parking_lots:
        raise HTTPException(status_code=404, detail="Parking lot not found")
    return parking_lots[lot_id]

@app.post("/predict-cost")
async def predict_parking_cost(request: ParkingRequest):
    """Predict parking cost for all available lots"""
    costs = {}
    
    for lot_id in parking_lots:
        costs[lot_id] = calculate_parking_cost(request, lot_id)
    
    # Find optimal lot
    optimal_lot = min(costs.keys(), key=lambda x: costs[x]["total_cost"])
    
    return {
        "optimal_lot": optimal_lot,
        "costs": costs,
        "recommendation": {
            "lot_id": optimal_lot,
            "lot_name": parking_lots[optimal_lot].name,
            "estimated_cost": costs[optimal_lot]["total_cost"],
            "success_probability": costs[optimal_lot]["success_probability"]
        }
    }

@app.post("/reserve")
async def make_reservation(request: ParkingRequest):
    """Make a parking reservation using CRPark two-chance protocol"""
    # Calculate costs for all lots
    costs = {}
    for lot_id in parking_lots:
        costs[lot_id] = calculate_parking_cost(request, lot_id)
    
    # Find optimal lot
    optimal_lot_id = min(costs.keys(), key=lambda x: costs[x]["total_cost"])
    lot = parking_lots[optimal_lot_id]
    
    # First chance reservation
    first_chance_success = np.random.random() < lot.pa_i
    
    if first_chance_success:
        # Reservation accepted
        reservation_id = f"res_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{request.user_id}"
        
        # Update lot status
        lot.reserved_slots += 1
        lot.competitive_slots -= 1
        
        reservation = Reservation(
            reservation_id=reservation_id,
            user_id=request.user_id,
            slot_id=f"{optimal_lot_id}_slot_{lot.reserved_slots}",
            lot_id=optimal_lot_id,
            start_time=request.arrival_time or datetime.now(),
            end_time=(request.arrival_time or datetime.now()) + timedelta(minutes=request.duration),
            status="active",
            cost=costs[optimal_lot_id]["total_cost"],
            qr_code=f"QR_{reservation_id}"
        )
        
        # Store reservation in database
        await db.reservations.insert_one(reservation.dict())
        
        # Broadcast update to connected clients
        await manager.broadcast(json.dumps({
            "type": "reservation_update",
            "lot_id": optimal_lot_id,
            "reserved_slots": lot.reserved_slots,
            "competitive_slots": lot.competitive_slots
        }))
        
        return {
            "success": True,
            "reservation": reservation,
            "message": "Reservation successful (first chance)"
        }
    
    else:
        # First chance failed, try second chance
        if lot.reserved_slots > 0:
            # Second chance successful
            reservation_id = f"res_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{request.user_id}"
            
            lot.reserved_slots += 1
            lot.competitive_slots -= 1
            
            reservation = Reservation(
                reservation_id=reservation_id,
                user_id=request.user_id,
                slot_id=f"{optimal_lot_id}_slot_{lot.reserved_slots}",
                lot_id=optimal_lot_id,
                start_time=request.arrival_time or datetime.now(),
                end_time=(request.arrival_time or datetime.now()) + timedelta(minutes=request.duration),
                status="active",
                cost=costs[optimal_lot_id]["total_cost"],
                qr_code=f"QR_{reservation_id}"
            )
            
            await db.reservations.insert_one(reservation.dict())
            
            await manager.broadcast(json.dumps({
                "type": "reservation_update",
                "lot_id": optimal_lot_id,
                "reserved_slots": lot.reserved_slots,
                "competitive_slots": lot.competitive_slots
            }))
            
            return {
                "success": True,
                "reservation": reservation,
                "message": "Reservation successful (second chance)"
            }
        else:
            # Both chances failed
            return {
                "success": False,
                "message": "Reservation failed. No available slots.",
                "suggested_action": "Try competitive parking or check other lots"
            }

@app.get("/reservations/{user_id}")
async def get_user_reservations(user_id: str):
    """Get all reservations for a user"""
    reservations = await db.reservations.find({"user_id": user_id}).to_list(1000)
    return reservations

@app.post("/sensor-data")
async def receive_sensor_data(data: SensorData):
    """Receive sensor data from IoT devices"""
    # Update slot status
    slot_id = data.slot_id
    lot_id = data.lot_id
    
    if lot_id in parking_lots:
        lot = parking_lots[lot_id]
        
        # Update slot status based on sensor data
        if data.status == "occupied":
            lot.occupied_slots += 1
            lot.competitive_slots -= 1
        elif data.status == "free":
            lot.occupied_slots -= 1
            lot.competitive_slots += 1
        
        # Store sensor data
        await db.sensor_data.insert_one(data.dict())
        
        # Broadcast update
        await manager.broadcast(json.dumps({
            "type": "sensor_update",
            "lot_id": lot_id,
            "occupied_slots": lot.occupied_slots,
            "competitive_slots": lot.competitive_slots,
            "timestamp": data.timestamp.isoformat()
        }))
        
        return {"status": "success", "message": "Sensor data processed"}
    
    raise HTTPException(status_code=404, detail="Parking lot not found")

@app.post("/optimize")
async def trigger_optimization():
    """Trigger SA-VNS optimization"""
    try:
        best_params = simulated_annealing_vns()
        
        # Store optimization results
        optimization_result = {
            "timestamp": datetime.now(),
            "parameters": best_params,
            "status": "completed"
        }
        
        await db.optimization_logs.insert_one(optimization_result)
        
        return {
            "success": True,
            "message": "Optimization completed",
            "parameters": best_params
        }
    except Exception as e:
        logger.error(f"Optimization failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Optimization failed")

@app.get("/analytics")
async def get_system_analytics():
    """Get system analytics for admin dashboard"""
    analytics = {}
    
    for lot_id, lot in parking_lots.items():
        utilization = (lot.occupied_slots + lot.reserved_slots) / lot.total_slots
        
        analytics[lot_id] = {
            "name": lot.name,
            "utilization": utilization,
            "total_slots": lot.total_slots,
            "occupied_slots": lot.occupied_slots,
            "reserved_slots": lot.reserved_slots,
            "competitive_slots": lot.competitive_slots,
            "pa_i": lot.pa_i,
            "rs_i": lot.rs_i,
            "efficiency": lot.pa_i * utilization
        }
    
    return analytics

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
