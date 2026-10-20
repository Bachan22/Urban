import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from backend/.env if present
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()

# Database URL defaulting to SQLite for portable local development
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./urbaniq.db",
)

# Initialize SQLAlchemy engine
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,  # Automatically verifies connection liveness before queries
    )

# SessionLocal factory creates a new database session for each request
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base for all ORM models to inherit from
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a database session and closes it after the request completes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
