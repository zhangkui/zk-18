from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from app.config import settings
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json


class InfluxDBService:
    def __init__(self):
        self.url = settings.INFLUXDB_URL or f"http://{settings.INFLUXDB_HOST}:{settings.INFLUXDB_PORT}"
        self.token = settings.INFLUXDB_TOKEN
        self.org = settings.INFLUXDB_ORG
        self.bucket = settings.INFLUXDB_BUCKET
        self._client = None
        self._write_api = None
        self._query_api = None

    @property
    def client(self):
        if self._client is None:
            self._client = InfluxDBClient(
                url=self.url,
                token=self.token,
                org=self.org
            )
        return self._client

    @property
    def write_api(self):
        if self._write_api is None:
            self._write_api = self.client.write_api(write_options=SYNCHRONOUS)
        return self._write_api

    @property
    def query_api(self):
        if self._query_api is None:
            self._query_api = self.client.query_api()
        return self._query_api

    def write_sensor_data(self, sensor_code: str, sensor_type: str, showcase_id: int,
                          value: float, timestamp: Optional[datetime] = None, quality: int = 1):
        if timestamp is None:
            timestamp = datetime.utcnow()

        point = Point("sensor_data") \
            .tag("sensor_code", sensor_code) \
            .tag("sensor_type", sensor_type) \
            .tag("showcase_id", str(showcase_id)) \
            .field("value", value) \
            .field("quality", quality) \
            .time(timestamp, WritePrecision.NS)

        self.write_api.write(bucket=self.bucket, org=self.org, record=point)

    def write_batch_sensor_data(self, points: List[Point]):
        if points:
            self.write_api.write(bucket=self.bucket, org=self.org, records=points)

    def query_sensor_data(self, sensor_code: str, start_time: datetime, end_time: datetime,
                          aggregation: Optional[str] = None, window: Optional[str] = None) -> List[Dict[str, Any]]:
        if aggregation and window:
            flux_query = f'''
                from(bucket: "{self.bucket}")
                    |> range(start: {int(start_time.timestamp())}, stop: {int(end_time.timestamp())})
                    |> filter(fn: (r) => r["_measurement"] == "sensor_data")
                    |> filter(fn: (r) => r["sensor_code"] == "{sensor_code}")
                    |> filter(fn: (r) => r["_field"] == "value")
                    |> aggregateWindow(every: {window}, fn: {aggregation}, createEmpty: false)
                    |> yield(name: "{aggregation}")
            '''
        else:
            flux_query = f'''
                from(bucket: "{self.bucket}")
                    |> range(start: {int(start_time.timestamp())}, stop: {int(end_time.timestamp())})
                    |> filter(fn: (r) => r["_measurement"] == "sensor_data")
                    |> filter(fn: (r) => r["sensor_code"] == "{sensor_code}")
                    |> filter(fn: (r) => r["_field"] == "value")
                    |> yield(name: "raw")
            '''

        result = self.query_api.query(query=flux_query, org=self.org)
        data = []
        for table in result:
            for record in table.records:
                data.append({
                    "time": record.get_time(),
                    "value": record.get_value()
                })
        return data

    def query_showcase_sensor_data(self, showcase_id: int, sensor_type: str,
                                   start_time: datetime, end_time: datetime,
                                   aggregation: Optional[str] = None,
                                   window: Optional[str] = None) -> List[Dict[str, Any]]:
        if aggregation and window:
            flux_query = f'''
                from(bucket: "{self.bucket}")
                    |> range(start: {int(start_time.timestamp())}, stop: {int(end_time.timestamp())})
                    |> filter(fn: (r) => r["_measurement"] == "sensor_data")
                    |> filter(fn: (r) => r["showcase_id"] == "{showcase_id}")
                    |> filter(fn: (r) => r["sensor_type"] == "{sensor_type}")
                    |> filter(fn: (r) => r["_field"] == "value")
                    |> aggregateWindow(every: {window}, fn: {aggregation}, createEmpty: false)
                    |> yield(name: "{aggregation}")
            '''
        else:
            flux_query = f'''
                from(bucket: "{self.bucket}")
                    |> range(start: {int(start_time.timestamp())}, stop: {int(end_time.timestamp())})
                    |> filter(fn: (r) => r["_measurement"] == "sensor_data")
                    |> filter(fn: (r) => r["showcase_id"] == "{showcase_id}")
                    |> filter(fn: (r) => r["sensor_type"] == "{sensor_type}")
                    |> filter(fn: (r) => r["_field"] == "value")
                    |> yield(name: "raw")
            '''

        result = self.query_api.query(query=flux_query, org=self.org)
        data = []
        for table in result:
            for record in table.records:
                data.append({
                    "time": record.get_time(),
                    "value": record.get_value(),
                    "sensor_code": record.values.get("sensor_code", "")
                })
        return data

    def get_latest_value(self, sensor_code: str) -> Optional[Dict[str, Any]]:
        flux_query = f'''
            from(bucket: "{self.bucket}")
                |> range(start: -1h)
                |> filter(fn: (r) => r["_measurement"] == "sensor_data")
                |> filter(fn: (r) => r["sensor_code"] == "{sensor_code}")
                |> filter(fn: (r) => r["_field"] == "value")
                |> last()
                |> yield(name: "latest")
        '''

        result = self.query_api.query(query=flux_query, org=self.org)
        for table in result:
            for record in table.records:
                return {
                    "time": record.get_time(),
                    "value": record.get_value()
                }
        return None

    def close(self):
        if self._client:
            self._client.close()
            self._client = None
            self._write_api = None
            self._query_api = None


influxdb_service = InfluxDBService()
