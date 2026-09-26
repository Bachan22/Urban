import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Database URL defaulting to local PostgreSQL on port 5432
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://rajeshjha@localhost:5432/urbaniq_db",
)

# Initialize SQLAlchemy engine
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
