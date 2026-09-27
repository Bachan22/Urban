from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.database.connection import get_db
from backend.app.models.tables import UserModel, IoTDeviceModel, IoTDataPointModel
from backend.app.schemas.auth import AdminStats
from backend.app.core.dependencies import get_admin_user
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])


@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(
    admin_user: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get admin dashboard statistics."""
    # Count total users
    total_users = db.query(func.count(UserModel.id)).scalar() or 0
    
    # Count total IoT devices
    total_devices = db.query(func.count(IoTDeviceModel.id)).scalar() or 0
    
    # Count active devices (online status)
    active_devices = (
        db.query(func.count(IoTDeviceModel.id))
        .filter(IoTDeviceModel.status == "online")
        .scalar() or 0
    )
    
    # Count data points from last 24 hours
    since = datetime.utcnow() - timedelta(hours=24)
    data_points_24h = (
        db.query(func.count(IoTDataPointModel.id))
        .filter(IoTDataPointModel.timestamp >= since)
        .scalar() or 0
    )
    
    return {
        "users": total_users,
        "devices": total_devices,
        "active_devices": active_devices,
        "data_points": data_points_24h,
    }


@router.get("/users")
async def list_all_users(
    admin_user: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """List all users (admin only)."""
    users = db.query(UserModel).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "username": u.username,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.get("/devices")
async def list_all_devices(
    admin_user: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """List all IoT devices (admin only)."""
    devices = db.query(IoTDeviceModel).all()
    return devices


@router.patch("/users/{user_id}/activate")
async def activate_user(
    user_id: int,
    admin_user: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Activate or deactivate a user (admin only)."""
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "email": user.email,
        "is_active": user.is_active,
    }


@router.get("/devices/status/overview")
async def get_device_status_overview(
    admin_user: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get overview of device statuses."""
    statuses = (
        db.query(IoTDeviceModel.status, func.count(IoTDeviceModel.id).label("count"))
        .group_by(IoTDeviceModel.status)
        .all()
    )
    return {status: count for status, count in statuses}
