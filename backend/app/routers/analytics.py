from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date, timedelta
from app.database import get_db
from app.models import DispositionRecord, Showcase, Alert, Intervention, User
from app.schemas import DispositionRecord as DispositionSchema, DispositionRecordCreate
from app.services.profiler import trend_analyzer
from app.auth import get_current_user

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
def create_disposition(disposition_data: DispositionRecordCreate, db: Session = Depends(get_db)):
    disposition = DispositionRecord(**disposition_data.dict())
    db.add(disposition)
    db.commit()
    db.refresh(disposition)
    return disposition


@router.get("/dispositions/{disposition_id}", response_model=DispositionSchema)
def get_disposition_detail(disposition_id: int, db: Session = Depends(get_db)):
    disposition = db.query(DispositionRecord).filter(DispositionRecord.id == disposition_id).first()
    if not disposition:
        raise HTTPException(status_code=404, detail="处置记录不存在")
    return disposition


@router.get("/showcases/{showcase_id}/dispositions")
def get_showcase_dispositions(
    showcase_id: int,
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db)
):
    showcase = db.query(Showcase).filter(Showcase.id == showcase_id).first()
    if not showcase:
        raise HTTPException(status_code=404, detail="展柜不存在")

    dispositions = db.query(DispositionRecord).filter(
        DispositionRecord.showcase_id == showcase_id
    ).order_by(DispositionRecord.created_at.desc()).limit(limit).all()

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
    db: Session = Depends(get_db)
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
    db: Session = Depends(get_db)
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
    db: Session = Depends(get_db)
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
