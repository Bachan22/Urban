import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    DateTime,
    ForeignKey,
    JSON,
    BigInteger,
)
from sqlalchemy.orm import relationship
from backend.app.database.connection import Base


class CityModel(Base):
    __tablename__ = "cities"

    id = Column(String(50), primary_key=True, index=True)  # e.g., 'pune', 'mumbai'
    name = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    study_radius_km = Column(Float, default=20.0)
    observed_population = Column(Integer, nullable=True)
    data_source = Column(String(255), nullable=False)
    data_confidence = Column(String(100), default="Estimated / Proxy")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    zones = relationship("ZoneModel", back_populates="city", cascade="all, delete-orphan")
    pois = relationship("POIModel", back_populates="city", cascade="all, delete-orphan")


class ZoneModel(Base):
    __tablename__ = "zones"

    id = Column(String(100), primary_key=True, index=True)  # e.g., 'pune_kothrud'
    city_id = Column(String(50), ForeignKey("cities.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_meters = Column(Float, default=2000.0)
    population_proxy = Column(Integer, nullable=True)
    transit_accessibility_score = Column(Float, default=70.0)  # 0-100 proxy
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    city = relationship("CityModel", back_populates="zones")


class POIModel(Base):
    __tablename__ = "pois"

    id = Column(Integer, primary_key=True, autoincrement=True)
    osm_id = Column(BigInteger, nullable=True, index=True)
    city_id = Column(String(50), ForeignKey("cities.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False, index=True)  # e.g., 'healthcare', 'education'
    amenity = Column(String(50), nullable=False)  # e.g., 'hospital', 'school'
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    data_source = Column(String(100), default="OpenStreetMap / Overpass")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    city = relationship("CityModel", back_populates="pois")


class OpportunityScoreRecord(Base):
    __tablename__ = "opportunity_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    city_id = Column(String(50), ForeignKey("cities.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(String(50), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_meters = Column(Float, default=2000.0)
    opportunity_score = Column(Integer, nullable=False)  # 0 to 100
    opportunity_level = Column(String(20), nullable=False)  # High, Medium, Low
    demand_score = Column(Float, default=0.0)
    competition_score = Column(Float, default=0.0)
    service_gap_score = Column(Float, default=0.0)
    accessibility_score = Column(Float, default=0.0)
    factors = Column(JSON, nullable=False)  # List of {name, value, weight}
    reasons = Column(JSON, nullable=False)  # List of strings ("Why this area")
    risks = Column(JSON, nullable=False)  # List of strings ("What to watch out for")
    data_mode = Column(String(50), default="prototype")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
