"""
Application settings loaded from environment / .env file.
"""

from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings

# Single source of truth for asset list
ASSETS = ["NIFTY50", "USDINR", "GOLD", "CRUDE", "GSEC10Y", "FII_FLOW"]


class Settings(BaseSettings):
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Store as comma-separated string in .env:
    #   ALLOWED_ORIGINS=http://localhost:3000,https://your-app.vercel.app
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # Data ingestion
    DATA_START_DATE: str = "2020-01-01"
    CACHE_DIR: str = "data/cache"

    # Anomaly defaults
    DEFAULT_WINDOW: int = 60
    DEFAULT_THRESHOLD: float = 2.0
    HIST_WINDOW: int = 252

    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse comma-separated ALLOWED_ORIGINS into a list."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton — reads .env only once."""
    return Settings()
