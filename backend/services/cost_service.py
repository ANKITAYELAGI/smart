import numpy as np
import requests
from core.config import GOOGLE_MAPS_API_KEY, logger

# ---- Helper functions ----
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
    return float(np.clip(distance / 30 * 60, 10, 20))  # minutes

def calculate_walking_time(lot, destination):
    distance = haversine_distance(lot["lat"], lot["lng"], destination["lat"], destination["lng"])
    return float(min(distance / 5 * 60, 10))

def calculate_expected_waiting_time(utilization):
    base_wait = 3 + utilization * 5
    return float(np.clip(base_wait, 2, 8))

def calculate_parking_cost(request, lot: dict) -> dict:
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
