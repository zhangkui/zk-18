import paho.mqtt.client as mqtt
import json
from datetime import datetime
from app.config import settings
from app.database import SessionLocal
from app.models import Sensor, SensorReading, Alert
from app.influx_db import influxdb_service
from app.services.anomaly_detector import anomaly_detector
from app.services.intervention_engine import intervention_engine
import threading
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ALERT_COOLDOWN_SECONDS = 300


class MQTTService:
    def __init__(self):
        self.client = mqtt.Client(client_id="museum-backend")
        self.client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        self.connected = False
        self._thread = None
        self._last_alert_times: dict = {}

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info("MQTT connected successfully")
            self.connected = True
            topic = f"{settings.MQTT_TOPIC_PREFIX}/#"
            client.subscribe(topic)
            logger.info(f"Subscribed to topic: {topic}")
        else:
            logger.error(f"MQTT connection failed with code {rc}")

    def on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            self.process_sensor_data(msg.topic, payload)
        except Exception as e:
            logger.error(f"Error processing MQTT message: {e}")

    def on_disconnect(self, client, userdata, rc):
        logger.warning(f"MQTT disconnected with code {rc}")
        self.connected = False

    def _is_alert_cooldown_active(self, sensor_id: int, alert_type: str) -> bool:
        key = f"{sensor_id}:{alert_type}"
        now = datetime.utcnow()
        last_time = self._last_alert_times.get(key)
        if last_time and (now - last_time).total_seconds() < ALERT_COOLDOWN_SECONDS:
            return True
        return False

    def _record_alert_sent(self, sensor_id: int, alert_type: str):
        key = f"{sensor_id}:{alert_type}"
        self._last_alert_times[key] = datetime.utcnow()

    def _check_and_create_alert(self, db, sensor: Sensor, value: float, ts: datetime):
        try:
            history_readings = db.query(SensorReading).filter(
                SensorReading.sensor_id == sensor.id,
                SensorReading.time < ts
            ).order_by(SensorReading.time.desc()).limit(100).all()

            history_readings.reverse()
            history_values = [r.value for r in history_readings]
            history_times = [r.time for r in history_readings]

            result = anomaly_detector.comprehensive_detection(
                value=value,
                history_values=history_values,
                history_times=history_times,
                min_threshold=sensor.min_threshold,
                max_threshold=sensor.max_threshold,
                warning_threshold=sensor.warning_threshold,
                sensor_type=sensor.sensor_type
            )

            if not result.get("is_anomaly"):
                return

            alert_type = result.get("primary_type", "unknown")
            if self._is_alert_cooldown_active(sensor.id, alert_type):
                logger.info(f"Alert cooldown active for sensor {sensor.code}, type {alert_type}")
                return

            threshold_val = None
            if result.get("primary_type") == "over_max":
                threshold_val = sensor.max_threshold
            elif result.get("primary_type") == "below_min":
                threshold_val = sensor.min_threshold
            elif result.get("primary_type") == "warning_high":
                threshold_val = sensor.warning_threshold

            sensor_type_names = {
                "temperature": "温度",
                "humidity": "湿度",
                "light": "光照",
                "vibration": "震动",
            }
            sensor_name = sensor_type_names.get(sensor.sensor_type, sensor.sensor_type)

            alert = Alert(
                sensor_id=sensor.id,
                showcase_id=sensor.showcase_id,
                alert_type=alert_type,
                level=result.get("level", "warning"),
                message=f"{sensor.name} {sensor_name}异常: {result.get('message', '')}",
                value=value,
                threshold=threshold_val,
                status="pending",
                triggered_at=ts
            )
            db.add(alert)
            db.commit()

            self._record_alert_sent(sensor.id, alert_type)

            try:
                from app.models import User
                non_admin_users = db.query(User).filter(
                    User.role != "admin",
                    User.status == "active"
                ).order_by(User.id).all()
                if non_admin_users:
                    pending_counts = {}
                    for u in non_admin_users:
                        cnt = db.query(Alert).filter(
                            Alert.assigned_user_id == u.id,
                            Alert.status.in_(["pending", "acknowledged"])
                        ).count()
                        pending_counts[u.id] = cnt
                    min_user = min(non_admin_users, key=lambda u: pending_counts[u.id])
                    alert.assigned_user_id = min_user.id
                    db.commit()
                    logger.info(f"Auto-assigned alert {alert.id} to user {min_user.username}")
            except Exception as e:
                logger.error(f"Error auto-assigning alert: {e}")

            try:
                intervention_engine.check_strategies_and_create_interventions(db, sensor, value, alert)
            except Exception as e:
                logger.error(f"Error checking strategies for auto-intervention: {e}")

            logger.warning(
                f"Alert created: sensor={sensor.code}, type={alert_type}, "
                f"level={result.get('level')}, value={value}, msg={result.get('message')}"
            )

        except Exception as e:
            logger.error(f"Error in anomaly detection/alert creation for sensor {sensor.code}: {e}")

    def process_sensor_data(self, topic: str, payload: dict):
        try:
            sensor_code = payload.get("sensor_code")
            value = payload.get("value")
            timestamp = payload.get("timestamp")
            quality = payload.get("quality", 1)

            if not sensor_code or value is None:
                logger.warning(f"Invalid sensor data: {payload}")
                return

            if timestamp:
                if isinstance(timestamp, str):
                    ts = datetime.fromisoformat(timestamp)
                else:
                    ts = datetime.fromtimestamp(timestamp)
            else:
                ts = datetime.utcnow()

            db = SessionLocal()
            try:
                sensor = db.query(Sensor).filter(Sensor.code == sensor_code).first()
                if not sensor:
                    logger.warning(f"Sensor not found: {sensor_code}")
                    return

                reading = SensorReading(
                    time=ts,
                    sensor_id=sensor.id,
                    value=value,
                    quality=quality
                )
                db.add(reading)
                db.commit()

                try:
                    influxdb_service.write_sensor_data(
                        sensor_code=sensor.code,
                        sensor_type=sensor.sensor_type,
                        showcase_id=sensor.showcase_id,
                        value=value,
                        timestamp=ts,
                        quality=quality
                    )
                except Exception as e:
                    logger.error(f"Error writing to InfluxDB: {e}")

                self._check_and_create_alert(db, sensor, value, ts)

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error processing sensor data: {e}")

    def start(self):
        def run():
            while True:
                try:
                    logger.info(f"Connecting to MQTT broker at {settings.MQTT_HOST}:{settings.MQTT_PORT}")
                    self.client.connect(settings.MQTT_HOST, settings.MQTT_PORT, keepalive=60)
                    self.client.loop_forever()
                except Exception as e:
                    logger.error(f"MQTT connection error: {e}")
                    time.sleep(5)

        self._thread = threading.Thread(target=run, daemon=True)
        self._thread.start()

    def publish(self, topic: str, payload: dict):
        if self.connected:
            self.client.publish(topic, json.dumps(payload))
        else:
            logger.warning("MQTT not connected, cannot publish")

    def stop(self):
        if self.client:
            self.client.disconnect()
        if self._thread:
            self._thread.join(timeout=2)


mqtt_service = MQTTService()
