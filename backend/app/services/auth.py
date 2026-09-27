from __future__ import annotations

from sqlalchemy.orm import Session
from backend.app.models.tables import UserModel, UserRole
from backend.app.schemas.auth import UserCreate, UserLogin
from backend.app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
)


class AuthService:
    @staticmethod
    def create_user(db: Session, user_data: UserCreate) -> UserModel:
        """Create a new user with hashed password."""
        db_user = UserModel(
            email=user_data.email,
            username=user_data.username,
            full_name=user_data.full_name,
            hashed_password=get_password_hash(user_data.password),
            role=UserRole.USER,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def authenticate_user(db: Session, login_data: UserLogin) -> UserModel | None:
        """Authenticate user and return user object if credentials are valid."""
        user = db.query(UserModel).filter(UserModel.email == login_data.email).first()
        if not user or not verify_password(login_data.password, user.hashed_password):
            return None
        return user

    @staticmethod
    def get_user_by_email(db: Session, email: str) -> UserModel | None:
        """Get user by email."""
        return db.query(UserModel).filter(UserModel.email == email).first()

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> UserModel | None:
        """Get user by username."""
        return db.query(UserModel).filter(UserModel.username == username).first()

    @staticmethod
    def generate_tokens(user: UserModel) -> dict:
        """Generate access and refresh tokens for user."""
        access_token = create_access_token({"sub": user.id})
        refresh_token = create_refresh_token({"sub": user.id})
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }
