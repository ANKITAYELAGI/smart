# backend/core/database.py
import asyncio
import motor.motor_asyncio
from pymongo import GEOSPHERE
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("smart_parking_db")

class DatabaseManager:
    """MongoDB database manager for Smart Parking System"""

    def __init__(self, mongodb_url="mongodb://localhost:27017", database_name="smart_parking"):
        self.mongodb_url = mongodb_url
        self.database_name = database_name
        self.client = None
        self.db = None

    async def connect(self):
        """Connect to MongoDB"""
        try:
            self.client = motor.motor_asyncio.AsyncIOMotorClient(self.mongodb_url)
            self.db = self.client[self.database_name]

            await self.client.admin.command("ping")
            logger.info(f"✅ Connected to MongoDB: {self.database_name}")

            await self.safe_reset_collections()
            await self.create_indexes()

        except Exception as e:
            logger.error(f"❌ Failed to connect to MongoDB: {e}")
            raise

    async def disconnect(self):
        """Disconnect from MongoDB"""
        if self.client:
            self.client.close()
            logger.info("🔌 Disconnected from MongoDB")

    async def safe_reset_collections(self):
        """Drop outdated or conflicting collections"""
        collections_to_reset = ["reservations"]
        for name in collections_to_reset:
            try:
                await self.db.drop_collection(name)
                logger.info(f"🧹 Dropped old collection: {name}")
            except Exception as e:
                logger.warning(f"⚠️ Could not drop collection {name}: {e}")

    async def create_indexes(self):
        """Create necessary indexes for collections"""
        try:
            for collection_name in [
                "parking_lots",
                "reservations",
                "sensor_data",
                "optimization_logs",
                "device_heartbeats",
            ]:
                try:
                    await self.db[collection_name].drop_indexes()
                except Exception:
                    pass

            await self.db.parking_lots.create_index("lot_id", unique=True)
            await self.db.parking_lots.create_index([("location", GEOSPHERE)])

            await self.db.reservations.create_index("reservation_id", unique=True)
            await self.db.reservations.create_index("user_id")
            await self.db.reservations.create_index("lot_id")
            await self.db.reservations.create_index("status")

            await self.db.sensor_data.create_index("slot_id")
            await self.db.sensor_data.create_index("lot_id")
            await self.db.sensor_data.create_index("timestamp")

            await self.db.optimization_logs.create_index("timestamp")
            await self.db.optimization_logs.create_index("status")

            await self.db.device_heartbeats.create_index("device_id")
            await self.db.device_heartbeats.create_index("timestamp")

            logger.info("✅ MongoDB indexes created successfully")

        except Exception as e:
            logger.error(f"❌ Index creation failed: {e}")

    async def initialize_sample_data(self):
        """Initialize the DB with default Bengaluru sample data"""
        try:
            for col in ["parking_lots", "sensor_data", "users"]:
                await self.db[col].delete_many({})

            parking_lots = [
                {
                    "lot_id": "lot_001",
                    "name": "MG Road Parking Complex",
                    "location": {"lat": 12.9716, "lng": 77.5946},
                    "address": "MG Road, Bengaluru, Karnataka",
                    "total_slots": 60,
                    "reserved_slots": 10,
                    "competitive_slots": 45,
                    "occupied_slots": 5,
                    "hourly_rate": 40.0,
                    "features": ["covered", "security", "EV charging"],
                    "created_at": datetime.now(),
                    "updated_at": datetime.now(),
                },
                {
                    "lot_id": "lot_002",
                    "name": "Koramangala 1st Block Parking",
                    "location": {"lat": 12.9352, "lng": 77.6245},
                    "address": "Koramangala, Bengaluru, Karnataka",
                    "total_slots": 90,
                    "reserved_slots": 20,
                    "competitive_slots": 65,
                    "occupied_slots": 5,
                    "hourly_rate": 30.0,
                    "features": ["open", "security"],
                    "created_at": datetime.now(),
                    "updated_at": datetime.now(),
                },
                {
                    "lot_id": "lot_003",
                    "name": "Whitefield Forum Value Mall Parking",
                    "location": {"lat": 12.9692, "lng": 77.7496},
                    "address": "Forum Value Mall, Whitefield, Bengaluru, Karnataka",
                    "total_slots": 120,
                    "reserved_slots": 30,
                    "competitive_slots": 80,
                    "occupied_slots": 10,
                    "hourly_rate": 35.0,
                    "features": ["covered", "security", "mall access"],
                    "created_at": datetime.now(),
                    "updated_at": datetime.now(),
                },
                    {
        "lot_id": "lot_004",
        "name": "Brigade Road Parking Lot",
        "location": {"lat": 12.9719, "lng": 77.6070},
        "address": "Brigade Road, Bengaluru",
        "total_slots": 100,
        "reserved_slots": 15,
        "competitive_slots": 75,
        "occupied_slots": 10,
        "hourly_rate": 40.0,
        "features": ["covered", "security"],
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    },
    {
        "lot_id": "lot_005",
        "name": "Church Street Parking Hub",
        "location": {"lat": 12.9750, "lng": 77.6030},
        "address": "Church Street, Bengaluru",
        "total_slots": 80,
        "reserved_slots": 12,
        "competitive_slots": 60,
        "occupied_slots": 8,
        "hourly_rate": 35.0,
        "features": ["open", "security"],
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    },
    {
        "lot_id": "lot_006",
        "name": "Marathahalli Bridge Parking",
        "location": {"lat": 12.9543, "lng": 77.7019},
        "address": "Marathahalli Bridge, Bengaluru",
        "total_slots": 110,
        "reserved_slots": 20,
        "competitive_slots": 80,
        "occupied_slots": 10,
        "hourly_rate": 30.0,
        "features": ["open", "security"],
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    },
    {
        "lot_id": "lot_007",
        "name": "Jayanagar 4th Block Parking",
        "location": {"lat": 12.9277, "lng": 77.5839},
        "address": "Jayanagar 4th Block, Bengaluru",
        "total_slots": 130,
        "reserved_slots": 25,
        "competitive_slots": 95,
        "occupied_slots": 10,
        "hourly_rate": 25.0,
        "features": ["covered", "security"],
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    },
    {
        "lot_id": "lot_008",
        "name": "BTM Layout Parking Zone",
        "location": {"lat": 12.9155, "lng": 77.6100},
        "address": "BTM Layout, Bengaluru",
        "total_slots": 120,
        "reserved_slots": 22,
        "competitive_slots": 85,
        "occupied_slots": 13,
        "hourly_rate": 30.0,
        "features": ["open", "security"],
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    },

            ]

            for lot in parking_lots:
                await self.db.parking_lots.replace_one({"lot_id": lot["lot_id"]}, lot, upsert=True)

            users = [
                {
                    "user_id": "user_001",
                    "name": "John Doe",
                    "email": "john@example.com",
                    "phone": "+91-9876543210",
                    "role": "user",
                    "created_at": datetime.now(),
                    "updated_at": datetime.now(),
                },
                {
                    "user_id": "admin_001",
                    "name": "Admin User",
                    "email": "admin@parking.in",
                    "phone": "+91-9123456780",
                    "role": "admin",
                    "permissions": ["read", "write", "admin"],
                    "created_at": datetime.now(),
                    "updated_at": datetime.now(),
                },
            ]

            for user in users:
                await self.db.users.replace_one({"user_id": user["user_id"]}, user, upsert=True)

            # Example sensor data
            sensor_data = []
            for lot in parking_lots:
                total = lot["total_slots"]
                for slot_num in range(1, total + 1):
                    sensor_data.append({
                        "slot_id": f"{lot['lot_id']}_slot_{slot_num}",
                        "lot_id": lot["lot_id"],
                        "distance": 40.0 + (slot_num * 1.0),
                        "timestamp": datetime.now(),
                        "status": "free" if slot_num % 4 != 0 else "occupied",
                        "device_id": f"device_{lot['lot_id']}",
                    })
            if sensor_data:
                await self.db.sensor_data.insert_many(sensor_data)

            logger.info("✅ Sample data initialized successfully")

        except Exception as e:
            logger.error(f"❌ Failed to initialize sample data: {e}")

    async def get_collection_stats(self):
        """Get basic counts for each collection"""
        stats = {}
        for col in ["parking_lots", "reservations", "sensor_data", "users"]:
            try:
                stats[col] = await self.db[col].count_documents({})
            except Exception as e:
                stats[col] = f"Error: {e}"
        return stats


# Shared global instance
database_manager = DatabaseManager()
db = None


async def connect_to_mongo():
    """Establish MongoDB connection and initialize sample data."""
    global db
    await database_manager.connect()
    db = database_manager.db
    await database_manager.initialize_sample_data()


async def close_mongo():
    """Close MongoDB connection cleanly."""
    await database_manager.disconnect()


# Allow running this file directly for database seeding
if __name__ == "__main__":
    import asyncio
    async def main():
        await connect_to_mongo()
        stats = await database_manager.get_collection_stats()
        print("📊 Database Stats:", stats)
        await close_mongo()
    asyncio.run(main())

