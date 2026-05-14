import fastf1
import os
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


def setup_fastf1_cache():
    """Initialize FastF1 cache directory."""
    cache_dir = os.path.abspath(settings.CACHE_DIR)
    os.makedirs(cache_dir, exist_ok=True)
    fastf1.Cache.enable_cache(cache_dir)
    logger.info(f"FastF1 cache enabled at: {cache_dir}")
