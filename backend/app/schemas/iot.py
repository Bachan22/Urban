from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class IoTDeviceCreate(BaseModel):
    name: str
    device_type: str  # sensor, camera, gateway
    latitude: float
    longitude: float
    metadata: Optional[dict] = None


class IoTDeviceResponse(BaseModel):
    id: str
    name: str
    device_type: str
    latitude: float
    longitude: float
    status: str
    last_heartbeat: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IoTDataPointCreate(BaseModel):
    metric_name: str
    value: float
    unit: Optional[str] = None


class IoTDataPointResponse(BaseModel):
    id: int
    device_id: str
    metric_name: str
    value: float
    unit: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True


class IoTDeviceStatus(BaseModel):
    device_id: str
    status: str  # online, offline, error
