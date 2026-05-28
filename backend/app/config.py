"""
Application settings loaded from environment / .env file.
"""

from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings

ASSETS = ["NIFTY50", "USDINR", "GOLD", "CRUDE", "GSEC10Y", "FII_FLOW"]


class Settings(BaseSettings):
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    ALLOWED_ORIGINS: str = "http://localhost:3000"

    DATA_START_DATE: str = "2020-01-01"
    CACHE_DIR: str = "data/cache"

    DEFAULT_WINDOW: int = 60
    DEFAULT_THRESHOLD: float = 2.0
    HIST_WINDOW: int = 252

    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "text"

    RETRY_MAX_ATTEMPTS: int = 3
    CIRCUIT_BREAKER_FAILURES: int = 3
    CIRCUIT_BREAKER_COOLDOWN: int = 3600

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
