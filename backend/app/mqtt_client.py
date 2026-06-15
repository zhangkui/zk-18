import paho.mqtt.client as mqtt
import json
from datetime import datetime
from app.config import settings
from app.database import SessionLocal
from app.models import Sensor, SensorReading
from app.influx_db import influxdb_service
import threading
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MQTTService:
    def __init__(self):
        self.client = mqtt.Client(client_id="museum-backend")
        self.client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        self.connected = False
        self._thread = None

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
                ts = datetime.fromisoformat(timestamp) if isinstance(timestamp, str) else datetime.fromtimestamp(timestamp)
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
