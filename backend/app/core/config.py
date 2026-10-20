import os
import re
import json
import logging
import urllib.request
from typing import Tuple, List, Optional
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env if present
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

logger = logging.getLogger("urbaniq.config")


class Settings:
    # JWT Configuration
    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30
    REFRESH_TOKEN_EXPIRE_DAYS = 7
    
    # Database
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "sqlite:///./urbaniq.db",
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

    # Provider-Agnostic LLM Configuration (Stage D/E foundation)
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "groq").lower()
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
    # Google Maps Platform (Competitors & Geocoding)
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")
    GOOGLE_DAILY_CALL_CAP: int = int(os.getenv("GOOGLE_DAILY_CALL_CAP", "300"))


settings = Settings()


def strip_think_tags(text: str) -> str:
    """
    Remove reasoning model thoughts (<think>...</think>) before parsing JSON
    to prevent syntax errors from reasoning models like Qwen/DeepSeek.
    """
    if not text:
        return ""
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    return cleaned.strip()


def validate_groq_model(model_name: Optional[str] = None, api_key: Optional[str] = None) -> Tuple[bool, List[str]]:
    """
    Query GET https://api.groq.com/openai/v1/models at startup or lazily
    to ensure the configured model ID actually exists on Groq Cloud.
    Logs an explicit error with all available models if missing.
    """
    model_name = model_name or settings.GROQ_MODEL
    api_key = api_key or settings.GROQ_API_KEY

    if not api_key:
        logger.warning("GROQ_API_KEY is not configured; skipping Groq model verification.")
        return False, []

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/models",
        headers={
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "UrbanIQ/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            available = [m.get("id") for m in data.get("data", []) if m.get("id")]
            if model_name in available:
                logger.info("Groq model '%s' validated successfully.", model_name)
                return True, available
            else:
                logger.error(
                    "Configured GROQ_MODEL '%s' NOT FOUND in Groq models list! Available models: %s",
                    model_name, available
                )
                return False, available
    except Exception as e:
        logger.error("Failed to query Groq models list for validation: %s", e)
        return False, []
