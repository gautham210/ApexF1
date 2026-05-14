from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    CACHE_DIR: str = "./cache"
    LOG_LEVEL: str = "INFO"
    RATE_LIMIT_PER_MINUTE: int = 60
    WS_HEARTBEAT_INTERVAL: int = 30
    LIVE_DATA_REFRESH_SECONDS: int = 5

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
