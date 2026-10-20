"""
UrbanIQ — SQLite Cache Service with TTL & Bypass Support
=========================================================
Stores geocoding, POI queries, and land-mask queries with strict TTLs:
- POIs: 7 days (604,800 seconds)
- Land mask: 30 days (2,592,000 seconds)
- Geocoding: 14 days (1,209,600 seconds)
Supports cache bypass via `refresh=True` / `?refresh=1`.
"""

import os
import json
import time
import sqlite3
import logging
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger("urbaniq.cache")

DB_PATH = Path(__file__).resolve().parent.parent.parent.parent / "urbaniq.db"

# TTL constants in seconds
TTL_POI_SECONDS = 7 * 86400         # 7 days
TTL_LAND_MASK_SECONDS = 30 * 86400  # 30 days
TTL_GEOCODE_SECONDS = 14 * 86400    # 14 days


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_cache_table():
    """Create api_cache table if it doesn't already exist."""
    try:
        with get_db_connection() as conn:
            conn.execute("""
            CREATE TABLE IF NOT EXISTS api_cache (
                cache_key TEXT PRIMARY KEY,
                cache_type TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at REAL NOT NULL,
                expires_at REAL NOT NULL
            );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_api_cache_type ON api_cache(cache_type);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);")
            conn.commit()
    except Exception as e:
        logger.error("Failed to initialize api_cache table: %s", e)


def get_cached_entry(cache_key: str, bypass: bool = False) -> Optional[Dict[str, Any]]:
    """
    Retrieve cached JSON payload if present and not expired.
    If `bypass=True` (e.g. ?refresh=1), returns None immediately.
    """
    if bypass:
        return None

    init_cache_table()
    now = time.time()
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT data, expires_at FROM api_cache WHERE cache_key = ?",
                (cache_key,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            data_str, expires_at = row["data"], row["expires_at"]
            if now > expires_at:
                # Expired — delete and return None
                conn.execute("DELETE FROM api_cache WHERE cache_key = ?", (cache_key,))
                conn.commit()
                return None
            return json.loads(data_str)
    except Exception as e:
        logger.warning("Error reading from api_cache for key %s: %s", cache_key, e)
        return None


def set_cached_entry(cache_key: str, cache_type: str, data: Dict[str, Any], ttl_seconds: float):
    """Save or update cache entry with TTL."""
    init_cache_table()
    now = time.time()
    expires_at = now + ttl_seconds
    try:
        payload = json.dumps(data)
        with get_db_connection() as conn:
            conn.execute("""
            INSERT INTO api_cache (cache_key, cache_type, data, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET
                cache_type=excluded.cache_type,
                data=excluded.data,
                created_at=excluded.created_at,
                expires_at=excluded.expires_at;
            """, (cache_key, cache_type, payload, now, expires_at))
            conn.commit()
    except Exception as e:
        logger.warning("Error writing to api_cache for key %s: %s", cache_key, e)


# Initialize table on module import
init_cache_table()
