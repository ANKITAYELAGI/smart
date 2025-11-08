import asyncio
import motor.motor_asyncio
from pymongo import MongoClient
import os
from datetime import datetime
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
            await self.client.admin.command('ping')
            logger.info(f"✅ Connected to MongoDB: {self.database_name}")
            
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
            
    async def create_indexes(self):
        """Create database indexes for better performance"""
        try:
            # Parking lots collection
            await self.db.parking_lots.create_index("lot_id", unique=True)
            await self.db.parking_lots.create_index("location", "2dsphere")
            
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
            # Sample parking lots
            parking_lots = [
                {
                    "lot_id": "lot_001",
                    "name": "Downtown Plaza",
                    "location": {
                        "type": "Point",
                        "coordinates": [-74.0060, 40.7128]
                    },
                    "address": "123 Main St, New York, NY",
                    "total_slots": 50,
                    "reserved_slots": 10,
                    "competitive_slots": 35,
                    "occupied_slots": 5,
                    "pa_i": 0.7,
                    "rs_i": 0.2,
                    "hourly_rate": 3.50,
                    "features": ["covered", "security", "ev_charging"],
                    "created_at": datetime.now(),
                    "updated_at": datetime.now()
                },
                {
                    "lot_id": "lot_002",
                    "name": "Central Station",
                    "location": {
                        "type": "Point",
                        "coordinates": [-73.9851, 40.7589]
                    },
                    "address": "456 Station Ave, New York, NY",
                    "total_slots": 80,
                    "reserved_slots": 15,
                    "competitive_slots": 60,
                    "occupied_slots": 5,
                    "pa_i": 0.8,
                    "rs_i": 0.19,
                    "hourly_rate": 4.00,
                    "features": ["covered", "security", "valet"],
                    "created_at": datetime.now(),
                    "updated_at": datetime.now()
                },
                {
                    "lot_id": "lot_003",
                    "name": "Shopping Mall",
                    "location": {
                        "type": "Point",
                        "coordinates": [-73.9934, 40.7505]
                    },
                    "address": "789 Mall Blvd, New York, NY",
                    "total_slots": 120,
                    "reserved_slots": 25,
                    "competitive_slots": 90,
                    "occupied_slots": 5,
                    "pa_i": 0.6,
                    "rs_i": 0.21,
                    "hourly_rate": 2.75,
                    "features": ["covered", "security", "shopping_access"],
                    "created_at": datetime.now(),
                    "updated_at": datetime.now()
                }
            ]
            
            # Insert parking lots
            for lot in parking_lots:
                await self.db.parking_lots.replace_one(
                    {"lot_id": lot["lot_id"]}, 
                    lot, 
                    upsert=True
                )
            
            # Sample users
            users = [
                {
                    "user_id": "user_001",
                    "name": "John Doe",
                    "email": "john@example.com",
                    "phone": "+1-555-0123",
                    "role": "user",
                    "preferences": {
                        "max_walking_distance": 500,
                        "preferred_lots": ["lot_001", "lot_002"],
                        "notification_enabled": True
                    },
                    "created_at": datetime.now(),
                    "updated_at": datetime.now()
                },
                {
                    "user_id": "admin_001",
                    "name": "Admin User",
                    "email": "admin@parking.com",
                    "phone": "+1-555-0124",
                    "role": "admin",
                    "permissions": ["read", "write", "admin"],
                    "created_at": datetime.now(),
                    "updated_at": datetime.now()
                }
            ]
            
            # Insert users
            for user in users:
                await self.db.users.replace_one(
                    {"user_id": user["user_id"]}, 
                    user, 
                    upsert=True
                )
            
            # Sample sensor data
            sensor_data = []
            for lot_id in ["lot_001", "lot_002", "lot_003"]:
                for slot_num in range(1, 11):  # First 10 slots of each lot
                    slot_id = f"{lot_id}_slot_{slot_num}"
                    sensor_data.append({
                        "slot_id": slot_id,
                        "lot_id": lot_id,
                        "distance": 45.2 + (slot_num * 2.1),
                        "timestamp": datetime.now(),
                        "status": "free",
                        "device_id": f"device_{lot_id.split('_')[1]}",
                        "sensor_index": slot_num - 1
                    })
            
            # Insert sensor data
            if sensor_data:
                await self.db.sensor_data.insert_many(sensor_data)
            
            logger.info("✅ Sample data initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize sample data: {str(e)}")
            
    async def get_collection_stats(self):
        """Get statistics for all collections"""
        stats = {}
        
        collections = [
            "parking_lots", "reservations", "sensor_data", 
            "optimization_logs", "device_heartbeats", "users"
        ]
        
        for collection_name in collections:
            try:
                count = await self.db[collection_name].count_documents({})
                stats[collection_name] = count
            except Exception as e:
                stats[collection_name] = f"Error: {str(e)}"
                
        return stats
        
    async def cleanup_old_data(self, days=30):
        """Clean up old data to prevent database bloat"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days)
            
            # Clean old sensor data
            sensor_result = await self.db.sensor_data.delete_many({
                "timestamp": {"$lt": cutoff_date}
            })
            
            # Clean old optimization logs
            opt_result = await self.db.optimization_logs.delete_many({
                "timestamp": {"$lt": cutoff_date}
            })
            
            # Clean old heartbeats
            heartbeat_result = await self.db.device_heartbeats.delete_many({
                "timestamp": {"$lt": cutoff_date}
            })
            
            logger.info(f"✅ Cleanup completed: {sensor_result.deleted_count} sensor records, "
                       f"{opt_result.deleted_count} optimization logs, "
                       f"{heartbeat_result.deleted_count} heartbeats removed")
                       
        except Exception as e:
            logger.error(f"❌ Failed to cleanup old data: {str(e)}")

async def main():
    """Main function to initialize database"""
    print("🗄️ Smart Parking Database Initialization")
    print("=" * 50)
    
    # Initialize database manager
    db_manager = DatabaseManager()
    
    try:
        # Connect to database
        await db_manager.connect()
        
        # Initialize sample data
        await db_manager.initialize_sample_data()
        
        # Get collection statistics
        stats = await db_manager.get_collection_stats()
        print("\n📊 Database Statistics:")
        for collection, count in stats.items():
            print(f"  {collection}: {count} documents")
            
        print("\n✅ Database initialization completed successfully!")
        
    except Exception as e:
        print(f"❌ Database initialization failed: {str(e)}")
        
    finally:
        # Disconnect
        await db_manager.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
