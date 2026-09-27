from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api.endpoints import router as api_router
from backend.app.api.auth import router as auth_router
from backend.app.api.iot import router as iot_router
from backend.app.api.admin import router as admin_router

# Initialize FastAPI application with project metadata
app = FastAPI(
    title="UrbanIQ API",
    description="AI-Powered Urban Opportunity Map Backend API",
    version="0.1.0",
)

# Configure CORS (Cross-Origin Resource Sharing)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(api_router)
app.include_router(auth_router)
app.include_router(iot_router)
app.include_router(admin_router)


@app.get("/")
def read_root():
    """Root endpoint to verify that UrbanIQ API is online."""
    return {"message": "UrbanIQ API is running"}


@app.get("/api/health")
def health_check():
    """Health status endpoint with basic system information."""
    return {
        "status": "healthy",
        "service": "UrbanIQ Backend",
        "environment": "development",
        "version": "0.1.0",
        "data_mode": "prototype",
    }
