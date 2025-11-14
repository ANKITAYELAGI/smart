# backend/main.py

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import logging
import asyncio

# Project imports
from core.database import connect_to_mongo, close_mongo
from routes.base_routes import router as base_router
from routes.parking_routes import router as parking_router
from routes.reservation_routes import router as reservation_router
from routes.sensor_routes import router as sensor_router
from routes.analytics_routes import router as analytics_router
from routes.optimization_routes import router as optimization_router
from auth.router import router as auth_router
from ws.manager import manager

from services.gmm_service import train_gmm

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("smart_parking_main")

app = FastAPI(
    title="Smart Parking System API",
    description="CRPark-inspired Smart Parking with modular backend structure (MongoDB + FastAPI)",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# include routers
app.include_router(base_router)
app.include_router(parking_router)
app.include_router(reservation_router)
app.include_router(sensor_router)
app.include_router(analytics_router)
app.include_router(auth_router)
app.include_router(optimization_router)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("🔌 WebSocket client disconnected")

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Starting Smart Parking Backend...")
    await connect_to_mongo()
    # Train/load GMM (if heavy, consider moving to background task)
    try:
        train_gmm()
    except Exception as e:
        logger.warning("GMM training/loading failed at startup: %s", e)

    # Print registered routes for debugging (helps confirm optimization route exists)
    try:
        from fastapi.routing import APIRoute
        routes_info = []
        for r in app.routes:
            # only print normal API routes (skip static/other internal routes)
            try:
                method = ",".join(sorted(r.methods)) if hasattr(r, "methods") else ""
                path = r.path
                routes_info.append(f"{method:10s} {path}")
            except Exception:
                continue
        logger.info("Registered routes:\n" + "\n".join(routes_info))
    except Exception as e:
        logger.warning("Failed to enumerate routes: %s", e)

    logger.info("✅ Backend initialized successfully!")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 Shutting down Smart Parking Backend...")
    await close_mongo()
    logger.info("✅ MongoDB connection closed.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
