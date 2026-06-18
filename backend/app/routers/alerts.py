from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy import func
from app.database import get_db
from app.models import Alert, Sensor, Showcase, DispositionRecord, User
from app.schemas import Alert as AlertSchema, AlertCreate, AlertUpdate
from app.services.anomaly_detector import anomaly_detector
from app.services.intervention_engine import intervention_engine
from app.auth import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


def _auto_assign_alert(db: Session, alert: Alert):
    non_admin_users = db.query(User).filter(
        User.role != "admin",
        User.status == "active"
    ).order_by(User.id).all()
    if not non_admin_users:
        return
    pending_alerts_count = {}
    for user in non_admin_users:
        count = db.query(Alert).filter(
            Alert.assigned_user_id == user.id,
            Alert.status.in_(["pending", "acknowledged"])
        ).count()
        pending_alerts_count[user.id] = count
    min_count_user = min(non_admin_users, key=lambda u: pending_alerts_count[u.id])
    alert.assigned_user_id = min_count_user.id
    db.commit()
    logger.info(f"Auto-assigned alert {alert.id} to user {min_count_user.username}")


def _alert_to_dict(alert: Alert, db: Session) -> dict:
    result = {
        "id": alert.id,
        "sensor_id": alert.sensor_id,
        "showcase_id": alert.showcase_id,
        "alert_type": alert.alert_type,
        "level": alert.level,
        "message": alert.message,
        "value": alert.value,
        "threshold": alert.threshold,
        "status": alert.status,
        "triggered_at": alert.triggered_at,
        "acknowledged_at": alert.acknowledged_at,
        "acknowledged_by": alert.acknowledged_by,
        "resolved_at": alert.resolved_at,
        "resolved_by": alert.resolved_by,
        "resolution_note": alert.resolution_note,
        "assigned_user_id": alert.assigned_user_id,
        "created_at": alert.created_at,
    }
    if alert.assigned_user_id:
        user = db.query(User).filter(User.id == alert.assigned_user_id).first()
        result["assigned_user_name"] = user.real_name or user.username if user else None
    else:
        result["assigned_user_name"] = None
    return result


@router.get("/alerts")
def get_alerts(
    status: Optional[str] = None,
    level: Optional[str] = None,
    showcase_id: Optional[int] = None,
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Alert)

    if current_user.role != "admin":
        query = query.filter(Alert.assigned_user_id == current_user.id)

    if status:
        query = query.filter(Alert.status == status)
    if level:
        query = query.filter(Alert.level == level)
    if showcase_id:
        query = query.filter(Alert.showcase_id == showcase_id)

    alerts = query.order_by(Alert.triggered_at.desc()).limit(limit).all()
    return [_alert_to_dict(a, db) for a in alerts]


@router.get("/alerts/summary")
def get_alert_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Alert)
    if current_user.role != "admin":
        query = query.filter(Alert.assigned_user_id == current_user.id)

    pending_count = query.filter(Alert.status == "pending").count()
    acknowledged_count = query.filter(Alert.status == "acknowledged").count()
    resolved_count = query.filter(Alert.status == "resolved").count()

    critical_active = query.filter(
        Alert.level == "critical",
        Alert.status.in_(["pending", "acknowledged"])
    ).count()
    warning_active = query.filter(
        Alert.level == "warning",
        Alert.status.in_(["pending", "acknowledged"])
    ).count()
    info_active = query.filter(
        Alert.level == "info",
        Alert.status.in_(["pending", "acknowledged"])
    ).count()

    critical_total = query.filter(Alert.level == "critical").count()
    warning_total = query.filter(Alert.level == "warning").count()
    info_total = query.filter(Alert.level == "info").count()

    last_24h = datetime.utcnow() - timedelta(hours=24)
    today_count = query.filter(Alert.triggered_at >= last_24h).count()

    alert_types = query.with_entities(
        Alert.alert_type,
        func.count(Alert.id)
    ).group_by(Alert.alert_type).all()

    by_alert_type = {at: cnt for at, cnt in alert_types}

    return {
        "pending": pending_count,
        "acknowledged": acknowledged_count,
        "resolved": resolved_count,
        "critical_active": critical_active,
        "warning_active": warning_active,
        "info_active": info_active,
        "last_24h_count": today_count,
        "by_alert_type": by_alert_type,
        "by_level": {
            "critical": critical_total,
            "warning": warning_total,
            "info": info_total,
        },
    }


@router.get("/alerts/{alert_id}")
def get_alert_detail(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="告警不存在")

    if current_user.role != "admin" and alert.assigned_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权查看此告警")

    sensor = db.query(Sensor).filter(Sensor.id == alert.sensor_id).first()
    showcase = db.query(Showcase).filter(Showcase.id == alert.showcase_id).first()

    recommendations = []
    if sensor:
        recommendations = intervention_engine.match_strategies_for_alert(db, alert, sensor)

    assigned_user_name = None
    if alert.assigned_user_id:
        user = db.query(User).filter(User.id == alert.assigned_user_id).first()
        assigned_user_name = user.real_name or user.username if user else None

    return {
        "alert": _alert_to_dict(alert, db),
        "sensor": sensor,
        "showcase": showcase,
        "recommendations": recommendations,
        "assigned_user_name": assigned_user_name,
    }


@router.post("/alerts", response_model=AlertSchema)
def create_alert(alert_data: AlertCreate, db: Session = Depends(get_db)):
    alert = Alert(**alert_data.dict())
    db.add(alert)
    db.commit()
    db.refresh(alert)

    _auto_assign_alert(db, alert)

    return _alert_to_dict(alert, db)


@router.put("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    operator: str = "系统管理员",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="告警不存在")

    if current_user.role != "admin" and alert.assigned_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权处理此告警")

    if alert.status not in ["pending"]:
        raise HTTPException(status_code=400, detail="告警状态不允许确认")

    old_status = alert.status
    alert.status = "acknowledged"
    alert.acknowledged_at = datetime.utcnow()
    operator_name = current_user.real_name or current_user.username
    alert.acknowledged_by = operator_name

    disposition = DispositionRecord(
        alert_id=alert.id,
        showcase_id=alert.showcase_id,
        operator=operator_name,
        action_type="acknowledge",
        details=f"确认告警: {alert.message}",
        before_status=old_status,
        after_status="acknowledged"
    )
    db.add(disposition)
    db.commit()
    db.refresh(alert)

    return {"message": "告警已确认", "alert": _alert_to_dict(alert, db)}


@router.put("/alerts/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    resolution_note: str,
    operator: str = "系统管理员",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="告警不存在")

    if current_user.role != "admin" and alert.assigned_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权处理此告警")

    if alert.status in ["resolved", "closed"]:
        raise HTTPException(status_code=400, detail="告警已关闭")

    old_status = alert.status
    alert.status = "resolved"
    alert.resolved_at = datetime.utcnow()
    operator_name = current_user.real_name or current_user.username
    alert.resolved_by = operator_name
    alert.resolution_note = resolution_note

    disposition = DispositionRecord(
        alert_id=alert.id,
        showcase_id=alert.showcase_id,
        operator=operator_name,
        action_type="resolve",
        details=f"处理完成: {resolution_note}",
        before_status=old_status,
        after_status="resolved"
    )
    db.add(disposition)
    db.commit()
    db.refresh(alert)

    return {"message": "告警已处理", "alert": _alert_to_dict(alert, db)}


@router.get("/alerts/{alert_id}/interventions/recommend")
def get_intervention_recommendations(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="告警不存在")

    if current_user.role != "admin" and alert.assigned_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权查看此告警")

    result = intervention_engine.generate_intervention_plan(db, alert_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
