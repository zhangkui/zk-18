from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models import InterventionStrategy, Alert, Showcase, Sensor, User, Intervention, DispositionRecord, strategy_user
import json
import logging

logger = logging.getLogger(__name__)


class InterventionEngine:
    @staticmethod
    def get_strategies_by_sensor_type(db: Session, sensor_type: str,
                                      severity_level: Optional[str] = None) -> List[InterventionStrategy]:
        query = db.query(InterventionStrategy).filter(
            InterventionStrategy.is_active == True,
            InterventionStrategy.applicable_sensor_types.any(sensor_type)
        )
        if severity_level:
            query = query.filter(InterventionStrategy.severity_level == severity_level)
        return query.all()

    @staticmethod
    def get_round_robin_user(db: Session, strategy: InterventionStrategy) -> Optional[User]:
        assigned_users = db.query(User).join(
            strategy_user, User.id == strategy_user.c.user_id
        ).filter(
            strategy_user.c.strategy_id == strategy.id,
            User.status == "active"
        ).all()

        if not assigned_users:
            return None

        if strategy.last_assigned_user_id is None:
            next_user = assigned_users[0]
        else:
            current_idx = -1
            for i, u in enumerate(assigned_users):
                if u.id == strategy.last_assigned_user_id:
                    current_idx = i
                    break
            next_idx = (current_idx + 1) % len(assigned_users)
            next_user = assigned_users[next_idx]

        strategy.last_assigned_user_id = next_user.id
        db.commit()
        return next_user

    @staticmethod
    def auto_create_intervention_from_strategy(
        db: Session, strategy: InterventionStrategy, alert: Alert, sensor: Sensor
    ) -> Optional[Intervention]:
        assigned_user = InterventionEngine.get_round_robin_user(db, strategy)
        operator_name = None
        operator_id = None
        if assigned_user:
            operator_name = assigned_user.real_name or assigned_user.username
            operator_id = assigned_user.id

        intervention = Intervention(
            showcase_id=alert.showcase_id,
            alert_id=alert.id,
            strategy_id=strategy.id,
            action_type=strategy.severity_level or "medium",
            description=f"自动干预: 策略[{strategy.name}] - {alert.message}",
            operator=operator_name or "系统自动",
            operator_id=operator_id,
            status="pending",
        )
        db.add(intervention)
        db.commit()
        db.refresh(intervention)

        if intervention.showcase_id:
            disposition = DispositionRecord(
                intervention_id=intervention.id,
                alert_id=alert.id,
                showcase_id=intervention.showcase_id,
                operator=operator_name or "系统自动",
                action_type="create_intervention",
                details=f"策略自动创建干预: {intervention.description}",
                before_status="none",
                after_status="pending"
            )
            db.add(disposition)
            db.commit()

        logger.info(
            f"Auto-created intervention {intervention.id} from strategy {strategy.name}, "
            f"assigned to user {operator_name}"
        )
        return intervention

    @staticmethod
    def match_strategies_for_alert(db: Session, alert: Alert, sensor: Sensor) -> List[Dict[str, Any]]:
        recommendations = []

        strategies = db.query(InterventionStrategy).filter(
            InterventionStrategy.is_active == True,
            InterventionStrategy.applicable_sensor_types.any(sensor.sensor_type)
        ).all()

        for strategy in strategies:
            confidence = 0.0
            match_reasons = []

            if alert.level == strategy.severity_level:
                confidence += 0.4
                match_reasons.append("告警级别匹配")
            elif alert.level == "critical" and strategy.severity_level == "high":
                confidence += 0.3
                match_reasons.append("严重告警匹配高级策略")
            elif alert.level == "warning" and strategy.severity_level == "medium":
                confidence += 0.3
                match_reasons.append("警告告警匹配中级策略")

            if "超过" in alert.message or "高于" in alert.message or "over" in (alert.alert_type or "").lower():
                if "高" in strategy.name or "HIGH" in strategy.code.upper():
                    confidence += 0.3
                    match_reasons.append("异常类型匹配(偏高)")

            if "低于" in alert.message or "不足" in alert.message or "low" in (alert.alert_type or "").lower():
                if "低" in strategy.name or "LOW" in strategy.code.upper():
                    confidence += 0.3
                    match_reasons.append("异常类型匹配(偏低)")

            if "温度" in alert.message or "temperature" in (alert.alert_type or "").lower():
                if "温度" in strategy.name or "TEMP" in strategy.code.upper():
                    confidence += 0.2
                    match_reasons.append("温度相关策略")

            if "湿度" in alert.message or "humidity" in (alert.alert_type or "").lower():
                if "湿度" in strategy.name or "HUM" in strategy.code.upper():
                    confidence += 0.2
                    match_reasons.append("湿度相关策略")

            if "光照" in alert.message or "light" in (alert.alert_type or "").lower():
                if "光照" in strategy.name or "LIGHT" in strategy.code.upper():
                    confidence += 0.2
                    match_reasons.append("光照相关策略")

            if "震动" in alert.message or "vibration" in (alert.alert_type or "").lower():
                if "震动" in strategy.name or "VIBRATION" in strategy.code.upper():
                    confidence += 0.2
                    match_reasons.append("震动相关策略")

            if strategy.sensor_type and strategy.sensor_type == sensor.sensor_type:
                confidence += 0.3
                match_reasons.append("传感器类型匹配")

            action_steps = []
            if strategy.action_steps:
                try:
                    action_steps = json.loads(strategy.action_steps)
                except (json.JSONDecodeError, TypeError):
                    action_steps = [strategy.action_steps]

            if confidence > 0:
                assigned_users = db.query(User).join(
                    strategy_user, User.id == strategy_user.c.user_id
                ).filter(strategy_user.c.strategy_id == strategy.id).all()

                recommendations.append({
                    "strategy_id": strategy.id,
                    "strategy_name": strategy.name,
                    "strategy_code": strategy.code,
                    "action_type": strategy.severity_level,
                    "description": strategy.description,
                    "severity_level": strategy.severity_level,
                    "estimated_duration": str(strategy.estimated_duration) if strategy.estimated_duration else None,
                    "action_steps": action_steps,
                    "confidence": min(confidence, 1.0),
                    "match_reasons": match_reasons,
                    "sensor_type": strategy.sensor_type,
                    "condition_type": strategy.condition_type,
                    "threshold_value": strategy.threshold_value,
                    "normal_value": strategy.normal_value,
                    "duration_minutes": strategy.duration_minutes,
                    "assigned_user_ids": [u.id for u in assigned_users],
                    "assigned_user_names": [u.real_name or u.username for u in assigned_users],
                })

        recommendations.sort(key=lambda x: x["confidence"], reverse=True)
        return recommendations

    @staticmethod
    def get_preventive_strategies(db: Session, showcase_id: int) -> List[Dict[str, Any]]:
        showcase = db.query(Showcase).filter(Showcase.id == showcase_id).first()
        if not showcase:
            return []

        strategies = db.query(InterventionStrategy).filter(
            InterventionStrategy.is_active == True,
            InterventionStrategy.severity_level == "low"
        ).all()

        result = []
        for strategy in strategies:
            action_steps = []
            if strategy.action_steps:
                try:
                    action_steps = json.loads(strategy.action_steps)
                except (json.JSONDecodeError, TypeError):
                    action_steps = [strategy.action_steps]

            assigned_users = db.query(User).join(
                strategy_user, User.id == strategy_user.c.user_id
            ).filter(strategy_user.c.strategy_id == strategy.id).all()

            result.append({
                "strategy_id": strategy.id,
                "strategy_name": strategy.name,
                "strategy_code": strategy.code,
                "action_type": "preventive",
                "description": strategy.description,
                "severity_level": strategy.severity_level,
                "estimated_duration": str(strategy.estimated_duration) if strategy.estimated_duration else None,
                "action_steps": action_steps,
                "confidence": 0.6,
                "match_reasons": ["预防性维护策略"],
                "sensor_type": strategy.sensor_type,
                "condition_type": strategy.condition_type,
                "threshold_value": strategy.threshold_value,
                "normal_value": strategy.normal_value,
                "duration_minutes": strategy.duration_minutes,
                "assigned_user_ids": [u.id for u in assigned_users],
                "assigned_user_names": [u.real_name or u.username for u in assigned_users],
            })

        return result

    @staticmethod
    def generate_intervention_plan(db: Session, alert_id: int) -> Dict[str, Any]:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            return {"error": "告警不存在"}

        sensor = db.query(Sensor).filter(Sensor.id == alert.sensor_id).first()
        if not sensor:
            return {"error": "传感器不存在"}

        recommendations = InterventionEngine.match_strategies_for_alert(db, alert, sensor)

        return {
            "alert_id": alert.id,
            "alert_message": alert.message,
            "alert_level": alert.level,
            "sensor_name": sensor.name,
            "recommendations": recommendations,
            "total_count": len(recommendations)
        }

    @staticmethod
    def check_strategies_and_create_interventions(db: Session, sensor: Sensor, value: float, alert: Alert):
        strategies = db.query(InterventionStrategy).filter(
            InterventionStrategy.is_active == True,
            InterventionStrategy.sensor_type == sensor.sensor_type
        ).all()

        for strategy in strategies:
            if not strategy.condition_type or strategy.threshold_value is None:
                continue

            condition_met = False
            if strategy.condition_type == "greater_than" and value > strategy.threshold_value:
                condition_met = True
            elif strategy.condition_type == "less_than" and value < strategy.threshold_value:
                condition_met = True

            if not condition_met:
                continue

            if strategy.duration_minutes and strategy.duration_minutes > 0:
                from datetime import datetime, timedelta
                from app.models import SensorReading
                cutoff = datetime.utcnow() - timedelta(minutes=strategy.duration_minutes)
                readings = db.query(SensorReading).filter(
                    SensorReading.sensor_id == sensor.id,
                    SensorReading.time >= cutoff
                ).order_by(SensorReading.time.desc()).limit(strategy.duration_minutes * 2).all()

                if len(readings) < 2:
                    continue

                all_match = True
                for reading in readings:
                    if strategy.condition_type == "greater_than" and reading.value <= strategy.threshold_value:
                        all_match = False
                        break
                    elif strategy.condition_type == "less_than" and reading.value >= strategy.threshold_value:
                        all_match = False
                        break

                if not all_match:
                    continue

            existing = db.query(Intervention).filter(
                Intervention.strategy_id == strategy.id,
                Intervention.alert_id == alert.id,
                Intervention.status.in_(["pending", "in_progress"])
            ).first()
            if existing:
                continue

            InterventionEngine.auto_create_intervention_from_strategy(db, strategy, alert, sensor)


intervention_engine = InterventionEngine()
