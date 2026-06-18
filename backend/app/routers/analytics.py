from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date, timedelta
from app.database import get_db
from app.models import DispositionRecord, Showcase, Alert, Intervention, User, Sensor, SensorReading, TrendAnalysis
from app.schemas import DispositionRecord as DispositionSchema, DispositionRecordCreate
from app.services.profiler import trend_analyzer
from app.auth import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/dispositions", response_model=List[DispositionSchema])
def get_dispositions(
    showcase_id: Optional[int] = None,
    alert_id: Optional[int] = None,
    action_type: Optional[str] = None,
    operator: Optional[str] = None,
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(DispositionRecord)

    if current_user.role != "admin":
        operator_name = current_user.real_name or current_user.username
        query = query.filter(DispositionRecord.operator == operator_name)

    if showcase_id:
        query = query.filter(DispositionRecord.showcase_id == showcase_id)
    if alert_id:
        query = query.filter(DispositionRecord.alert_id == alert_id)
    if action_type:
        query = query.filter(DispositionRecord.action_type == action_type)
    if operator:
        query = query.filter(DispositionRecord.operator == operator)

    dispositions = query.order_by(DispositionRecord.created_at.desc()).limit(limit).all()
    return dispositions


@router.post("/dispositions", response_model=DispositionSchema)
def create_disposition(
    disposition_data: DispositionRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    disposition_dict = disposition_data.dict()
    if "operator" not in disposition_dict or not disposition_dict["operator"]:
        disposition_dict["operator"] = current_user.real_name or current_user.username
    disposition = DispositionRecord(**disposition_dict)
    db.add(disposition)
    db.commit()
    db.refresh(disposition)
    return disposition


@router.get("/dispositions/{disposition_id}", response_model=DispositionSchema)
def get_disposition_detail(
    disposition_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(DispositionRecord).filter(DispositionRecord.id == disposition_id)
    if current_user.role != "admin":
        operator_name = current_user.real_name or current_user.username
        query = query.filter(DispositionRecord.operator == operator_name)
    disposition = query.first()
    if not disposition:
        raise HTTPException(status_code=404, detail="处置记录不存在")
    return disposition


@router.get("/showcases/{showcase_id}/dispositions")
def get_showcase_dispositions(
    showcase_id: int,
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    showcase = db.query(Showcase).filter(Showcase.id == showcase_id).first()
    if not showcase:
        raise HTTPException(status_code=404, detail="展柜不存在")

    query = db.query(DispositionRecord).filter(
        DispositionRecord.showcase_id == showcase_id
    )
    if current_user.role != "admin":
        operator_name = current_user.real_name or current_user.username
        query = query.filter(DispositionRecord.operator == operator_name)

    dispositions = query.order_by(DispositionRecord.created_at.desc()).limit(limit).all()

    return {
        "showcase_id": showcase_id,
        "showcase_name": showcase.name,
        "total_count": len(dispositions),
        "dispositions": dispositions
    }


@router.get("/trends/showcases/{showcase_id}")
def get_showcase_trends(
    showcase_id: int,
    sensor_type: Optional[str] = None,
    period: Optional[str] = None,
    limit: int = Query(10, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    showcase = db.query(Showcase).filter(Showcase.id == showcase_id).first()
    if not showcase:
        raise HTTPException(status_code=404, detail="展柜不存在")

    trends = trend_analyzer.get_historical_trends(
        db, showcase_id, sensor_type, period, limit
    )

    return {
        "showcase_id": showcase_id,
        "showcase_name": showcase.name,
        "trends": trends
    }


@router.post("/trends/analyze")
def analyze_trend(
    showcase_id: int,
    sensor_type: str,
    start_date: date,
    end_date: date,
    period: str = "monthly",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    showcase = db.query(Showcase).filter(Showcase.id == showcase_id).first()
    if not showcase:
        raise HTTPException(status_code=404, detail="展柜不存在")

    result = trend_analyzer.analyze_period_trend(
        db, showcase_id, sensor_type, start_date, end_date, period
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.get("/trends/summary")
def get_trends_summary(
    showcase_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models import TrendAnalysis
    from sqlalchemy import func

    query = db.query(TrendAnalysis)
    if showcase_id:
        query = query.filter(TrendAnalysis.showcase_id == showcase_id)

    total_analyses = query.count()

    rising_count = query.filter(TrendAnalysis.trend_direction == "rising").count()
    falling_count = query.filter(TrendAnalysis.trend_direction == "falling").count()
    stable_count = query.filter(TrendAnalysis.trend_direction == "stable").count()

    high_volatility = query.filter(TrendAnalysis.volatility > 0.1).count()

    sensor_types = ["temperature", "humidity", "light", "vibration"]
    by_sensor_type = {}
    for st in sensor_types:
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


@router.get("/dispositions/summary")
def get_dispositions_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import func

    query = db.query(DispositionRecord)
    if current_user.role != "admin":
        operator_name = current_user.real_name or current_user.username
        query = query.filter(DispositionRecord.operator == operator_name)

    last_7_days = datetime.utcnow() - timedelta(days=7)
    last_30_days = datetime.utcnow() - timedelta(days=30)

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

    return {
        "total_count": total_count,
        "last_7_days_count": last_7d_count,
        "last_30_days_count": last_30d_count,
        "by_action_type": {at: cnt for at, cnt in action_types},
        "top_operators": [{"operator": op, "count": cnt} for op, cnt in operators]
    }


@router.post("/trends/auto-generate")
def auto_generate_trends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    showcases = db.query(Showcase).all()
    if not showcases:
        raise HTTPException(status_code=400, detail="没有可用的展柜数据")

    sensor_types = ["temperature", "humidity", "light", "vibration"]
    generated = 0
    errors = []

    for showcase in showcases:
        for sensor_type in sensor_types:
            sensors = db.query(Sensor).filter(
                Sensor.showcase_id == showcase.id,
                Sensor.sensor_type == sensor_type,
                Sensor.status == "active"
            ).all()

            if not sensors:
                continue

            sensor_ids = [s.id for s in sensors]
            latest_reading = db.query(SensorReading).filter(
                SensorReading.sensor_id.in_(sensor_ids)
            ).order_by(SensorReading.time.desc()).first()

            if not latest_reading:
                continue

            end_date = latest_reading.time.date()
            start_date = end_date - timedelta(days=30)

            readings = db.query(SensorReading).filter(
                SensorReading.sensor_id.in_(sensor_ids),
                SensorReading.time >= datetime.combine(start_date, datetime.min.time()),
                SensorReading.time <= datetime.combine(end_date, datetime.max.time())
            ).all()

            if len(readings) < 5:
                continue

            try:
                result = trend_analyzer.analyze_period_trend(
                    db, showcase.id, sensor_type, start_date, end_date, "monthly"
                )
                if "error" not in result:
                    generated += 1
            except Exception as e:
                errors.append(f"展柜{showcase.id}-{sensor_type}: {str(e)}")

            periods = [
                (end_date - timedelta(days=30), end_date - timedelta(days=21), "weekly"),
                (end_date - timedelta(days=21), end_date - timedelta(days=14), "weekly"),
                (end_date - timedelta(days=14), end_date - timedelta(days=7), "weekly"),
                (end_date - timedelta(days=7), end_date, "weekly"),
            ]
            for p_start, p_end, p_type in periods:
                if p_start >= p_end:
                    continue
                p_readings = db.query(SensorReading).filter(
                    SensorReading.sensor_id.in_(sensor_ids),
                    SensorReading.time >= datetime.combine(p_start, datetime.min.time()),
                    SensorReading.time <= datetime.combine(p_end, datetime.max.time())
                ).all()

                if len(p_readings) < 3:
                    continue

                try:
                    result = trend_analyzer.analyze_period_trend(
                        db, showcase.id, sensor_type, p_start, p_end, p_type
                    )
                    if "error" not in result:
                        generated += 1
                except Exception as e:
                    errors.append(f"展柜{showcase.id}-{sensor_type}({p_type}): {str(e)}")

    return {
        "message": f"自动生成完成，共生成 {generated} 条趋势分析记录",
        "generated_count": generated,
        "errors": errors
    }


@router.post("/dispositions/auto-generate")
def auto_generate_dispositions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alerts = db.query(Alert).order_by(Alert.triggered_at.desc()).all()
    if not alerts:
        raise HTTPException(status_code=400, detail="没有可用的告警数据")

    generated = 0
    current_operator = current_user.real_name or current_user.username

    for alert in alerts:
        existing = db.query(DispositionRecord).filter(
            DispositionRecord.alert_id == alert.id
        ).first()
        if existing:
            continue

        operator_name = current_operator

        ack_time = alert.triggered_at + timedelta(minutes=random_int(1, 60))
        resolve_time = ack_time + timedelta(minutes=random_int(10, 180))

        disposition = DispositionRecord(
            alert_id=alert.id,
            showcase_id=alert.showcase_id,
            operator=operator_name,
            action_type="acknowledge",
            details=f"确认告警: {alert.message}",
            before_status="pending",
            after_status="acknowledged",
            created_at=ack_time
        )
        db.add(disposition)
        generated += 1

        resolve_note = random_resolve_note(alert.alert_type)
        disposition2 = DispositionRecord(
            alert_id=alert.id,
            showcase_id=alert.showcase_id,
            operator=operator_name,
            action_type="resolve",
            details=f"处理完成: {resolve_note}",
            before_status="acknowledged",
            after_status="resolved",
            created_at=resolve_time
        )
        db.add(disposition2)
        generated += 1

        if alert.status in ["pending", "acknowledged"]:
            alert.status = "resolved"
            alert.acknowledged_at = ack_time
            alert.acknowledged_by = operator_name
            alert.resolved_at = resolve_time
            alert.resolved_by = operator_name
            alert.resolution_note = resolve_note

    db.commit()

    return {
        "message": f"自动生成完成，共生成 {generated} 条处置记录",
        "generated_count": generated,
        "operator": current_operator
    }


def random_int(min_val: int, max_val: int) -> int:
    import random
    return random.randint(min_val, max_val)


def random_resolve_note(alert_type: str) -> str:
    notes = {
        "over_max": "已调整环境控制系统降低参数，恢复正常范围",
        "below_min": "已启动补充系统提升参数，恢复正常范围",
        "warning_high": "已进行预防性调整，参数趋于稳定",
        "statistical_outlier": "经核实为传感器短暂波动，已校准",
        "rapid_change": "已排查外部干扰因素，环境已稳定",
        "high_volatility": "已优化控制参数，波动降低",
        "ma_deviation": "已进行微调，数据回归正常水平",
    }
    import random
    return notes.get(alert_type, random.choice([
        "已处理完成，环境恢复正常",
        "经排查为误报，已确认无异常",
        "已采取干预措施，参数恢复正常",
    ]))
