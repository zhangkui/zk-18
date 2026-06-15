from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models import Sensor, SensorReading
from app.influx_db import influxdb_service
from app.services.anomaly_detector import anomaly_detector
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/sensors/{sensor_id}/readings")
def get_sensor_readings(
    sensor_id: int,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = Query(1000, le=10000),
    db: Session = Depends(get_db)
):
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="传感器不存在")

    if not end_time:
        end_time = datetime.utcnow()
    if not start_time:
        start_time = end_time - timedelta(hours=24)

    readings = db.query(SensorReading).filter(
        SensorReading.sensor_id == sensor_id,
        SensorReading.time >= start_time,
        SensorReading.time <= end_time
    ).order_by(SensorReading.time.desc()).limit(limit).all()

    readings.reverse()

    return {
        "sensor_id": sensor_id,
        "sensor_code": sensor.code,
        "sensor_type": sensor.sensor_type,
        "unit": sensor.unit,
        "start_time": start_time,
        "end_time": end_time,
        "count": len(readings),
        "data": [
            {"time": r.time, "value": r.value, "quality": r.quality}
            for r in readings
        ]
    }


@router.get("/showcases/{showcase_id}/readings")
def get_showcase_readings(
    showcase_id: int,
    sensor_type: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    aggregation: Optional[str] = None,
    window: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from app.models import Showcase
    showcase = db.query(Showcase).filter(Showcase.id == showcase_id).first()
    if not showcase:
        raise HTTPException(status_code=404, detail="展柜不存在")

    if not end_time:
        end_time = datetime.utcnow()
    if not start_time:
        start_time = end_time - timedelta(hours=24)

    query = db.query(Sensor).filter(Sensor.showcase_id == showcase_id)
    if sensor_type:
        query = query.filter(Sensor.sensor_type == sensor_type)

    sensors = query.all()

    result = {}
    for sensor in sensors:
        readings_query = db.query(SensorReading).filter(
            SensorReading.sensor_id == sensor.id,
            SensorReading.time >= start_time,
            SensorReading.time <= end_time
        ).order_by(SensorReading.time)

        readings = readings_query.all()

        result[sensor.sensor_type] = {
            "sensor_id": sensor.id,
            "sensor_code": sensor.code,
            "sensor_name": sensor.name,
            "unit": sensor.unit,
            "count": len(readings),
            "data": [
                {"time": r.time, "value": r.value}
                for r in readings
            ]
        }

    return {
        "showcase_id": showcase_id,
        "showcase_name": showcase.name,
        "start_time": start_time,
        "end_time": end_time,
        "sensor_types": list(result.keys()),
        "sensors": result
    }


@router.get("/sensors/{sensor_id}/latest")
def get_latest_reading(sensor_id: int, db: Session = Depends(get_db)):
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="传感器不存在")

    latest = db.query(SensorReading).filter(
        SensorReading.sensor_id == sensor_id
    ).order_by(SensorReading.time.desc()).first()

    if not latest:
        return {"sensor_id": sensor_id, "value": None, "time": None}

    return {
        "sensor_id": sensor_id,
        "sensor_code": sensor.code,
        "sensor_type": sensor.sensor_type,
        "unit": sensor.unit,
        "value": latest.value,
        "time": latest.time
    }


@router.post("/sensors/readings")
def create_reading(
    sensor_code: str,
    value: float,
    timestamp: Optional[datetime] = None,
    quality: int = 1,
    db: Session = Depends(get_db)
):
    sensor = db.query(Sensor).filter(Sensor.code == sensor_code).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="传感器不存在")

    if not timestamp:
        timestamp = datetime.utcnow()

    reading = SensorReading(
        time=timestamp,
        sensor_id=sensor.id,
        value=value,
        quality=quality
    )
    db.add(reading)
    db.commit()

    try:
        influxdb_service.write_sensor_data(
            sensor_code=sensor.code,
            sensor_type=sensor.sensor_type,
            showcase_id=sensor.showcase_id,
            value=value,
            timestamp=timestamp,
            quality=quality
        )
    except Exception as e:
        logger.error(f"Error writing to InfluxDB: {e}")

    return {"message": "数据已保存", "sensor_code": sensor_code, "value": value}


@router.get("/sensors/{sensor_id}/anomalies/check")
def check_anomaly(
    sensor_id: int,
    value: float,
    db: Session = Depends(get_db)
):
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="传感器不存在")

    readings = db.query(SensorReading).filter(
        SensorReading.sensor_id == sensor_id
    ).order_by(SensorReading.time.desc()).limit(100).all()

    readings.reverse()
    values = [r.value for r in readings]
    times = [r.time for r in readings]

    result = anomaly_detector.comprehensive_detection(
        value=value,
        history_values=values,
        history_times=times,
        min_threshold=sensor.min_threshold,
        max_threshold=sensor.max_threshold,
        warning_threshold=sensor.warning_threshold,
        sensor_type=sensor.sensor_type
    )

    return result
