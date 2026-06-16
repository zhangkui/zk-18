from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models import Sensor, Showcase
from app.schemas import Sensor as SensorSchema, SensorCreate, SensorUpdate
from app.auth import get_current_user
from app.models import User

router = APIRouter()


@router.get("/sensors", response_model=List[SensorSchema])
def get_sensors(
    sensor_type: Optional[str] = None,
    status: Optional[str] = None,
    showcase_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Sensor)
    if sensor_type:
        query = query.filter(Sensor.sensor_type == sensor_type)
    if status:
        query = query.filter(Sensor.status == status)
    if showcase_id:
        query = query.filter(Sensor.showcase_id == showcase_id)
    return query.order_by(Sensor.created_at.desc()).all()


@router.get("/sensors/{sensor_id}", response_model=SensorSchema)
def get_sensor_detail(
    sensor_id: int,
    db: Session = Depends(get_db),
):
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="传感器不存在")
    return sensor


@router.post("/sensors", response_model=SensorSchema)
def create_sensor(
    sensor_data: SensorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(Sensor).filter(Sensor.code == sensor_data.code).first():
        raise HTTPException(status_code=400, detail="传感器编号已存在")
    showcase = db.query(Showcase).filter(Showcase.id == sensor_data.showcase_id).first()
    if not showcase:
        raise HTTPException(status_code=400, detail="所属展柜不存在")
    sensor = Sensor(**sensor_data.dict())
    db.add(sensor)
    db.commit()
    db.refresh(sensor)
    return sensor


@router.put("/sensors/{sensor_id}", response_model=SensorSchema)
def update_sensor(
    sensor_id: int,
    sensor_data: SensorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="传感器不存在")
    update_dict = sensor_data.dict(exclude_unset=True)
    if "code" in update_dict and update_dict["code"] != sensor.code:
        if db.query(Sensor).filter(Sensor.code == update_dict["code"]).first():
            raise HTTPException(status_code=400, detail="传感器编号已存在")
    if "showcase_id" in update_dict:
        showcase = db.query(Showcase).filter(Showcase.id == update_dict["showcase_id"]).first()
        if not showcase:
            raise HTTPException(status_code=400, detail="所属展柜不存在")
    for key, value in update_dict.items():
        setattr(sensor, key, value)
    sensor.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(sensor)
    return sensor


@router.put("/sensors/{sensor_id}/disable")
def disable_sensor(
    sensor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="传感器不存在")
    sensor.status = "inactive"
    sensor.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "传感器已停用"}


@router.put("/sensors/{sensor_id}/enable")
def enable_sensor(
    sensor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="传感器不存在")
    sensor.status = "active"
    sensor.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "传感器已启用"}


@router.delete("/sensors/{sensor_id}")
def delete_sensor(
    sensor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="传感器不存在")
    db.delete(sensor)
    db.commit()
    return {"message": "传感器已删除"}
