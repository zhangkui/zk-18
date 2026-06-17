from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models import Intervention, InterventionStrategy, Showcase, Alert, DispositionRecord, User, strategy_user
from app.schemas import (
    Intervention as InterventionSchema,
    InterventionCreate,
    InterventionUpdate,
    InterventionStrategy as StrategySchema,
    InterventionStrategyCreate,
    InterventionStrategyUpdate,
)
from app.services.intervention_engine import intervention_engine
from app.auth import get_current_user

router = APIRouter()


def _intervention_to_dict(intervention: Intervention, db: Session) -> dict:
    result = {
        "id": intervention.id,
        "showcase_id": intervention.showcase_id,
        "alert_id": intervention.alert_id,
        "strategy_id": intervention.strategy_id,
        "action_type": intervention.action_type,
        "description": intervention.description,
        "operator": intervention.operator,
        "operator_id": intervention.operator_id,
        "status": intervention.status,
        "scheduled_at": intervention.scheduled_at,
        "started_at": intervention.started_at,
        "completed_at": intervention.completed_at,
        "result_note": intervention.result_note,
        "created_at": intervention.created_at,
        "updated_at": intervention.updated_at,
    }
    if intervention.operator_id:
        user = db.query(User).filter(User.id == intervention.operator_id).first()
        result["operator_name"] = user.real_name or user.username if user else intervention.operator
    else:
        result["operator_name"] = intervention.operator
    return result


def _strategy_to_dict(strategy: InterventionStrategy, db: Session) -> dict:
    assigned_users = db.query(User).join(
        strategy_user, User.id == strategy_user.c.user_id
    ).filter(strategy_user.c.strategy_id == strategy.id).all()

    result = {
        "id": strategy.id,
        "name": strategy.name,
        "code": strategy.code,
        "description": strategy.description,
        "trigger_condition": strategy.trigger_condition,
        "action_steps": strategy.action_steps,
        "applicable_sensor_types": strategy.applicable_sensor_types,
        "severity_level": strategy.severity_level,
        "estimated_duration": str(strategy.estimated_duration) if strategy.estimated_duration else None,
        "is_active": strategy.is_active,
        "sensor_type": strategy.sensor_type,
        "condition_type": strategy.condition_type,
        "threshold_value": strategy.threshold_value,
        "normal_value": strategy.normal_value,
        "duration_minutes": strategy.duration_minutes,
        "created_at": strategy.created_at,
        "updated_at": strategy.updated_at,
        "assigned_user_ids": [u.id for u in assigned_users],
        "assigned_user_names": [u.real_name or u.username for u in assigned_users],
    }
    return result


@router.get("/interventions")
def get_interventions(
    status: Optional[str] = None,
    showcase_id: Optional[int] = None,
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Intervention)

    if current_user.role != "admin":
        query = query.filter(Intervention.operator_id == current_user.id)

    if status:
        query = query.filter(Intervention.status == status)
    if showcase_id:
        query = query.filter(Intervention.showcase_id == showcase_id)

    interventions = query.order_by(Intervention.created_at.desc()).limit(limit).all()
    return [_intervention_to_dict(i, db) for i in interventions]


@router.get("/interventions/{intervention_id}")
def get_intervention_detail(
    intervention_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="干预任务不存在")

    if current_user.role != "admin" and intervention.operator_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权查看此干预任务")

    strategy = None
    if intervention.strategy_id:
        strategy = db.query(InterventionStrategy).filter(
            InterventionStrategy.id == intervention.strategy_id
        ).first()

    showcase = db.query(Showcase).filter(Showcase.id == intervention.showcase_id).first()
    alert = db.query(Alert).filter(Alert.id == intervention.alert_id).first() if intervention.alert_id else None

    return {
        "intervention": _intervention_to_dict(intervention, db),
        "strategy": _strategy_to_dict(strategy, db) if strategy else None,
        "showcase": showcase,
        "alert": alert
    }


@router.post("/interventions")
def create_intervention(
    intervention_data: InterventionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = intervention_data.dict()
    if data.get("operator_id"):
        user = db.query(User).filter(User.id == data["operator_id"]).first()
        if user:
            data["operator"] = user.real_name or user.username
    elif not data.get("operator"):
        data["operator_id"] = current_user.id
        data["operator"] = current_user.real_name or current_user.username

    intervention = Intervention(**data)
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

    return _intervention_to_dict(intervention, db)


@router.put("/interventions/{intervention_id}/start")
def start_intervention(
    intervention_id: int,
    operator: str = "系统管理员",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="干预任务不存在")

    if current_user.role != "admin" and intervention.operator_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作此干预任务")

    if intervention.status != "pending":
        raise HTTPException(status_code=400, detail="干预任务状态不允许开始")

    old_status = intervention.status
    intervention.status = "in_progress"
    intervention.started_at = datetime.utcnow()
    operator_name = current_user.real_name or current_user.username
    if not intervention.operator:
        intervention.operator = operator_name
        intervention.operator_id = current_user.id

    disposition = DispositionRecord(
        intervention_id=intervention.id,
        showcase_id=intervention.showcase_id,
        operator=operator_name,
        action_type="start_intervention",
        details=f"开始执行干预: {intervention.description}",
        before_status=old_status,
        after_status="in_progress"
    )
    db.add(disposition)
    db.commit()
    db.refresh(intervention)

    return {"message": "干预已开始", "intervention": _intervention_to_dict(intervention, db)}


@router.put("/interventions/{intervention_id}/complete")
def complete_intervention(
    intervention_id: int,
    result_note: str,
    operator: str = "系统管理员",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="干预任务不存在")

    if current_user.role != "admin" and intervention.operator_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作此干预任务")

    if intervention.status != "in_progress":
        raise HTTPException(status_code=400, detail="干预任务状态不允许完成")

    old_status = intervention.status
    intervention.status = "completed"
    intervention.completed_at = datetime.utcnow()
    intervention.result_note = result_note
    operator_name = current_user.real_name or current_user.username

    disposition = DispositionRecord(
        intervention_id=intervention.id,
        showcase_id=intervention.showcase_id,
        operator=operator_name,
        action_type="complete_intervention",
        details=f"干预完成: {result_note}",
        before_status=old_status,
        after_status="completed"
    )
    db.add(disposition)
    db.commit()
    db.refresh(intervention)

    return {"message": "干预已完成", "intervention": _intervention_to_dict(intervention, db)}


@router.get("/strategies")
def get_strategies(
    sensor_type: Optional[str] = None,
    severity_level: Optional[str] = None,
    is_active: Optional[bool] = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(InterventionStrategy)

    if sensor_type:
        query = query.filter(InterventionStrategy.applicable_sensor_types.any(sensor_type))
    if severity_level:
        query = query.filter(InterventionStrategy.severity_level == severity_level)
    if is_active is not None:
        query = query.filter(InterventionStrategy.is_active == is_active)

    strategies = query.all()
    return [_strategy_to_dict(s, db) for s in strategies]


@router.get("/strategies/{strategy_id}")
def get_strategy_detail(
    strategy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strategy = db.query(InterventionStrategy).filter(InterventionStrategy.id == strategy_id).first()
    if not strategy:
        raise HTTPException(status_code=404, detail="干预策略不存在")
    return _strategy_to_dict(strategy, db)


@router.get("/showcases/{showcase_id}/interventions/recommend")
def get_showcase_intervention_recommendations(
    showcase_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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


@router.post("/strategies")
def create_strategy(
    strategy_data: InterventionStrategyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(InterventionStrategy).filter(InterventionStrategy.code == strategy_data.code).first():
        raise HTTPException(status_code=400, detail="策略编号已存在")

    assigned_user_ids = strategy_data.dict().pop("assigned_user_ids", None) if "assigned_user_ids" in strategy_data.dict() else None
    data = strategy_data.dict(exclude={"assigned_user_ids"})
    strategy = InterventionStrategy(**data)
    db.add(strategy)
    db.commit()
    db.refresh(strategy)

    if assigned_user_ids:
        users = db.query(User).filter(User.id.in_(assigned_user_ids)).all()
        strategy.assigned_users = users
        db.commit()

    return _strategy_to_dict(strategy, db)


@router.put("/strategies/{strategy_id}")
def update_strategy(
    strategy_id: int,
    strategy_data: InterventionStrategyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strategy = db.query(InterventionStrategy).filter(InterventionStrategy.id == strategy_id).first()
    if not strategy:
        raise HTTPException(status_code=404, detail="干预策略不存在")
    update_dict = strategy_data.dict(exclude_unset=True)

    assigned_user_ids = update_dict.pop("assigned_user_ids", None)

    if "code" in update_dict and update_dict["code"] != strategy.code:
        if db.query(InterventionStrategy).filter(InterventionStrategy.code == update_dict["code"]).first():
            raise HTTPException(status_code=400, detail="策略编号已存在")
    for key, value in update_dict.items():
        setattr(strategy, key, value)
    strategy.updated_at = datetime.utcnow()

    if assigned_user_ids is not None:
        users = db.query(User).filter(User.id.in_(assigned_user_ids)).all()
        strategy.assigned_users = users

    db.commit()
    db.refresh(strategy)
    return _strategy_to_dict(strategy, db)


@router.put("/strategies/{strategy_id}/disable")
def disable_strategy(
    strategy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strategy = db.query(InterventionStrategy).filter(InterventionStrategy.id == strategy_id).first()
    if not strategy:
        raise HTTPException(status_code=404, detail="干预策略不存在")
    strategy.is_active = False
    strategy.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "策略已停用"}


@router.put("/strategies/{strategy_id}/enable")
def enable_strategy(
    strategy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strategy = db.query(InterventionStrategy).filter(InterventionStrategy.id == strategy_id).first()
    if not strategy:
        raise HTTPException(status_code=404, detail="干预策略不存在")
    strategy.is_active = True
    strategy.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "策略已启用"}


@router.delete("/strategies/{strategy_id}")
def delete_strategy(
    strategy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strategy = db.query(InterventionStrategy).filter(InterventionStrategy.id == strategy_id).first()
    if not strategy:
        raise HTTPException(status_code=404, detail="干预策略不存在")
    db.delete(strategy)
    db.commit()
    return {"message": "策略已删除"}
