from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Showcase, Sensor, SensorReading, ShowcaseProfile, Alert, TrendAnalysis
from datetime import datetime, timedelta, date
import numpy as np
from scipy import stats
import logging

logger = logging.getLogger(__name__)


class ShowcaseProfiler:
    @staticmethod
    def calculate_stability(values: List[float]) -> float:
        if len(values) < 2:
            return 1.0
        values_arr = np.array(values)
        mean = np.mean(values_arr)
        if mean == 0:
            return 1.0
        std = np.std(values_arr)
        cv = std / abs(mean)
        stability = max(0.0, 1.0 - cv)
        return stability

    @staticmethod
    def calculate_showcase_profile(db: Session, showcase_id: int,
                                   period_hours: int = 24) -> Optional[ShowcaseProfile]:
        showcase = db.query(Showcase).filter(Showcase.id == showcase_id).first()
        if not showcase:
            return None

        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=period_hours)

        sensors = db.query(Sensor).filter(
            Sensor.showcase_id == showcase_id,
            Sensor.status == "active"
        ).all()

        sensor_data = {}
        for sensor in sensors:
            readings = db.query(SensorReading).filter(
                SensorReading.sensor_id == sensor.id,
                SensorReading.time >= start_time,
                SensorReading.time <= end_time
            ).order_by(SensorReading.time).all()

            if readings:
                values = [r.value for r in readings]
                sensor_data[sensor.sensor_type] = {
                    "values": values,
                    "avg": np.mean(values),
                    "stability": ShowcaseProfiler.calculate_stability(values)
                }

        profile = db.query(ShowcaseProfile).filter(
            ShowcaseProfile.showcase_id == showcase_id
        ).first()

        if not profile:
            profile = ShowcaseProfile(showcase_id=showcase_id)
            db.add(profile)

        if "temperature" in sensor_data:
            profile.avg_temperature = sensor_data["temperature"]["avg"]
            profile.temperature_stability = sensor_data["temperature"]["stability"]
        if "humidity" in sensor_data:
            profile.avg_humidity = sensor_data["humidity"]["avg"]
            profile.humidity_stability = sensor_data["humidity"]["stability"]
        if "light" in sensor_data:
            profile.avg_light = sensor_data["light"]["avg"]
            profile.light_stability = sensor_data["light"]["stability"]
        if "vibration" in sensor_data:
            profile.avg_vibration = sensor_data["vibration"]["avg"]
            profile.vibration_stability = sensor_data["vibration"]["stability"]

        stability_scores = [
            data["stability"] for data in sensor_data.values()
        ]

        active_alerts = db.query(Alert).filter(
            Alert.showcase_id == showcase_id,
            Alert.status.in_(["pending", "acknowledged"])
        ).count()

        if stability_scores:
            avg_stability = np.mean(stability_scores)

            if avg_stability > 0.9 and active_alerts == 0:
                profile.risk_level = "low"
            elif avg_stability > 0.75 or active_alerts <= 1:
                profile.risk_level = "medium"
            else:
                profile.risk_level = "high"
        else:
            profile.risk_level = "low" if active_alerts == 0 else "medium"

        profile.last_calculated_at = datetime.utcnow()
        profile.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(profile)

        return profile

    @staticmethod
    def get_showcase_profile(db: Session, showcase_id: int) -> Optional[Dict[str, Any]]:
        profile = db.query(ShowcaseProfile).filter(
            ShowcaseProfile.showcase_id == showcase_id
        ).first()

        if not profile:
            profile = ShowcaseProfiler.calculate_showcase_profile(db, showcase_id)

        if not profile:
            return None

        showcase = db.query(Showcase).filter(Showcase.id == showcase_id).first()
        sensors = db.query(Sensor).filter(
            Sensor.showcase_id == showcase_id,
            Sensor.status == "active"
        ).all()

        return {
            "showcase_id": showcase.id,
            "showcase_code": showcase.code,
            "showcase_name": showcase.name,
            "location": showcase.location,
            "description": showcase.description,
            "avg_temperature": profile.avg_temperature,
            "avg_humidity": profile.avg_humidity,
            "avg_light": profile.avg_light,
            "avg_vibration": profile.avg_vibration,
            "temperature_stability": profile.temperature_stability,
            "humidity_stability": profile.humidity_stability,
            "light_stability": profile.light_stability,
            "vibration_stability": profile.vibration_stability,
            "risk_level": profile.risk_level,
            "last_calculated_at": profile.last_calculated_at,
            "sensor_count": len(sensors),
            "sensors": [
                {
                    "id": s.id,
                    "code": s.code,
                    "name": s.name,
                    "type": s.sensor_type,
                    "unit": s.unit,
                    "min_threshold": s.min_threshold,
                    "max_threshold": s.max_threshold
                } for s in sensors
            ]
        }


class TrendAnalyzer:
    @staticmethod
    def calculate_trend(values: List[float], times: List[datetime]) -> Dict[str, Any]:
        if len(values) < 3:
            return {
                "slope": 0,
                "direction": "stable",
                "r_squared": 0
            }

        x = np.array([(t - times[0]).total_seconds() / 3600 for t in times])
        y = np.array(values)

        slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)

        if abs(slope) < 0.01:
            direction = "stable"
        elif slope > 0:
            direction = "rising"
        else:
            direction = "falling"

        return {
            "slope": slope,
            "intercept": intercept,
            "direction": direction,
            "r_squared": r_value ** 2,
            "p_value": p_value
        }

    @staticmethod
    def analyze_period_trend(db: Session, showcase_id: int, sensor_type: str,
                             start_date: date, end_date: date,
                             period: str = "monthly") -> Dict[str, Any]:
        sensors = db.query(Sensor).filter(
            Sensor.showcase_id == showcase_id,
            Sensor.sensor_type == sensor_type,
            Sensor.status == "active"
        ).all()

        if not sensors:
            return {"error": "未找到对应传感器"}

        sensor_ids = [s.id for s in sensors]

        readings = db.query(SensorReading).filter(
            SensorReading.sensor_id.in_(sensor_ids),
            func.date(SensorReading.time) >= start_date,
            func.date(SensorReading.time) <= end_date
        ).order_by(SensorReading.time).all()

        if not readings:
            return {"error": "该时间段内无数据"}

        values = [r.value for r in readings]
        times = [r.time for r in readings]

        values_arr = np.array(values)

        trend_info = TrendAnalyzer.calculate_trend(values, times)

        mean = np.mean(values_arr)
        std = np.std(values_arr)
        volatility = std / mean if mean != 0 else 0

        anomaly_count = db.query(Alert).filter(
            Alert.showcase_id == showcase_id,
            func.date(Alert.triggered_at) >= start_date,
            func.date(Alert.triggered_at) <= end_date
        ).count()

        trend_analysis = TrendAnalysis(
            showcase_id=showcase_id,
            sensor_type=sensor_type,
            period=period,
            start_date=start_date,
            end_date=end_date,
            avg_value=float(np.mean(values_arr)),
            min_value=float(np.min(values_arr)),
            max_value=float(np.max(values_arr)),
            std_dev=float(std),
            trend_slope=trend_info["slope"],
            trend_direction=trend_info["direction"],
            volatility=float(volatility),
            anomaly_count=anomaly_count
        )

        db.add(trend_analysis)
        db.commit()
        db.refresh(trend_analysis)

        return {
            "id": trend_analysis.id,
            "showcase_id": showcase_id,
            "sensor_type": sensor_type,
            "period": period,
            "start_date": start_date,
            "end_date": end_date,
            "avg_value": trend_analysis.avg_value,
            "min_value": trend_analysis.min_value,
            "max_value": trend_analysis.max_value,
            "std_dev": trend_analysis.std_dev,
            "trend_slope": trend_analysis.trend_slope,
            "trend_direction": trend_analysis.trend_direction,
            "volatility": trend_analysis.volatility,
            "anomaly_count": trend_analysis.anomaly_count,
            "data_points": len(readings)
        }

    @staticmethod
    def get_historical_trends(db: Session, showcase_id: int,
                              sensor_type: Optional[str] = None,
                              period: Optional[str] = None,
                              limit: int = 10) -> List[Dict[str, Any]]:
        query = db.query(TrendAnalysis).filter(TrendAnalysis.showcase_id == showcase_id)

        if sensor_type:
            query = query.filter(TrendAnalysis.sensor_type == sensor_type)
        if period:
            query = query.filter(TrendAnalysis.period == period)

        trends = query.order_by(TrendAnalysis.end_date.desc()).limit(limit).all()

        return [
            {
                "id": t.id,
                "sensor_type": t.sensor_type,
                "period": t.period,
                "start_date": t.start_date,
                "end_date": t.end_date,
                "avg_value": t.avg_value,
                "min_value": t.min_value,
                "max_value": t.max_value,
                "trend_direction": t.trend_direction,
                "volatility": t.volatility,
                "anomaly_count": t.anomaly_count
            } for t in trends
        ]


showcase_profiler = ShowcaseProfiler()
trend_analyzer = TrendAnalyzer()
