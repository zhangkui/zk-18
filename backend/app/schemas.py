from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List, Dict, Any


class ShowcaseBase(BaseModel):
    code: str
    name: str
    location: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "active"


class ShowcaseCreate(ShowcaseBase):
    pass


class Showcase(ShowcaseBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SensorBase(BaseModel):
    code: str
    name: str
    showcase_id: int
    sensor_type: str
    unit: Optional[str] = None
    min_threshold: Optional[float] = None
    max_threshold: Optional[float] = None
    warning_threshold: Optional[float] = None
    status: Optional[str] = "active"


class SensorCreate(SensorBase):
    pass


class Sensor(SensorBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SensorReadingBase(BaseModel):
    time: datetime
    sensor_id: int
    value: float
    quality: Optional[int] = 1


class SensorReadingCreate(SensorReadingBase):
    pass


class SensorReading(SensorReadingBase):
    class Config:
        from_attributes = True


class AlertBase(BaseModel):
    sensor_id: Optional[int] = None
    showcase_id: Optional[int] = None
    alert_type: str
    level: str
    message: str
    value: Optional[float] = None
    threshold: Optional[float] = None
    status: Optional[str] = "pending"
    triggered_at: datetime


class AlertCreate(AlertBase):
    pass


class AlertUpdate(BaseModel):
    status: Optional[str] = None
    acknowledged_by: Optional[str] = None
    resolved_by: Optional[str] = None
    resolution_note: Optional[str] = None


class Alert(AlertBase):
    id: int
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class InterventionBase(BaseModel):
    showcase_id: Optional[int] = None
    alert_id: Optional[int] = None
    strategy_id: Optional[int] = None
    action_type: str
    description: str
    operator: Optional[str] = None
    status: Optional[str] = "pending"
    scheduled_at: Optional[datetime] = None


class InterventionCreate(InterventionBase):
    pass


class InterventionUpdate(BaseModel):
    status: Optional[str] = None
    operator: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result_note: Optional[str] = None


class Intervention(InterventionBase):
    id: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InterventionStrategyBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    trigger_condition: Optional[str] = None
    action_steps: Optional[str] = None
    applicable_sensor_types: Optional[List[str]] = None
    severity_level: Optional[str] = None
    is_active: Optional[bool] = True


class InterventionStrategyCreate(InterventionStrategyBase):
    pass


class InterventionStrategy(InterventionStrategyBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ShowcaseProfileBase(BaseModel):
    showcase_id: int
    avg_temperature: Optional[float] = None
    avg_humidity: Optional[float] = None
    avg_light: Optional[float] = None
    avg_vibration: Optional[float] = None
    temperature_stability: Optional[float] = None
    humidity_stability: Optional[float] = None
    light_stability: Optional[float] = None
    vibration_stability: Optional[float] = None
    risk_level: Optional[str] = "low"


class ShowcaseProfileCreate(ShowcaseProfileBase):
    pass


class ShowcaseProfile(ShowcaseProfileBase):
    id: int
    last_calculated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DispositionRecordBase(BaseModel):
    alert_id: Optional[int] = None
    intervention_id: Optional[int] = None
    showcase_id: Optional[int] = None
    operator: str
    action_type: str
    details: str
    before_status: Optional[str] = None
    after_status: Optional[str] = None


class DispositionRecordCreate(DispositionRecordBase):
    pass


class DispositionRecord(DispositionRecordBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TrendAnalysisBase(BaseModel):
    showcase_id: int
    sensor_type: str
    period: str
    start_date: date
    end_date: date
    avg_value: Optional[float] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    std_dev: Optional[float] = None
    trend_slope: Optional[float] = None
    trend_direction: Optional[str] = None
    volatility: Optional[float] = None
    anomaly_count: Optional[int] = 0


class TrendAnalysisCreate(TrendAnalysisBase):
    pass


class TrendAnalysis(TrendAnalysisBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TimeSeriesDataPoint(BaseModel):
    time: datetime
    value: float


class TimeSeriesResponse(BaseModel):
    sensor_id: int
    sensor_code: str
    sensor_type: str
    unit: str
    data: List[TimeSeriesDataPoint]


class AnomalyDetectionResult(BaseModel):
    sensor_id: int
    sensor_code: str
    anomaly_type: str
    severity: str
    description: str
    value: float
    threshold: float
    timestamp: datetime


class InterventionRecommendation(BaseModel):
    strategy_id: Optional[int] = None
    strategy_name: str
    strategy_code: str
    action_type: str
    description: str
    severity_level: str
    estimated_duration: Optional[str] = None
    action_steps: Optional[List[str]] = None
    confidence: float


class DashboardStats(BaseModel):
    total_showcases: int
    active_sensors: int
    active_alerts: int
    pending_interventions: int
    high_risk_showcases: int
    avg_temperature: float
    avg_humidity: float


class MQTTSensorData(BaseModel):
    sensor_code: str
    value: float
    timestamp: datetime
    quality: Optional[int] = 1
