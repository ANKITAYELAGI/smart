from datetime import datetime
import logging

logger = logging.getLogger("smart_parking")

class CRParkManagerSimple:
    """
    Minimal CRPark manager shim used in your project to simulate
    reservation acceptance logic.
    """
    def __init__(self):
        self.lots = {
            "lot_001": {"Pa": 0.9, "slot_type": "R", "Tdl": 5},
            "lot_002": {"Pa": 0.85, "slot_type": "C", "Tdl": 5},
            "lot_003": {"Pa": 0.95, "slot_type": "R", "Tdl": 5},
        }

    def process_reservation(self, lot_id: str, first_request: bool = True):
        params = self.lots.get(lot_id, {"Pa": 0.8, "slot_type": "R", "Tdl": 5})
        accepted = True if params["Pa"] >= 0.7 else False
        logger.info(f"CRPark processed reservation for {lot_id}: accepted={accepted}")
        return {
            "accepted": accepted,
            "Pa": params["Pa"],
            "slot_type": params["slot_type"],
            "Tdl": params["Tdl"]
        }
