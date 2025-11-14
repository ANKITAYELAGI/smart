# backend/crpark_manager.py
import random, time

class CRParkManager:
    def __init__(self):
        # Simulate per-parking-lot management data
        self.lots = {
            1: {"Pa": 0.75, "Rs": 0.6, "Tdl": 300, "available_r": 10, "available_c": 40},
            2: {"Pa": 0.65, "Rs": 0.5, "Tdl": 240, "available_r": 12, "available_c": 35}
        }

    def get_params(self, lot_id):
        return self.lots.get(lot_id, {"Pa": 0.7, "Rs": 0.5, "Tdl": 300})

    def process_reservation(self, lot_id, first_request=True):
        params = self.get_params(lot_id)
        accepted, slot_type = False, "C"

        if first_request:
            if random.random() <= params["Pa"]:
                accepted, slot_type = True, "R"
        else:
            # Second request accepted if R-slot still available
            if params["available_r"] > 0:
                params["available_r"] -= 1
                accepted, slot_type = True, "R"
            else:
                slot_type = "C"

        return {
            "accepted": accepted,
            "slot_type": slot_type,
            "Pa": params["Pa"],
            "Tdl": params["Tdl"],
        }
