from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.tables import UserModel, IoTDeviceModel
from backend.app.schemas.iot import (
    IoTDeviceCreate,
    IoTDeviceResponse,
    IoTDataPointCreate,
    IoTDataPointResponse,
    IoTDeviceStatus,
)
from backend.app.services.iot import IoTService
from backend.app.core.dependencies import get_current_user
import uuid

router = APIRouter(prefix="/api/iot", tags=["IoT Management"])


@router.post("/devices", response_model=IoTDeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_device(
    device_data: IoTDeviceCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new IoT device."""
    device_id = f"{current_user.id}_{uuid.uuid4().hex[:8]}"
    
    device = IoTService.create_device(
        db,
        device_id=device_id,
        owner_id=current_user.id,
        name=device_data.name,
        device_type=device_data.device_type,
        latitude=device_data.latitude,
        longitude=device_data.longitude,
        metadata=device_data.metadata,
    )
    return device


@router.get("/devices", response_model=list[IoTDeviceResponse])
async def list_devices(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all IoT devices for current user."""
    devices = IoTService.list_user_devices(db, current_user.id)
    return devices


@router.get("/devices/{device_id}", response_model=IoTDeviceResponse)
async def get_device(
    device_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific IoT device."""
    device = IoTService.get_device(db, device_id)
    if not device or device.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )
    return device


@router.post("/devices/{device_id}/data", response_model=IoTDataPointResponse)
async def add_device_data(
    device_id: str,
    data: IoTDataPointCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add data point from IoT device."""
    device = IoTService.get_device(db, device_id)
    if not device or device.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )
    
    data_point = IoTService.add_data_point(
        db,
        device_id=device_id,
        metric_name=data.metric_name,
        value=data.value,
        unit=data.unit,
    )
    return data_point


@router.get("/devices/{device_id}/data", response_model=list[IoTDataPointResponse])
async def get_device_data(
    device_id: str,
    hours: int = 24,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get device data points."""
    device = IoTService.get_device(db, device_id)
    if not device or device.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )
    
    data_points = IoTService.get_device_data(db, device_id, hours)
    return data_points


@router.patch("/devices/{device_id}/status")
async def update_device_status(
    device_id: str,
    status_data: IoTDeviceStatus,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update device status (online/offline/error)."""
    device = IoTService.get_device(db, device_id)
    if not device or device.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )
    
    device = IoTService.update_device_status(db, device_id, status_data.status)
    return device
