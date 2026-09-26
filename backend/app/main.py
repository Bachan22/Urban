from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Initialize FastAPI application with project metadata
app = FastAPI(
    title="UrbanIQ API",
    description="AI-Powered Urban Opportunity Map Backend API",
    version="0.1.0",
)

# Configure CORS (Cross-Origin Resource Sharing)
# Allows our Vite/React frontend (port 5173) to communicate with this backend (port 8000)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
