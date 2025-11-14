# services/gmm_service.py
from sklearn.mixture import GaussianMixture
import numpy as np
import logging

logger = logging.getLogger("smart_parking")

gmm_model = None

def train_gmm(n_components: int = 3, random_state: int = 42):
    """Train a simple GMM on synthetic hour/day features (used for demo)."""
    global gmm_model
    np.random.seed(random_state)
    hours = np.random.randint(0, 24, 1000)
    days = np.random.randint(0, 7, 1000)
    features = np.column_stack([hours, days])
    gmm_model = GaussianMixture(n_components=n_components, random_state=random_state)
    gmm_model.fit(features)
    logger.info("✅ GMM model trained successfully")
    return gmm_model

def predict_gmm(hour:int, day:int):
    """Return GMM posterior for a simple (hour, day) feature."""
    global gmm_model
    if gmm_model is None:
        raise RuntimeError("GMM model not trained")
    x = np.array([[hour, day]])
    probs = gmm_model.predict_proba(x)
    return probs
