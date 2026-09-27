from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.schemas.auth import UserCreate, UserLogin, TokenResponse, TokenRefresh, UserResponse
from backend.app.services.auth import AuthService
from backend.app.core.security import decode_token
from backend.app.models.tables import UserModel

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if user already exists
    existing_email = AuthService.get_user_by_email(db, user_data.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    existing_username = AuthService.get_user_by_username(db, user_data.username)
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )
    
    # Create user
    user = AuthService.create_user(db, user_data)
    
    # Generate tokens
    tokens = AuthService.generate_tokens(user)
    
    return tokens


@router.post("/login", response_model=TokenResponse)
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """Login user and get tokens."""
    user = AuthService.authenticate_user(db, login_data)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    tokens = AuthService.generate_tokens(user)
    return tokens


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_data: TokenRefresh):
    """Refresh access token using refresh token."""
    payload = decode_token(refresh_data.refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    
    access_token = AuthService.generate_tokens({"id": user_id})["access_token"]
    return {
        "access_token": access_token,
        "refresh_token": refresh_data.refresh_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    current_user: UserModel = Depends(lambda db: db),  # placeholder
):
    """Get current user info."""
    from backend.app.core.dependencies import get_current_user
    return current_user
