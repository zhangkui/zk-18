import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from scipy import stats
import logging

logger = logging.getLogger(__name__)


class AnomalyDetector:
    @staticmethod
    def threshold_detection(value: float, min_threshold: Optional[float],
                            max_threshold: Optional[float],
                            warning_threshold: Optional[float]) -> Dict[str, Any]:
        result = {
            "is_anomaly": False,
            "level": "normal",
            "type": None,
            "message": ""
        }

        if max_threshold is not None and value > max_threshold:
            result["is_anomaly"] = True
            result["level"] = "critical"
            result["type"] = "over_max"
            result["message"] = f"数值 {value} 超过上限阈值 {max_threshold}"
            return result

        if min_threshold is not None and value < min_threshold:
            result["is_anomaly"] = True
            result["level"] = "critical"
            result["type"] = "below_min"
            result["message"] = f"数值 {value} 低于下限阈值 {min_threshold}"
            return result

        if warning_threshold is not None and value > warning_threshold:
            result["is_anomaly"] = True
            result["level"] = "warning"
            result["type"] = "warning_high"
            result["message"] = f"数值 {value} 接近上限阈值 {max_threshold}"
            return result

        return result

    @staticmethod
    def z_score_detection(values: List[float], new_value: float, threshold: float = 3.0) -> Dict[str, Any]:
        result = {
            "is_anomaly": False,
            "level": "normal",
            "type": None,
            "message": "",
            "z_score": 0.0
        }

        if len(values) < 10:
            return result

        mean = np.mean(values)
        std = np.std(values)

        if std == 0:
            return result

        z_score = (new_value - mean) / std
        result["z_score"] = z_score

        if abs(z_score) > threshold:
            result["is_anomaly"] = True
            result["level"] = "warning" if abs(z_score) < 2 * threshold else "critical"
            result["type"] = "statistical_outlier"
            result["message"] = f"统计异常: Z分数 {z_score:.2f} 超过阈值 {threshold}"

        return result

    @staticmethod
    def rate_of_change_detection(values: List[float], times: List[datetime],
                                 max_rate: float) -> Dict[str, Any]:
        result = {
            "is_anomaly": False,
            "level": "normal",
            "type": None,
            "message": "",
            "rate_of_change": 0.0
        }

        if len(values) < 2 or len(times) < 2:
            return result

        recent_values = values[-10:] if len(values) > 10 else values
        recent_times = times[-10:] if len(times) > 10 else times

        time_diff = (recent_times[-1] - recent_times[0]).total_seconds() / 3600
        if time_diff == 0:
            return result

        value_diff = recent_values[-1] - recent_values[0]
        rate = abs(value_diff) / time_diff
        result["rate_of_change"] = rate

        if rate > max_rate:
            result["is_anomaly"] = True
            result["level"] = "warning" if rate < 2 * max_rate else "critical"
            result["type"] = "rapid_change"
            result["message"] = f"变化速率 {rate:.2f}/小时 超过阈值 {max_rate}"

        return result

    @staticmethod
    def volatility_detection(values: List[float], window_size: int = 20,
                             max_volatility: float = 0.1) -> Dict[str, Any]:
        result = {
            "is_anomaly": False,
            "level": "normal",
            "type": None,
            "message": "",
            "volatility": 0.0
        }

        if len(values) < window_size:
            return result

        recent_values = values[-window_size:]
        mean = np.mean(recent_values)

        if mean == 0:
            return result

        std = np.std(recent_values)
        volatility = std / abs(mean)
        result["volatility"] = volatility

        if volatility > max_volatility:
            result["is_anomaly"] = True
            result["level"] = "warning" if volatility < 2 * max_volatility else "critical"
            result["type"] = "high_volatility"
            result["message"] = f"波动率 {volatility:.2%} 超过阈值 {max_volatility:.0%}"

        return result

    @staticmethod
    def moving_average_deviation(values: List[float], new_value: float,
                                 window_size: int = 30,
                                 deviation_threshold: float = 0.15) -> Dict[str, Any]:
        result = {
            "is_anomaly": False,
            "level": "normal",
            "type": None,
            "message": "",
            "moving_avg": 0.0,
            "deviation": 0.0
        }

        if len(values) < window_size:
            return result

        window_values = values[-window_size:]
        moving_avg = np.mean(window_values)
        result["moving_avg"] = moving_avg

        if moving_avg == 0:
            return result

        deviation = abs((new_value - moving_avg) / moving_avg)
        result["deviation"] = deviation

        if deviation > deviation_threshold:
            result["is_anomaly"] = True
            result["level"] = "warning" if deviation < 2 * deviation_threshold else "critical"
            result["type"] = "ma_deviation"
            result["message"] = f"偏离移动平均线 {deviation:.2%} 超过阈值 {deviation_threshold:.0%}"

        return result

    @classmethod
    def comprehensive_detection(cls, value: float, history_values: List[float],
                                history_times: List[datetime],
                                min_threshold: Optional[float],
                                max_threshold: Optional[float],
                                warning_threshold: Optional[float],
                                sensor_type: str) -> Dict[str, Any]:
        anomalies = []

        threshold_result = cls.threshold_detection(value, min_threshold, max_threshold, warning_threshold)
        if threshold_result["is_anomaly"]:
            anomalies.append(threshold_result)

        z_result = cls.z_score_detection(history_values, value)
        if z_result["is_anomaly"]:
            anomalies.append(z_result)

        rate_configs = {
            "temperature": 2.0,
            "humidity": 5.0,
            "light": 50.0,
            "vibration": 0.2
        }
        max_rate = rate_configs.get(sensor_type, 5.0)
        rate_result = cls.rate_of_change_detection(history_values, history_times, max_rate)
        if rate_result["is_anomaly"]:
            anomalies.append(rate_result)

        if anomalies:
            highest = max(anomalies, key=lambda x: {"critical": 3, "warning": 2, "normal": 1}[x["level"]])
            return {
                "is_anomaly": True,
                "level": highest["level"],
                "primary_type": highest["type"],
                "message": highest["message"],
                "all_anomalies": anomalies
            }

        return {"is_anomaly": False, "level": "normal", "primary_type": None, "message": "正常"}


anomaly_detector = AnomalyDetector()
