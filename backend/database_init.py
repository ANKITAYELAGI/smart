import asyncio
import motor.motor_asyncio
from pymongo import GEOSPHERE
from datetime import datetime, timedelta
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

            # Test connection
            await self.client.admin.command("ping")
            logger.info(f"✅ Connected to MongoDB: {self.database_name}")

            # Drop conflicting collections before index creation
            await self.safe_reset_collections()

            # Create indexes
            await self.create_indexes()

        except Exception as e:
            logger.error(f"❌ Failed to connect to MongoDB: {str(e)}")
            raise

    async def disconnect(self):
        """Disconnect from MongoDB"""
        if self.client:
            self.client.close()
            logger.info("Disconnected from MongoDB")

    async def safe_reset_collections(self):
        """Drops problematic collections if duplicates exist"""
        collections_to_reset = ["reservations"]
        for name in collections_to_reset:
            try:
                await self.db.drop_collection(name)
                logger.info(f"🧹 Dropped old collection: {name}")
            except Exception as e:
                logger.warning(f"⚠️ Could not drop collection {name}: {e}")

    async def create_indexes(self):
        """Create database indexes for better performance"""
        try:
            # Drop all old indexes
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

            # Parking lots collection
            await self.db.parking_lots.create_index("lot_id", unique=True)
            await self.db.parking_lots.create_index([("location", GEOSPHERE)])

            # Reservations collection
            await self.db.reservations.create_index("reservation_id", unique=True)
            await self.db.reservations.create_index("user_id")
            await self.db.reservations.create_index("lot_id")
            await self.db.reservations.create_index("start_time")
            await self.db.reservations.create_index("status")

            # Sensor data collection
            await self.db.sensor_data.create_index("slot_id")
            await self.db.sensor_data.create_index("lot_id")
            await self.db.sensor_data.create_index("timestamp")
            await self.db.sensor_data.create_index([("lot_id", 1), ("timestamp", -1)])

            # Optimization logs collection
            await self.db.optimization_logs.create_index("timestamp")
            await self.db.optimization_logs.create_index("status")

            # Device heartbeats collection
            await self.db.device_heartbeats.create_index("device_id")
            await self.db.device_heartbeats.create_index("timestamp")

            logger.info("✅ Database indexes created successfully")

        except Exception as e:
            logger.error(f"❌ Failed to create indexes: {str(e)}")

    async def initialize_sample_data(self):
        """Initialize database with sample data"""
        try:
            # Clean collections before inserting
            for collection in ["parking_lots", "sensor_data", "users"]:
                await self.db[collection].delete_many({})

            # Sample parking lots in Bengaluru
            parking_lots = [
                {
                    "lot_id": "lot_001",
                    "name": "MG Road Parking Complex",
                    "location": { "lat": 12.9716, "lng": 77.5946 },

                    "address": "MG Road, Bengaluru, Karnataka",
                    "total_slots": 60,
                    "reserved_slots": 10,
                    "competitive_slots": 45,
                    "occupied_slots": 5,
                    "hourly_rate": 40.0,
                    "features": ["covered", "security", "EV charging"],
                    "created_at": datetime.now(),
                    "updated_at": datetime.now()
                },
                {
                    "lot_id": "lot_002",
                    "name": "Koramangala 1st Block Parking",
                    "location": { "lat": 12.9716, "lng": 77.5946 }

                    "address": "Koramangala 1st Block, Bengaluru, Karnataka",
                    "total_slots": 90,
                    "reserved_slots": 20,
                    "competitive_slots": 65,
                    "occupied_slots": 5,
                    "hourly_rate": 30.0,
                    "features": ["open", "security"],
                    "created_at": datetime.now(),
                    "updated_at": datetime.now()
                },
                {
                    "lot_id": "lot_003",
                    "name": "Whitefield Forum Value Mall Parking",
                    "location": { "lat": 12.9716, "lng": 77.5946 }

                    "address": "Forum Value Mall, Whitefield, Bengaluru, Karnataka",
                    "total_slots": 120,
                    "reserved_slots": 30,
                    "competitive_slots": 80,
                    "occupied_slots": 10,
                    "hourly_rate": 35.0,
                    "features": ["covered", "security", "mall access"],
                    "created_at": datetime.now(),
                    "updated_at": datetime.now()
                },
            ]

            # Insert or update parking lots
            for lot in parking_lots:
                await self.db.parking_lots.replace_one({"lot_id": lot["lot_id"]}, lot, upsert=True)

            # Sample users
            users = [
                {
                    "user_id": "user_001",
                    "name": "John Doe",
                    "email": "john@example.com",
                    "phone": "+91-9876543210",
                    "role": "user",
                    "preferences": {
                        "max_walking_distance": 400,
                        "preferred_lots": ["lot_001", "lot_002"],
                        "notification_enabled": True,
                    },
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

            # Simulated sensor data
            sensor_data = []
            for lot in parking_lots:
                for slot_num in range(1, 11):
                    sensor_data.append({
                        "slot_id": f"{lot['lot_id']}_slot_{slot_num}",
                        "lot_id": lot["lot_id"],
                        "distance": 40.0 + (slot_num * 2.5),
                        "timestamp": datetime.now(),
                        "status": "free" if slot_num % 3 != 0 else "occupied",
                        "device_id": f"device_{lot['lot_id'].split('_')[1]}",
                        "sensor_index": slot_num - 1,
                    })

            if sensor_data:
                await self.db.sensor_data.insert_many(sensor_data)

            logger.info("✅ Sample data (Bengaluru) initialized successfully")

        except Exception as e:
            logger.error(f"❌ Failed to initialize sample data: {str(e)}")

    async def get_collection_stats(self):
        """Get statistics for all collections"""
        stats = {}
        for collection in ["parking_lots", "reservations", "sensor_data", "users"]:
            try:
                count = await self.db[collection].count_documents({})
                stats[collection] = count
            except Exception as e:
                stats[collection] = f"Error: {str(e)}"
        return stats


async def main():
    print("🗄️ Smart Parking Database Initialization")
    print("=" * 50)

    db = DatabaseManager()

    try:
        await db.connect()
        await db.initialize_sample_data()
        stats = await db.get_collection_stats()

        print("\n📊 Database Statistics:")
        for k, v in stats.items():
            print(f"  {k}: {v} documents")

        print("\n✅ Database initialization completed successfully!")

    except Exception as e:
        print(f"❌ Database initialization failed: {str(e)}")

    finally:
        await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
