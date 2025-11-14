import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ---- Configuration ----
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")

# ---- Logging ----
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("smart_parking")

logger.info("✅ Configuration loaded successfully")
