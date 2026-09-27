from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from backend.app.models.tables import IoTDeviceModel, IoTDataPointModel
from typing import Optional


class IoTService:
    @staticmethod
    def create_device(
        db: Session,
        device_id: str,
        owner_id: int,
        name: str,
        device_type: str,
        latitude: float,
        longitude: float,
        metadata: dict = None,
    ) -> IoTDeviceModel:
        """Create a new IoT device."""
        device = IoTDeviceModel(
            id=device_id,
            owner_id=owner_id,
            name=name,
            device_type=device_type,
            latitude=latitude,
            longitude=longitude,
            status="offline",
            metadata=metadata or {},
        )
        db.add(device)
        db.commit()
        db.refresh(device)
        return device

    @staticmethod
    def get_device(db: Session, device_id: str) -> Optional[IoTDeviceModel]:
        """Get device by ID."""
        return db.query(IoTDeviceModel).filter(IoTDeviceModel.id == device_id).first()

    @staticmethod
    def list_user_devices(db: Session, owner_id: int):
        """Get all devices for a user."""
        return db.query(IoTDeviceModel).filter(IoTDeviceModel.owner_id == owner_id).all()

    @staticmethod
    def update_device_status(
        db: Session, device_id: str, status: str
    ) -> IoTDeviceModel:
        """Update device status and heartbeat."""
        device = db.query(IoTDeviceModel).filter(IoTDeviceModel.id == device_id).first()
        if device:
            device.status = status
            device.last_heartbeat = datetime.utcnow()
            db.commit()
            db.refresh(device)
        return device

    @staticmethod
    def add_data_point(
        db: Session,
        device_id: str,
        metric_name: str,
        value: float,
        unit: str = None,
    ) -> IoTDataPointModel:
        """Add a new data point from IoT device."""
        data_point = IoTDataPointModel(
            device_id=device_id,
            metric_name=metric_name,
            value=value,
            unit=unit,
        )
        db.add(data_point)
        db.commit()
        db.refresh(data_point)
        return data_point

    @staticmethod
    def get_device_data(
        db: Session, device_id: str, hours: int = 24
    ) -> list[IoTDataPointModel]:
        """Get device data points from last N hours."""
        since = datetime.utcnow() - timedelta(hours=hours)
        return (
            db.query(IoTDataPointModel)
            .filter(
                IoTDataPointModel.device_id == device_id,
                IoTDataPointModel.timestamp >= since,
            )
            .order_by(IoTDataPointModel.timestamp.desc())
            .all()
        )

    @staticmethod
    def get_device_metrics(db: Session, device_id: str, metric_name: str, hours: int = 24):
        """Get specific metric data for a device."""
        since = datetime.utcnow() - timedelta(hours=hours)
        return (
            db.query(IoTDataPointModel)
            .filter(
                IoTDataPointModel.device_id == device_id,
                IoTDataPointModel.metric_name == metric_name,
                IoTDataPointModel.timestamp >= since,
            )
            .order_by(IoTDataPointModel.timestamp.asc())
            .all()
        )
