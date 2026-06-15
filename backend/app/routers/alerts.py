from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models import Alert, Sensor, Showcase, DispositionRecord
from app.schemas import Alert as AlertSchema, AlertCreate, AlertUpdate
from app.services.anomaly_detector import anomaly_detector
from app.services.intervention_engine import intervention_engine
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/alerts", response_model=List[AlertSchema])
def get_alerts(
    status: Optional[str] = None,
    level: Optional[str] = None,
    showcase_id: Optional[int] = None,
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Alert)

    if status:
        query = query.filter(Alert.status == status)
    if level:
        query = query.filter(Alert.level == level)
    if showcase_id:
        query = query.filter(Alert.showcase_id == showcase_id)

    alerts = query.order_by(Alert.triggered_at.desc()).limit(limit).all()
    return alerts


@router.get("/alerts/{alert_id}")
def get_alert_detail(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="告警不存在")

    sensor = db.query(Sensor).filter(Sensor.id == alert.sensor_id).first()
    showcase = db.query(Showcase).filter(Showcase.id == alert.showcase_id).first()

    recommendations = []
    if sensor:
        recommendations = intervention_engine.match_strategies_for_alert(db, alert, sensor)

    return {
        "alert": alert,
        "sensor": sensor,
        "showcase": showcase,
        "recommendations": recommendations
    }


@router.post("/alerts", response_model=AlertSchema)
def create_alert(alert_data: AlertCreate, db: Session = Depends(get_db)):
    alert = Alert(**alert_data.dict())
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.put("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    operator: str = "系统管理员",
    db: Session = Depends(get_db)
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="告警不存在")

    if alert.status not in ["pending"]:
        raise HTTPException(status_code=400, detail="告警状态不允许确认")

    old_status = alert.status
    alert.status = "acknowledged"
    alert.acknowledged_at = datetime.utcnow()
    alert.acknowledged_by = operator

    disposition = DispositionRecord(
        alert_id=alert.id,
        showcase_id=alert.showcase_id,
        operator=operator,
        action_type="acknowledge",
        details=f"确认告警: {alert.message}",
        before_status=old_status,
        after_status="acknowledged"
    )
    db.add(disposition)
    db.commit()
    db.refresh(alert)

    return {"message": "告警已确认", "alert": alert}


@router.put("/alerts/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    resolution_note: str,
    operator: str = "系统管理员",
    db: Session = Depends(get_db)
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="告警不存在")

    if alert.status in ["resolved", "closed"]:
        raise HTTPException(status_code=400, detail="告警已关闭")

    old_status = alert.status
    alert.status = "resolved"
    alert.resolved_at = datetime.utcnow()
    alert.resolved_by = operator
    alert.resolution_note = resolution_note

    disposition = DispositionRecord(
        alert_id=alert.id,
        showcase_id=alert.showcase_id,
        operator=operator,
        action_type="resolve",
        details=f"处理完成: {resolution_note}",
        before_status=old_status,
        after_status="resolved"
    )
    db.add(disposition)
    db.commit()
    db.refresh(alert)

    return {"message": "告警已处理", "alert": alert}


@router.get("/alerts/summary")
def get_alert_summary(db: Session = Depends(get_db)):
    pending_count = db.query(Alert).filter(Alert.status == "pending").count()
    acknowledged_count = db.query(Alert).filter(Alert.status == "acknowledged").count()
    resolved_count = db.query(Alert).filter(Alert.status == "resolved").count()

    critical_count = db.query(Alert).filter(
        Alert.level == "critical",
        Alert.status.in_(["pending", "acknowledged"])
    ).count()
    warning_count = db.query(Alert).filter(
        Alert.level == "warning",
        Alert.status.in_(["pending", "acknowledged"])
    ).count()

    last_24h = datetime.utcnow() - timedelta(hours=24)
    today_count = db.query(Alert).filter(Alert.triggered_at >= last_24h).count()

    return {
        "pending": pending_count,
        "acknowledged": acknowledged_count,
        "resolved": resolved_count,
        "critical_active": critical_count,
        "warning_active": warning_count,
        "last_24h_count": today_count
    }


@router.get("/alerts/{alert_id}/interventions/recommend")
def get_intervention_recommendations(alert_id: int, db: Session = Depends(get_db)):
    result = intervention_engine.generate_intervention_plan(db, alert_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
