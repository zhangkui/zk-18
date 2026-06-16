from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import showcases, timeseries, alerts, interventions, analytics, users, sensors
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="博物馆文物微环境波动分析与展柜干预决策系统 API"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(showcases.router, prefix=f"{settings.API_PREFIX}/showcases", tags=["展柜管理"])
app.include_router(timeseries.router, prefix=f"{settings.API_PREFIX}/timeseries", tags=["时序数据"])
app.include_router(alerts.router, prefix=f"{settings.API_PREFIX}/alerts", tags=["告警管理"])
app.include_router(interventions.router, prefix=f"{settings.API_PREFIX}/interventions", tags=["干预管理"])
app.include_router(analytics.router, prefix=f"{settings.API_PREFIX}/analytics", tags=["分析统计"])
app.include_router(users.router, prefix=f"{settings.API_PREFIX}/users", tags=["用户管理"])
app.include_router(sensors.router, prefix=f"{settings.API_PREFIX}/sensors", tags=["传感器管理"])


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "api_prefix": settings.API_PREFIX
    }


@app.get(f"{settings.API_PREFIX}/health")
def health_check():
    return {"status": "healthy"}


@app.on_event("startup")
async def startup_event():
    logger.info("Starting up application...")

    try:
        from app.database import engine, Base
        from app.models import User, Showcase, Sensor, SensorReading, Alert, Intervention, InterventionStrategy, ShowcaseProfile, DispositionRecord, TrendAnalysis
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified")

        from app.database import SessionLocal
        from app.auth import get_password_hash
        db = SessionLocal()
        try:
            admin_user = db.query(User).filter(User.username == "admin").first()
            if not admin_user:
                admin_user = User(
                    username="admin",
                    password_hash=get_password_hash("admin123"),
                    real_name="系统管理员",
                    role="admin",
                    status="active",
                )
                db.add(admin_user)
                db.commit()
                logger.info("Default admin user created (admin/admin123)")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Database initialization error: {e}")

    try:
        from app.mqtt_client import mqtt_service
        mqtt_service.start()
        logger.info("MQTT service started")
    except Exception as e:
        logger.error(f"Failed to start MQTT service: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down application...")
    try:
        from app.mqtt_client import mqtt_service
        mqtt_service.stop()
        logger.info("MQTT service stopped")
    except Exception as e:
        logger.error(f"Error stopping MQTT service: {e}")

    try:
        from app.influx_db import influxdb_service
        influxdb_service.close()
        logger.info("InfluxDB connection closed")
    except Exception as e:
        logger.error(f"Error closing InfluxDB connection: {e}")
