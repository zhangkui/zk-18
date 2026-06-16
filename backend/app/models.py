from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, ARRAY, Interval, Date, Enum
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import enum


class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    real_name = Column(String(100))
    phone = Column(String(20))
    email = Column(String(100))
    role = Column(String(20), default="operator")
    status = Column(String(20), default="active")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Showcase(Base):
    __tablename__ = "showcase"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    location = Column(String(200))
    description = Column(Text)
    status = Column(String(20), default="active")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    sensors = relationship("Sensor", back_populates="showcase")
    alerts = relationship("Alert", back_populates="showcase")
    interventions = relationship("Intervention", back_populates="showcase")
    profile = relationship("ShowcaseProfile", back_populates="showcase", uselist=False)


class Sensor(Base):
    __tablename__ = "sensor"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    showcase_id = Column(Integer, ForeignKey("showcase.id"))
    sensor_type = Column(String(30), nullable=False)
    unit = Column(String(20))
    min_threshold = Column(Float)
    max_threshold = Column(Float)
    warning_threshold = Column(Float)
    status = Column(String(20), default="active")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    showcase = relationship("Showcase", back_populates="sensors")
    readings = relationship("SensorReading", back_populates="sensor")
    alerts = relationship("Alert", back_populates="sensor")


class SensorReading(Base):
    __tablename__ = "sensor_reading"

    time = Column(DateTime(timezone=True), primary_key=True)
    sensor_id = Column(Integer, ForeignKey("sensor.id"), primary_key=True)
    value = Column(Float, nullable=False)
    quality = Column(Integer, default=1)

    sensor = relationship("Sensor", back_populates="readings")


class Alert(Base):
    __tablename__ = "alert"

    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("sensor.id"))
    showcase_id = Column(Integer, ForeignKey("showcase.id"))
    alert_type = Column(String(50), nullable=False)
    level = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    value = Column(Float)
    threshold = Column(Float)
    status = Column(String(20), default="pending")
    triggered_at = Column(DateTime(timezone=True), nullable=False)
    acknowledged_at = Column(DateTime(timezone=True))
    acknowledged_by = Column(String(50))
    resolved_at = Column(DateTime(timezone=True))
    resolved_by = Column(String(50))
    resolution_note = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    sensor = relationship("Sensor", back_populates="alerts")
    showcase = relationship("Showcase", back_populates="alerts")
    dispositions = relationship("DispositionRecord", back_populates="alert")


class Intervention(Base):
    __tablename__ = "intervention"

    id = Column(Integer, primary_key=True, index=True)
    showcase_id = Column(Integer, ForeignKey("showcase.id"))
    alert_id = Column(Integer, ForeignKey("alert.id"))
    strategy_id = Column(Integer)
    action_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    operator = Column(String(50))
    status = Column(String(20), default="pending")
    scheduled_at = Column(DateTime(timezone=True))
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    result_note = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    showcase = relationship("Showcase", back_populates="interventions")
    dispositions = relationship("DispositionRecord", back_populates="intervention")


class InterventionStrategy(Base):
    __tablename__ = "intervention_strategy"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    trigger_condition = Column(Text)
    action_steps = Column(Text)
    applicable_sensor_types = Column(ARRAY(String))
    severity_level = Column(String(20))
    estimated_duration = Column(Interval)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class ShowcaseProfile(Base):
    __tablename__ = "showcase_profile"

    id = Column(Integer, primary_key=True, index=True)
    showcase_id = Column(Integer, ForeignKey("showcase.id"), unique=True)
    avg_temperature = Column(Float)
    avg_humidity = Column(Float)
    avg_light = Column(Float)
    avg_vibration = Column(Float)
    temperature_stability = Column(Float)
    humidity_stability = Column(Float)
    light_stability = Column(Float)
    vibration_stability = Column(Float)
    risk_level = Column(String(20), default="low")
    last_calculated_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    showcase = relationship("Showcase", back_populates="profile")


class DispositionRecord(Base):
    __tablename__ = "disposition_record"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alert.id"))
    intervention_id = Column(Integer, ForeignKey("intervention.id"))
    showcase_id = Column(Integer, ForeignKey("showcase.id"))
    operator = Column(String(50), nullable=False)
    action_type = Column(String(50), nullable=False)
    details = Column(Text, nullable=False)
    before_status = Column(String(50))
    after_status = Column(String(50))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    alert = relationship("Alert", back_populates="dispositions")
    intervention = relationship("Intervention", back_populates="dispositions")


class TrendAnalysis(Base):
    __tablename__ = "trend_analysis"

    id = Column(Integer, primary_key=True, index=True)
    showcase_id = Column(Integer, ForeignKey("showcase.id"))
    sensor_type = Column(String(30), nullable=False)
    period = Column(String(20), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    avg_value = Column(Float)
    min_value = Column(Float)
    max_value = Column(Float)
    std_dev = Column(Float)
    trend_slope = Column(Float)
    trend_direction = Column(String(20))
    volatility = Column(Float)
    anomaly_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
