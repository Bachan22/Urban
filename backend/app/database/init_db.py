import sys
import os

# Add project root to PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))

from backend.app.database.connection import engine, Base, SessionLocal
from backend.app.models.tables import CityModel, ZoneModel, UserModel, UserRole
from backend.app.core.security import get_password_hash


def init_database():
    """Create all tables in PostgreSQL and seed initial cities and zones."""
    print("Creating all tables in PostgreSQL (urbaniq_db)...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")

    db = SessionLocal()
    try:
        # Check if Pune is already seeded
        existing_pune = db.query(CityModel).filter_by(id="pune").first()
        if not existing_pune:
            print("Seeding initial cities...")
            pune = CityModel(
                id="pune",
                name="Pune",
                state="Maharashtra",
                latitude=18.5204,
                longitude=73.8567,
                study_radius_km=20.0,
                observed_population=3556000,
                data_source="Pune Municipal Corporation ESR 2021-22",
                data_confidence="Estimated / Proxy (PMC 2021-22)",
            )
            mumbai = CityModel(
                id="mumbai",
                name="Mumbai",
                state="Maharashtra",
                latitude=19.0760,
                longitude=72.8777,
                study_radius_km=25.0,
                observed_population=12442373,
                data_source="Census of India 2011 (Proxy Baseline)",
                data_confidence="Historical Census Proxy",
            )
            nashik = CityModel(
                id="nashik",
                name="Nashik",
                state="Maharashtra",
                latitude=19.9975,
                longitude=73.7898,
                study_radius_km=15.0,
                observed_population=1486053,
                data_source="Census of India 2011 (Proxy Baseline)",
                data_confidence="Historical Census Proxy",
            )
            db.add_all([pune, mumbai, nashik])
            db.commit()
            print("Cities seeded.")

        # Seed initial Pune zones
        existing_zone = db.query(ZoneModel).filter_by(id="pune_kothrud").first()
        if not existing_zone:
            print("Seeding initial Pune study zones...")
            zones = [
                ZoneModel(
                    id="pune_kothrud",
                    city_id="pune",
                    name="Kothrud",
                    latitude=18.5074,
                    longitude=73.8077,
                    radius_meters=2000.0,
                    population_proxy=150000,
                    transit_accessibility_score=85.0,
                ),
                ZoneModel(
                    id="pune_hinjawadi",
                    city_id="pune",
                    name="Hinjawadi Phase 1",
                    latitude=18.5913,
                    longitude=73.7389,
                    radius_meters=2500.0,
                    population_proxy=120000,
                    transit_accessibility_score=65.0,
                ),
                ZoneModel(
                    id="pune_viman_nagar",
                    city_id="pune",
                    name="Viman Nagar",
                    latitude=18.5679,
                    longitude=73.9143,
                    radius_meters=2000.0,
                    population_proxy=95000,
                    transit_accessibility_score=80.0,
                ),
            ]
            db.add_all(zones)
            db.commit()
        # Seed initial users
        existing_admin = db.query(UserModel).filter_by(email="admin@example.com").first()
        if not existing_admin:
            print("Seeding initial users...")
            admin_user = UserModel(
                email="admin@example.com",
                username="admin",
                full_name="Admin User",
                hashed_password=get_password_hash("admin123"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            test_user = UserModel(
                email="test@example.com",
                username="testuser",
                full_name="Test User",
                hashed_password=get_password_hash("password123"),
                role=UserRole.USER,
                is_active=True,
            )
            db.add_all([admin_user, test_user])
            db.commit()
            print("Users seeded.")

        print("Database initialization complete.")
    finally:
        db.close()


if __name__ == "__main__":
    init_database()
