from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta, date
from sqlalchemy import func, Date as SqlDate
from app.database import get_db
from app.models import (
    MonitorShareLink, User, Showcase, Sensor, Alert, Intervention,
    ShowcaseProfile, DispositionRecord, TrendAnalysis, SensorReading
)
from app.schemas import (
    MonitorShareLinkCreate, MonitorShareLink as MonitorShareLinkSchema,
    MonitorShareLinkValidateResponse, DashboardStats
)
from app.auth import get_current_user
import secrets
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


def _validate_share_token(db: Session, token: str) -> MonitorShareLink:
    link = db.query(MonitorShareLink).filter(
        MonitorShareLink.token == token
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="分享链接不存在")
    if link.is_revoked:
        raise HTTPException(status_code=403, detail="分享链接已被撤销")
    now = datetime.utcnow()
    if now > link.expires_at:
        raise HTTPException(status_code=403, detail="分享链接已过期")
    link.last_accessed_at = now
    link.access_count = (link.access_count or 0) + 1
    db.commit()
    db.refresh(link)
    return link


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


def _build_dashboard_stats(db: Session) -> DashboardStats:
    total_showcases = db.query(func.count(Showcase.id)).scalar() or 0
    online_showcases = db.query(func.count(Showcase.id)).filter(
        Showcase.status == "active"
    ).scalar() or 0
    active_sensors = db.query(func.count(Sensor.id)).filter(
        Sensor.status == "active"
    ).scalar() or 0
    active_alerts = db.query(func.count(Alert.id)).filter(
        Alert.status.in_(["pending", "acknowledged"])
    ).scalar() or 0
    pending_interventions = db.query(func.count(Intervention.id)).filter(
        Intervention.status == "pending"
    ).scalar() or 0
    high_risk_showcases = db.query(func.count(ShowcaseProfile.id)).filter(
        ShowcaseProfile.risk_level == "high"
    ).scalar() or 0

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


def _build_alert_summary(db: Session) -> dict:
    query = db.query(Alert)
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
    last_24h_count = query.filter(Alert.triggered_at >= last_24h).count()

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
        "last_24h_count": last_24h_count,
        "by_alert_type": by_alert_type,
        "by_level": {
            "critical": critical_total,
            "warning": warning_total,
            "info": info_total,
        },
    }


def _build_dispositions_summary(db: Session) -> dict:
    query = db.query(DispositionRecord)
    now = datetime.utcnow()
    last_7_days = now - timedelta(days=7)
    last_30_days = now - timedelta(days=30)

    total_count = query.count()
    last_7d_count = query.filter(
        DispositionRecord.created_at >= last_7_days
    ).count()
    last_30d_count = query.filter(
        DispositionRecord.created_at >= last_30_days
    ).count()

    action_types = query.with_entities(
        DispositionRecord.action_type,
        func.count(DispositionRecord.id)
    ).group_by(DispositionRecord.action_type).all()

    operators = query.with_entities(
        DispositionRecord.operator,
        func.count(DispositionRecord.id)
    ).group_by(DispositionRecord.operator).order_by(
        func.count(DispositionRecord.id).desc()
    ).limit(10).all()

    last_7_days_trend_raw = query.with_entities(
        func.cast(DispositionRecord.created_at, SqlDate).label("day"),
        func.count(DispositionRecord.id)
    ).filter(
        DispositionRecord.created_at >= last_7_days
    ).group_by(
        func.cast(DispositionRecord.created_at, SqlDate)
    ).all()

    trend_map = {str(d): int(c) for d, c in last_7_days_trend_raw}
    last_7_days_trend = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).date()
        day_str = str(day)
        label = day.strftime("%m-%d")
        last_7_days_trend.append({
            "date": label,
            "count": trend_map.get(day_str, 0)
        })

    return {
        "total_count": total_count,
        "last_7_days_count": last_7d_count,
        "last_30_days_count": last_30d_count,
        "by_action_type": {at: cnt for at, cnt in action_types},
        "top_operators": [{"operator": op, "count": cnt} for op, cnt in operators],
        "last_7_days_trend": last_7_days_trend,
    }


def _build_trends_summary(db: Session, showcase_id: Optional[int] = None) -> dict:
    query = db.query(TrendAnalysis)
    if showcase_id:
        query = query.filter(TrendAnalysis.showcase_id == showcase_id)

    total_analyses = query.count()
    rising_count = query.filter(TrendAnalysis.trend_direction == "rising").count()
    falling_count = query.filter(TrendAnalysis.trend_direction == "falling").count()
    stable_count = query.filter(TrendAnalysis.trend_direction == "stable").count()
    high_volatility = query.filter(TrendAnalysis.volatility > 0.1).count()

    sensor_types_list = ["temperature", "humidity", "light", "vibration"]
    by_sensor_type = {}
    for st in sensor_types_list:
        st_trends = db.query(TrendAnalysis).filter(TrendAnalysis.sensor_type == st)
        if showcase_id:
            st_trends = st_trends.filter(TrendAnalysis.showcase_id == showcase_id)

        avg_volatility = st_trends.with_entities(
            func.avg(TrendAnalysis.volatility)
        ).scalar() or 0

        avg_anomalies = st_trends.with_entities(
            func.avg(TrendAnalysis.anomaly_count)
        ).scalar() or 0

        by_sensor_type[st] = {
            "count": st_trends.count(),
            "avg_volatility": float(avg_volatility),
            "avg_anomaly_count": float(avg_anomalies)
        }

    return {
        "total_analyses": total_analyses,
        "rising": rising_count,
        "falling": falling_count,
        "stable": stable_count,
        "high_volatility_count": high_volatility,
        "by_sensor_type": by_sensor_type
    }


def _get_showcases_list(db: Session) -> list:
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


@router.post("/shares", response_model=MonitorShareLinkSchema)
def create_share_link(
    data: MonitorShareLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    token = _generate_token()
    now = datetime.utcnow()
    expires_at = now + timedelta(minutes=data.duration_minutes)

    link = MonitorShareLink(
        token=token,
        created_by=current_user.id,
        duration_minutes=data.duration_minutes,
        created_at=now,
        expires_at=expires_at,
        access_count=0,
        is_revoked=False,
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    creator_name = current_user.real_name or current_user.username

    return MonitorShareLinkSchema(
        id=link.id,
        token=link.token,
        created_by=link.created_by,
        created_by_name=creator_name,
        duration_minutes=link.duration_minutes,
        created_at=link.created_at,
        expires_at=link.expires_at,
        last_accessed_at=link.last_accessed_at,
        access_count=link.access_count or 0,
        is_revoked=link.is_revoked or False,
    )


@router.get("/shares/{token}/validate", response_model=MonitorShareLinkValidateResponse)
def validate_share_link(
    token: str,
    db: Session = Depends(get_db),
):
    link = db.query(MonitorShareLink).filter(
        MonitorShareLink.token == token
    ).first()
    if not link:
        return MonitorShareLinkValidateResponse(
            valid=False,
            message="分享链接不存在"
        )
    if link.is_revoked:
        return MonitorShareLinkValidateResponse(
            valid=False,
            message="分享链接已被撤销"
        )
    now = datetime.utcnow()
    if now > link.expires_at:
        return MonitorShareLinkValidateResponse(
            valid=False,
            message="分享链接已过期"
        )
    remaining = int((link.expires_at - now).total_seconds() / 60)
    return MonitorShareLinkValidateResponse(
        valid=True,
        message="链接有效",
        expires_at=link.expires_at,
        remaining_minutes=max(remaining, 0),
    )


@router.get("/shares/{token}/dashboard")
def get_monitor_dashboard_via_share(
    token: str,
    db: Session = Depends(get_db),
):
    _validate_share_token(db, token)
    stats = _build_dashboard_stats(db)
    alerts = db.query(Alert).filter(
        Alert.status == "pending"
    ).order_by(Alert.triggered_at.desc()).limit(20).all()
    alert_list = [_alert_to_dict(a, db) for a in alerts]
    showcases = _get_showcases_list(db)
    alert_summary = _build_alert_summary(db)
    dispositions_summary = _build_dispositions_summary(db)
    trends_summary = _build_trends_summary(db)

    return {
        "stats": stats.model_dump(),
        "alerts": alert_list,
        "showcases": showcases,
        "alert_summary": alert_summary,
        "dispositions_summary": dispositions_summary,
        "trends_summary": trends_summary,
    }


@router.get("/shares", response_model=list[MonitorShareLinkSchema])
def list_share_links(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(MonitorShareLink)
    if current_user.role != "admin":
        query = query.filter(MonitorShareLink.created_by == current_user.id)
    links = query.order_by(MonitorShareLink.created_at.desc()).all()
    result = []
    for link in links:
        creator = db.query(User).filter(User.id == link.created_by).first()
        creator_name = creator.real_name or creator.username if creator else None
        result.append(MonitorShareLinkSchema(
            id=link.id,
            token=link.token,
            created_by=link.created_by,
            created_by_name=creator_name,
            duration_minutes=link.duration_minutes,
            created_at=link.created_at,
            expires_at=link.expires_at,
            last_accessed_at=link.last_accessed_at,
            access_count=link.access_count or 0,
            is_revoked=link.is_revoked or False,
        ))
    return result


@router.put("/shares/{token}/revoke", response_model=MonitorShareLinkSchema)
def revoke_share_link(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    link = db.query(MonitorShareLink).filter(
        MonitorShareLink.token == token
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="分享链接不存在")
    if current_user.role != "admin" and link.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="无权撤销此分享链接")
    link.is_revoked = True
    db.commit()
    db.refresh(link)
    creator = db.query(User).filter(User.id == link.created_by).first()
    creator_name = creator.real_name or creator.username if creator else None
    return MonitorShareLinkSchema(
        id=link.id,
        token=link.token,
        created_by=link.created_by,
        created_by_name=creator_name,
        duration_minutes=link.duration_minutes,
        created_at=link.created_at,
        expires_at=link.expires_at,
        last_accessed_at=link.last_accessed_at,
        access_count=link.access_count or 0,
        is_revoked=link.is_revoked or False,
    )
