import requests
from fastapi import APIRouter
import random
import os

router = APIRouter()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

@router.get("/parking-lots/live")
def get_live_parking(lat: float, lng: float):

    # Call Google Nearby Places API
    url = (
        f"https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        f"?location={lat},{lng}&radius=2000&type=parking&key={GOOGLE_API_KEY}"
    )

    response = requests.get(url).json()
    results = response.get("results", [])

    parking_lots = []

    for r in results:
        lot_id = r["place_id"]

        # Simulated dynamic slot values (like Ola, Uber)
        total_slots = random.randint(40, 200)
        occupied = random.randint(0, total_slots)
        reserved = random.randint(0, total_slots - occupied)
        competitive = total_slots - occupied - reserved

        parking_lots.append({
            "lot_id": lot_id,
            "name": r["name"],
            "location": {
                "lat": r["geometry"]["location"]["lat"],
                "lng": r["geometry"]["location"]["lng"]
            },
            "address": r.get("vicinity", "Unknown"),
            "total_slots": total_slots,
            "occupied_slots": occupied,
            "reserved_slots": reserved,
            "competitive_slots": competitive,
            "live": True
        })

    return {"lots": parking_lots}
