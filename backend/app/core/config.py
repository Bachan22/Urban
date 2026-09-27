import os
from datetime import timedelta

class Settings:
    # JWT Configuration
    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30
    REFRESH_TOKEN_EXPIRE_DAYS = 7
    
    # Database
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://rajeshjha@localhost:5432/urbaniq_db",
    )
    
    # CORS
    ALLOWED_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]
    
    # Redis
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # IoT Configuration
    CACHE_TTL_SECONDS = 300  # 5 minutes

settings = Settings()
