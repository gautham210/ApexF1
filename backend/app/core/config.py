from pydantic_settings import BaseSettings
from typing import List
from pydantic import SecretStr


class Settings(BaseSettings):
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,https://apex-f1-one.vercel.app"
    CACHE_DIR: str = "./cache"
    LOG_LEVEL: str = "INFO"
    RATE_LIMIT_PER_MINUTE: int = 60
    WS_HEARTBEAT_INTERVAL: int = 30
    LIVE_DATA_REFRESH_SECONDS: int = 30
    OPENF1_USERNAME: SecretStr = SecretStr("")
    OPENF1_PASSWORD: SecretStr = SecretStr("")
    OPENF1_TOKEN: SecretStr = SecretStr("")
    OPENF1_IMAGES_ENABLED: bool = False
    NEWS_FEEDS: str = "https://www.autosport.com/rss/f1/news/|Autosport,https://www.motorsport.com/rss/f1/news/|Motorsport.com,https://www.bbc.co.uk/sport/formula1/rss.xml|BBC Sport"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
