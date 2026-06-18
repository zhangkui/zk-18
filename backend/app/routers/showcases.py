from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models import Showcase, Sensor
from app.schemas import (
    Showcase as ShowcaseSchema,
    ShowcaseCreate,
    ShowcaseUpdate,
    Sensor as SensorSchema,
    DashboardStats,
)
from app.services.profiler import showcase_profiler
from app.auth import get_current_user
from app.models import User
from sqlalchemy import func

router = APIRouter()


@router.get("/showcases")
def get_showcases(db: Session = Depends(get_db)):
    from app.models import SensorReading, ShowcaseProfile

    showcases = db.query(Showcase).all()
    result = []
    for sc in showcases:
        sensors = db.query(Sensor).filter(Sensor.showcase_id == sc.id).all()
        latest_data = {}
        for sensor in sensors:
            latest = db.query(SensorReading).filter(
                SensorReading.sensor_id == sensor.id
            ).order_by(SensorReading.time.desc()).first()
            if latest:
                latest_data[sensor.sensor_type] = {
                    "value": latest.value,
                    "time": latest.time,
                    "unit": sensor.unit,
                }
        profile = db.query(ShowcaseProfile).filter(
            ShowcaseProfile.showcase_id == sc.id
        ).first()
        result.append({
            "id": sc.id,
            "code": sc.code,
            "name": sc.name,
            "location": sc.location,
            "description": sc.description,
            "status": sc.status,
            "created_at": sc.created_at,
            "updated_at": sc.updated_at,
            "latest_data": latest_data,
            "risk_level": profile.risk_level if profile else "low",
        })
    return result


@router.get("/showcases/{showcase_id}")
def get_showcase_detail(showcase_id: int, db: Session = Depends(get_db)):
    showcase = db.query(Showcase).filter(Showcase.id == showcase_id).first()
    if not showcase:
        raise HTTPException(status_code=404, detail="展柜不存在")

    sensors = db.query(Sensor).filter(Sensor.showcase_id == showcase_id).all()
    return {
        "showcase": showcase,
        "sensors": sensors,
        "profile": showcase_profiler.get_showcase_profile(db, showcase_id)
    }


@router.get("/showcases/{showcase_id}/sensors", response_model=List[SensorSchema])
def get_showcase_sensors(showcase_id: int, db: Session = Depends(get_db)):
    sensors = db.query(Sensor).filter(Sensor.showcase_id == showcase_id).all()
    return sensors


@router.get("/sensors", response_model=List[SensorSchema])
def get_sensors(db: Session = Depends(get_db), sensor_type: str = None):
    query = db.query(Sensor)
    if sensor_type:
        query = query.filter(Sensor.sensor_type == sensor_type)
    return query.all()


@router.get("/sensors/{sensor_id}")
def get_sensor_detail(sensor_id: int, db: Session = Depends(get_db)):
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="传感器不存在")
    return sensor


@router.get("/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    from app.models import Alert, Intervention, ShowcaseProfile, SensorReading

    total_showcases = db.query(func.count(Showcase.id)).scalar() or 0
    online_showcases = db.query(func.count(Showcase.id)).filter(Showcase.status == "active").scalar() or 0
    active_sensors = db.query(func.count(Sensor.id)).filter(Sensor.status == "active").scalar() or 0
    active_alerts = db.query(func.count(Alert.id)).filter(Alert.status.in_(["pending", "acknowledged"])).scalar() or 0
    pending_interventions = db.query(func.count(Intervention.id)).filter(Intervention.status == "pending").scalar() or 0
    high_risk_showcases = db.query(func.count(ShowcaseProfile.id)).filter(ShowcaseProfile.risk_level == "high").scalar() or 0

    temp_sensor = db.query(Sensor).filter(Sensor.sensor_type == "temperature").first()
    hum_sensor = db.query(Sensor).filter(Sensor.sensor_type == "humidity").first()

    avg_temp = 20.0
    avg_hum = 50.0

    if temp_sensor:
        latest_temp = db.query(SensorReading).filter(
            SensorReading.sensor_id == temp_sensor.id
        ).order_by(SensorReading.time.desc()).first()
        if latest_temp:
            avg_temp = latest_temp.value

    if hum_sensor:
        latest_hum = db.query(SensorReading).filter(
            SensorReading.sensor_id == hum_sensor.id
        ).order_by(SensorReading.time.desc()).first()
        if latest_hum:
            avg_hum = latest_hum.value

    return DashboardStats(
        total_showcases=total_showcases,
        online_showcases=online_showcases,
        active_sensors=active_sensors,
        active_alerts=active_alerts,
        pending_interventions=pending_interventions,
        high_risk_showcases=high_risk_showcases,
        avg_temperature=avg_temp,
        avg_humidity=avg_hum
    )


@router.get("/showcases/{showcase_id}/profile")
def get_showcase_profile(showcase_id: int, db: Session = Depends(get_db)):
    profile = showcase_profiler.get_showcase_profile(db, showcase_id)
    if not profile:
        raise HTTPException(status_code=404, detail="展柜画像不存在")
    return profile


@router.post("/showcases/{showcase_id}/profile/recalculate")
def recalculate_showcase_profile(showcase_id: int, db: Session = Depends(get_db)):
    profile = showcase_profiler.calculate_showcase_profile(db, showcase_id)
    if not profile:
        raise HTTPException(status_code=404, detail="展柜不存在")
    return {"message": "展柜画像已更新", "profile": profile}


@router.post("/showcases", response_model=ShowcaseSchema)
def create_showcase(
    showcase_data: ShowcaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(Showcase).filter(Showcase.code == showcase_data.code).first():
        raise HTTPException(status_code=400, detail="展柜编号已存在")
    showcase = Showcase(**showcase_data.dict())
    db.add(showcase)
    db.commit()
    db.refresh(showcase)
    return showcase


@router.put("/showcases/{showcase_id}", response_model=ShowcaseSchema)
def update_showcase(
    showcase_id: int,
    showcase_data: ShowcaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    showcase = db.query(Showcase).filter(Showcase.id == showcase_id).first()
    if not showcase:
        raise HTTPException(status_code=404, detail="展柜不存在")
    update_dict = showcase_data.dict(exclude_unset=True)
    if "code" in update_dict and update_dict["code"] != showcase.code:
        if db.query(Showcase).filter(Showcase.code == update_dict["code"]).first():
            raise HTTPException(status_code=400, detail="展柜编号已存在")
    for key, value in update_dict.items():
        setattr(showcase, key, value)
    showcase.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(showcase)
    return showcase


@router.put("/showcases/{showcase_id}/disable")
def disable_showcase(
    showcase_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    showcase = db.query(Showcase).filter(Showcase.id == showcase_id).first()
    if not showcase:
        raise HTTPException(status_code=404, detail="展柜不存在")
    showcase.status = "inactive"
    showcase.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "展柜已停用"}


@router.put("/showcases/{showcase_id}/enable")
def enable_showcase(
    showcase_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    showcase = db.query(Showcase).filter(Showcase.id == showcase_id).first()
    if not showcase:
        raise HTTPException(status_code=404, detail="展柜不存在")
    showcase.status = "active"
    showcase.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "展柜已启用"}


@router.delete("/showcases/{showcase_id}")
def delete_showcase(
    showcase_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    showcase = db.query(Showcase).filter(Showcase.id == showcase_id).first()
    if not showcase:
        raise HTTPException(status_code=404, detail="展柜不存在")
    sensors = db.query(Sensor).filter(Sensor.showcase_id == showcase_id).count()
    if sensors > 0:
        raise HTTPException(status_code=400, detail="该展柜下还有传感器，请先移除传感器")
    db.delete(showcase)
    db.commit()
    return {"message": "展柜已删除"}
