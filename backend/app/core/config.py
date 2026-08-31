from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', case_sensitive=False)

    APP_NAME: str = 'Virtual A-Share Trading'
    API_PREFIX: str = '/api'
    DEBUG: bool = False

    DATABASE_URL: str = 'sqlite:///./trading.db'

    JWT_SECRET_KEY: str = 'change-me-in-production'
    JWT_ALGORITHM: str = 'HS256'
    JWT_EXPIRE_MINUTES: int = 120

    INITIAL_CASH: str = Field(default='1000000.00')

    MARKET_PROVIDER: str = 'mock'
    SIMULATION_MARKET_DATA: bool = False

    ALLOW_OFF_HOURS_TRADING: bool = True
    MARKET_TZ: str = 'Asia/Shanghai'
    SESSION_AM_START: str = '09:30'
    SESSION_AM_END: str = '11:30'
    SESSION_PM_START: str = '13:00'
    SESSION_PM_END: str = '15:00'

    COMMISSION_RATE: str = '0.0003'
    MIN_COMMISSION: str = '5'
    STAMP_TAX_RATE: str = '0.001'
    TRANSFER_FEE_RATE: str = '0.00001'


@lru_cache
def get_settings() -> Settings:
    return Settings()
