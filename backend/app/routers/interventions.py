from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models import Intervention, InterventionStrategy, Showcase, Alert, DispositionRecord
from app.schemas import (
    Intervention as InterventionSchema,
    InterventionCreate,
    InterventionUpdate,
    InterventionStrategy as StrategySchema
)
from app.services.intervention_engine import intervention_engine

router = APIRouter()


@router.get("/interventions", response_model=List[InterventionSchema])
def get_interventions(
    status: Optional[str] = None,
    showcase_id: Optional[int] = None,
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Intervention)

    if status:
        query = query.filter(Intervention.status == status)
    if showcase_id:
        query = query.filter(Intervention.showcase_id == showcase_id)

    interventions = query.order_by(Intervention.created_at.desc()).limit(limit).all()
    return interventions


@router.get("/interventions/{intervention_id}")
def get_intervention_detail(intervention_id: int, db: Session = Depends(get_db)):
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="干预任务不存在")

    strategy = None
    if intervention.strategy_id:
        strategy = db.query(InterventionStrategy).filter(
            InterventionStrategy.id == intervention.strategy_id
        ).first()

    showcase = db.query(Showcase).filter(Showcase.id == intervention.showcase_id).first()
    alert = db.query(Alert).filter(Alert.id == intervention.alert_id).first() if intervention.alert_id else None

    return {
        "intervention": intervention,
        "strategy": strategy,
        "showcase": showcase,
        "alert": alert
    }


@router.post("/interventions", response_model=InterventionSchema)
def create_intervention(intervention_data: InterventionCreate, db: Session = Depends(get_db)):
    intervention = Intervention(**intervention_data.dict())
    db.add(intervention)
    db.commit()
    db.refresh(intervention)

    if intervention.showcase_id:
        disposition = DispositionRecord(
            intervention_id=intervention.id,
            showcase_id=intervention.showcase_id,
            operator=intervention.operator or "系统",
            action_type="create_intervention",
            details=f"创建干预任务: {intervention.description}",
            before_status="none",
            after_status=intervention.status
        )
        db.add(disposition)
        db.commit()

    return intervention


@router.put("/interventions/{intervention_id}/start")
def start_intervention(
    intervention_id: int,
    operator: str = "系统管理员",
    db: Session = Depends(get_db)
):
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="干预任务不存在")

    if intervention.status != "pending":
        raise HTTPException(status_code=400, detail="干预任务状态不允许开始")

    old_status = intervention.status
    intervention.status = "in_progress"
    intervention.started_at = datetime.utcnow()
    if not intervention.operator:
        intervention.operator = operator

    disposition = DispositionRecord(
        intervention_id=intervention.id,
        showcase_id=intervention.showcase_id,
        operator=operator,
        action_type="start_intervention",
        details=f"开始执行干预: {intervention.description}",
        before_status=old_status,
        after_status="in_progress"
    )
    db.add(disposition)
    db.commit()
    db.refresh(intervention)

    return {"message": "干预已开始", "intervention": intervention}


@router.put("/interventions/{intervention_id}/complete")
def complete_intervention(
    intervention_id: int,
    result_note: str,
    operator: str = "系统管理员",
    db: Session = Depends(get_db)
):
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="干预任务不存在")

    if intervention.status != "in_progress":
        raise HTTPException(status_code=400, detail="干预任务状态不允许完成")

    old_status = intervention.status
    intervention.status = "completed"
    intervention.completed_at = datetime.utcnow()
    intervention.result_note = result_note

    disposition = DispositionRecord(
        intervention_id=intervention.id,
        showcase_id=intervention.showcase_id,
        operator=operator,
        action_type="complete_intervention",
        details=f"干预完成: {result_note}",
        before_status=old_status,
        after_status="completed"
    )
    db.add(disposition)
    db.commit()
    db.refresh(intervention)

    return {"message": "干预已完成", "intervention": intervention}


@router.get("/strategies", response_model=List[StrategySchema])
def get_strategies(
    sensor_type: Optional[str] = None,
    severity_level: Optional[str] = None,
    is_active: Optional[bool] = True,
    db: Session = Depends(get_db)
):
    query = db.query(InterventionStrategy)

    if sensor_type:
        query = query.filter(InterventionStrategy.applicable_sensor_types.any(sensor_type))
    if severity_level:
        query = query.filter(InterventionStrategy.severity_level == severity_level)
    if is_active is not None:
        query = query.filter(InterventionStrategy.is_active == is_active)

    strategies = query.all()
    return strategies


@router.get("/strategies/{strategy_id}", response_model=StrategySchema)
def get_strategy_detail(strategy_id: int, db: Session = Depends(get_db)):
    strategy = db.query(InterventionStrategy).filter(InterventionStrategy.id == strategy_id).first()
    if not strategy:
        raise HTTPException(status_code=404, detail="干预策略不存在")
    return strategy


@router.get("/showcases/{showcase_id}/interventions/recommend")
def get_showcase_intervention_recommendations(showcase_id: int, db: Session = Depends(get_db)):
    showcase = db.query(Showcase).filter(Showcase.id == showcase_id).first()
    if not showcase:
        raise HTTPException(status_code=404, detail="展柜不存在")

    preventive_strategies = intervention_engine.get_preventive_strategies(db, showcase_id)

    active_alerts = db.query(Alert).filter(
        Alert.showcase_id == showcase_id,
        Alert.status.in_(["pending", "acknowledged"])
    ).all()

    alert_recommendations = []
    for alert in active_alerts:
        from app.models import Sensor
        sensor = db.query(Sensor).filter(Sensor.id == alert.sensor_id).first()
        if sensor:
            recs = intervention_engine.match_strategies_for_alert(db, alert, sensor)
            alert_recommendations.append({
                "alert_id": alert.id,
                "alert_message": alert.message,
                "recommendations": recs
            })

    return {
        "showcase_id": showcase_id,
        "showcase_name": showcase.name,
        "preventive_strategies": preventive_strategies,
        "alert_based_recommendations": alert_recommendations
    }
