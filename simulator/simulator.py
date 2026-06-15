import paho.mqtt.client as mqtt
import json
import time
import random
import os
from datetime import datetime
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MQTT_HOST = os.environ.get("MQTT_HOST", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", 1883))
MQTT_USERNAME = os.environ.get("MQTT_USERNAME", "admin")
MQTT_PASSWORD = os.environ.get("MQTT_PASSWORD", "public")
MQTT_TOPIC_PREFIX = "museum/sensor"

SENSORS = [
    {"code": "S-001-TEMP", "type": "temperature", "base_value": 20.5, "variance": 0.5, "unit": "°C"},
    {"code": "S-001-HUM", "type": "humidity", "base_value": 50.0, "variance": 2.0, "unit": "%RH"},
    {"code": "S-001-LIGHT", "type": "light", "base_value": 80.0, "variance": 10.0, "unit": "lux"},
    {"code": "S-001-VIB", "type": "vibration", "base_value": 0.1, "variance": 0.05, "unit": "mm/s"},
    {"code": "S-002-TEMP", "type": "temperature", "base_value": 21.0, "variance": 0.6, "unit": "°C"},
    {"code": "S-002-HUM", "type": "humidity", "base_value": 48.5, "variance": 2.5, "unit": "%RH"},
    {"code": "S-002-LIGHT", "type": "light", "base_value": 90.0, "variance": 15.0, "unit": "lux"},
    {"code": "S-002-VIB", "type": "vibration", "base_value": 0.12, "variance": 0.06, "unit": "mm/s"},
    {"code": "S-003-TEMP", "type": "temperature", "base_value": 20.8, "variance": 0.7, "unit": "°C"},
    {"code": "S-003-HUM", "type": "humidity", "base_value": 52.0, "variance": 3.0, "unit": "%RH"},
    {"code": "S-003-LIGHT", "type": "light", "base_value": 100.0, "variance": 20.0, "unit": "lux"},
    {"code": "S-003-VIB", "type": "vibration", "base_value": 0.08, "variance": 0.04, "unit": "mm/s"},
    {"code": "S-004-TEMP", "type": "temperature", "base_value": 19.5, "variance": 0.4, "unit": "°C"},
    {"code": "S-004-HUM", "type": "humidity", "base_value": 55.0, "variance": 2.0, "unit": "%RH"},
    {"code": "S-004-LIGHT", "type": "light", "base_value": 30.0, "variance": 5.0, "unit": "lux"},
    {"code": "S-004-VIB", "type": "vibration", "base_value": 0.05, "variance": 0.02, "unit": "mm/s"},
    {"code": "S-005-TEMP", "type": "temperature", "base_value": 20.2, "variance": 0.8, "unit": "°C"},
    {"code": "S-005-HUM", "type": "humidity", "base_value": 49.8, "variance": 2.8, "unit": "%RH"},
    {"code": "S-005-LIGHT", "type": "light", "base_value": 60.0, "variance": 8.0, "unit": "lux"},
    {"code": "S-005-VIB", "type": "vibration", "base_value": 0.15, "variance": 0.08, "unit": "mm/s"},
]


class SensorSimulator:
    def __init__(self):
        self.client = mqtt.Client(client_id="museum-simulator")
        self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.connected = False

        self.sensor_values = {}
        for sensor in SENSORS:
            self.sensor_values[sensor["code"]] = sensor["base_value"]

        self.anomaly_mode = False
        self.anomaly_sensor = None
        self.anomaly_duration = 0

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info("Simulator connected to MQTT broker")
            self.connected = True
        else:
            logger.error(f"Simulator MQTT connection failed: {rc}")

    def on_disconnect(self, client, userdata, rc):
        logger.warning("Simulator disconnected from MQTT broker")
        self.connected = False

    def connect(self):
        while not self.connected:
            try:
                logger.info(f"Connecting to MQTT broker at {MQTT_HOST}:{MQTT_PORT}")
                self.client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
                self.client.loop_start()
                time.sleep(2)
            except Exception as e:
                logger.error(f"Connection failed: {e}, retrying in 5s...")
                time.sleep(5)

    def generate_value(self, sensor):
        current_value = self.sensor_values[sensor["code"]]
        base_value = sensor["base_value"]
        variance = sensor["variance"]

        drift = (base_value - current_value) * 0.05
        noise = random.gauss(0, variance * 0.3)
        new_value = current_value + drift + noise

        min_val = base_value - variance * 2
        max_val = base_value + variance * 2
        new_value = max(min_val, min(max_val, new_value))

        self.sensor_values[sensor["code"]] = new_value
        return new_value

    def trigger_anomaly(self):
        if not self.anomaly_mode and random.random() < 0.02:
            self.anomaly_mode = True
            self.anomaly_sensor = random.choice(SENSORS)
            self.anomaly_duration = random.randint(5, 15)
            logger.info(f"Anomaly triggered for {self.anomaly_sensor['code']}")

    def apply_anomaly(self, sensor, value):
        if self.anomaly_mode and self.anomaly_sensor and sensor["code"] == self.anomaly_sensor["code"]:
            if self.anomaly_duration > 0:
                anomaly_factor = random.uniform(1.5, 3.0)
                if random.random() < 0.5:
                    value = sensor["base_value"] + sensor["variance"] * anomaly_factor
                else:
                    value = sensor["base_value"] - sensor["variance"] * anomaly_factor
                self.anomaly_duration -= 1
                if self.anomaly_duration <= 0:
                    self.anomaly_mode = False
                    self.anomaly_sensor = None
                    logger.info("Anomaly ended")
        return value

    def publish_sensor_data(self):
        self.trigger_anomaly()

        for sensor in SENSORS:
            value = self.generate_value(sensor)
            value = self.apply_anomaly(sensor, value)

            payload = {
                "sensor_code": sensor["code"],
                "sensor_type": sensor["type"],
                "value": round(value, 3),
                "unit": sensor["unit"],
                "timestamp": datetime.utcnow().isoformat(),
                "quality": 1
            }

            topic = f"{MQTT_TOPIC_PREFIX}/{sensor['type']}/{sensor['code']}"

            try:
                self.client.publish(topic, json.dumps(payload))
                logger.debug(f"Published to {topic}: {payload['value']}")
            except Exception as e:
                logger.error(f"Error publishing data: {e}")

    def run(self):
        self.connect()

        logger.info("Starting sensor data simulation...")
        while True:
            try:
                self.publish_sensor_data()
                time.sleep(5)
            except KeyboardInterrupt:
                logger.info("Simulation stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in simulation loop: {e}")
                time.sleep(1)


if __name__ == "__main__":
    simulator = SensorSimulator()
    simulator.run()
