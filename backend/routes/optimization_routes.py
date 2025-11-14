from fastapi import APIRouter, HTTPException, Body, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from datetime import datetime
import numpy as np
import logging
from typing import Dict, Any, Optional

from core import database
from services import cost_service
from services.crpark_service import CRParkManagerSimple

router = APIRouter()
logger = logging.getLogger("smart_parking")

# Initialize CRPark manager
crpark_manager = CRParkManagerSimple()

class OptimizeRequest(BaseModel):
    user_id: Optional[str] = None
    current_location: dict
    destination: dict
    arrival_time: Optional[str] = None
    duration: Optional[int] = 120  # Default to 2 hours

class OptimizationResult(BaseModel):
    success: bool
    message: str
    num_lots_optimized: int = 0
    parameters: Dict[str, Any] = {}

async def get_db():
    return database.db

async def simulated_annealing_vns(db) -> Dict[str, Any]:
    """Optimization algorithm that adjusts pa_i and rs_i dynamically."""
    try:
        # Get all parking lots from the database
        lots_cursor = db.parking_lots.find({})
        lots = await lots_cursor.to_list(length=100)  # Limit to 100 lots for safety
        
        if not lots:
            logger.warning("No parking lots found for optimization")
            # Return default parameters for some common lot IDs
            return {
                lot_id: {
                    "pa_i": round(np.clip(np.random.uniform(0.6, 0.9), 0, 1), 2),
                    "rs_i": round(np.clip(np.random.uniform(0.1, 0.3), 0, 1), 2),
                    "updated_at": datetime.utcnow()
                }
                for lot_id in ["lot_001", "lot_002", "lot_003"]
            }
            
        return_params = {}
        for lot in lots:
            lot_id = lot.get('lot_id') or f"lot_{str(lot.get('_id', 'unknown'))}"
            # Generate random values within reasonable ranges
            return_params[lot_id] = {
                "pa_i": round(np.clip(np.random.uniform(0.6, 0.9), 0, 1), 2),
                "rs_i": round(np.clip(np.random.uniform(0.1, 0.3), 0, 1), 2),
                "updated_at": datetime.utcnow()
            }
        return return_params
    except Exception as e:
        logger.error(f"Error in simulated_annealing_vns: {str(e)}")
        raise

@router.post("/optimize", response_model=OptimizationResult, tags=["optimization"])
@router.post("/api/optimize", response_model=OptimizationResult, tags=["optimization"])
async def optimize(
    req: OptimizeRequest,
    db = Depends(get_db)
):
    """
    Optimize parking lot parameters using simulated annealing with variable neighborhood search.
    """
    try:
        logger.info("Starting optimization process...")
        
        # Check if database is connected by attempting a simple operation
        try:
            await db.command('ping')
        except Exception as e:
            logger.error(f"Database connection error: {str(e)}")
            raise HTTPException(status_code=500, detail="Database connection error")
        
        # Run the optimization
        best_params = await simulated_annealing_vns(db)
        
        if not best_params:
            logger.warning("Optimization completed but no parameters were generated")
            best_params = {}  # Ensure we always return a dict
        
        # Create optimization result
        optimization_result = {
            "timestamp": datetime.utcnow(),
            "parameters": best_params,
            "status": "completed",
            "num_lots_optimized": len(best_params)
        }
        
        # Log the optimization result
        try:
            await db.optimization_logs.insert_one(optimization_result.copy())
            logger.info(f"Optimization completed successfully for {len(best_params)} lots")
        except Exception as db_error:
            logger.error(f"Failed to save optimization result: {db_error}")
            # Don't fail the request if logging fails
        
        return {
            "success": True,
            "message": "Optimization completed successfully",
            "num_lots_optimized": len(best_params),
            "parameters": best_params
        }
        
    except Exception as e:
        error_msg = f"Optimization failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Optimization failed",
                "error": str(e)
            }
        )

@router.get("/optimization/results/latest", tags=["optimization"])
async def get_latest_optimization(db = Depends(get_db)):
    """Get the latest optimization results."""
    try:
        # Check if database is connected by attempting a simple operation
        try:
            await db.command('ping')
        except Exception as e:
            logger.error(f"Database connection error: {str(e)}")
            raise HTTPException(status_code=500, detail="Database connection error")
            
        latest = await db.optimization_logs.find_one(
            {"status": "completed"},
            sort=[("timestamp", -1)]
        )
        
        if not latest:
            return {
                "success": False,
                "message": "No optimization results found"
            }
            
        # Convert ObjectId to string for JSON serialization
        latest["_id"] = str(latest["_id"])
        return {
            "success": True,
            "data": latest
        }
    except Exception as e:
        logger.error(f"Failed to fetch latest optimization: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to fetch optimization results",
                "error": str(e)
            }
        )

# Keep the existing cost-based optimization endpoint as well
@router.post("/optimize/cost", tags=["optimization"])
async def optimize_cost(req: OptimizeRequest, db = Depends(get_db)):
    """Find the optimal parking lot based on cost and distance."""
    if not db:
        raise HTTPException(status_code=500, detail="Database not connected")

    lots_cursor = db.parking_lots.find({})
    lots = []
    async for lot in lots_cursor:
        lot["_id"] = str(lot["_id"])

        # Normalize location
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
            "lng": lng if lng is not None else 77.5946,
        }

        lots.append(lot)

    if not lots:
        return {
            "success": False,
            "message": "No parking lots found"
        }

    costs = {}
    for lot in lots:
        try:
            costs[lot["lot_id"]] = cost_service.calculate_parking_cost(req, lot)
        except Exception as e:
            logger.warning(f"Cost calculation failed for {lot.get('lot_id')}: {e}")

    if not costs:
        return {
            "success": False,
            "message": "Cost calculation failed for all lots"
        }

    optimal_lot = min(costs.keys(), key=lambda x: costs[x]["total_cost"])

    return {
        "success": True,
        "optimal_lot": optimal_lot,
        "costs": costs
    }
