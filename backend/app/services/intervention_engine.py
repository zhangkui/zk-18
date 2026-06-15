from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models import InterventionStrategy, Alert, Showcase, Sensor
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

            action_steps = []
            if strategy.action_steps:
                try:
                    action_steps = json.loads(strategy.action_steps)
                except (json.JSONDecodeError, TypeError):
                    action_steps = [strategy.action_steps]

            if confidence > 0:
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
                    "match_reasons": match_reasons
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
                "match_reasons": ["预防性维护策略"]
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


intervention_engine = InterventionEngine()
