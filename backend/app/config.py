from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "博物馆文物微环境分析系统"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    TIMESCALE_HOST: str = "localhost"
    TIMESCALE_PORT: int = 5432
    TIMESCALE_USER: str = "museum_admin"
    TIMESCALE_PASSWORD: str = "museum_secure_pass_2024"
    TIMESCALE_DB: str = "museum_env"

    INFLUXDB_HOST: str = "localhost"
    INFLUXDB_PORT: int = 8086
    INFLUXDB_TOKEN: str = "museum-influx-token-2024-secret"
    INFLUXDB_ORG: str = "museum"
    INFLUXDB_BUCKET: str = "sensor_data"
    INFLUXDB_URL: Optional[str] = None

    MQTT_HOST: str = "localhost"
    MQTT_PORT: int = 1883
    MQTT_USERNAME: str = "admin"
    MQTT_PASSWORD: str = "public"
    MQTT_TOPIC_PREFIX: str = "museum/sensor"

    SECRET_KEY: str = "museum-jwt-secret-key-2024-secure"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
