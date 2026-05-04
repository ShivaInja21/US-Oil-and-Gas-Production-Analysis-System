"""Simple EIA API client with lightweight caching to CSV files.

This module provides fetch_series which returns a pandas.DataFrame with
columns ['period', 'value'] and a metadata dict with series_id and fetched_at.

Environment variable EIA_API_KEY is used for authentication.
"""
from __future__ import annotations
import os
import requests
import pandas as pd
from datetime import datetime
from pathlib import Path
from functools import lru_cache

EIA_API_KEY = os.getenv("EIA_API_KEY")
BASE_URL = "https://api.eia.gov/v2/seriesid/"

# Determine cache directory based on environment
def _get_cache_dir():
    # Check if we're in Vercel serverless environment
    if os.path.exists("/tmp") and os.environ.get("VERCEL"):
        return Path("/tmp/cache")
    
    # Check for data/cache (standard location)
    root_cache = Path("data/cache")
    if root_cache.exists():
        return root_cache
    
    # Default fallback
    return Path("data/cache")

CACHE_DIR = _get_cache_dir()
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def build_series_url(series_id: str, api_key: str | None = None) -> str:
    key = api_key or EIA_API_KEY
    if not key:
        raise RuntimeError(
            "EIA_API_KEY environment variable is not set. "
            "Set it in Vercel dashboard under Settings > Environment Variables"
        )
    return f"{BASE_URL}{series_id}?api_key={key}"


def _cache_path(series_id: str) -> Path:
    safe = series_id.replace("/", "_")
    return CACHE_DIR / f"{safe}.csv"


def fetch_series(series_id: str, use_cache: bool = True) -> tuple[pd.DataFrame, dict]:
    """Fetch a series from the EIA API and return (df, metadata).

    The DataFrame contains columns ['period','value'] where 'period' is a string
    like '2020' or '202001' depending on frequency. Caller should parse to
    timestamps as needed.
    """
    cache_file = _cache_path(series_id)
    if use_cache and cache_file.exists():
        df = pd.read_csv(cache_file)
        metadata = {"series_id": series_id, "fetched_at": cache_file.stat().st_mtime}
        return df, metadata

    # If no API key and no cache, raise a helpful error
    if not EIA_API_KEY:
        raise RuntimeError(
            f"EIA_API_KEY not set and no cached data found for {series_id}. "
            "Please set EIA_API_KEY environment variable or ensure cached data exists."
        )

    url = build_series_url(series_id)
    resp = requests.get(url, timeout=20)
    resp.raise_for_status()
    payload = resp.json()
    # v2 API structure
    if "response" not in payload or "data" not in payload["response"]:
        raise ValueError(f"No data found for {series_id}")
    raw = payload["response"]["data"]
    # v2 API returns data with 'period' and 'value' fields
    df = pd.DataFrame(raw)
    # Keep only period and value columns for consistency
    if "period" in df.columns and "value" in df.columns:
        df = df[["period", "value"]]
    else:
        raise ValueError(f"Unexpected data structure for {series_id}")
    # persist cache
    df.to_csv(cache_file, index=False)
    metadata = {"series_id": series_id, "fetched_at": datetime.utcnow().isoformat()}
    return df, metadata


@lru_cache(maxsize=64)
def fetch_series_cached(series_id: str) -> tuple[pd.DataFrame, dict]:
    """Wrapper that uses an in-memory LRU cache as well as on-disk caching."""
    return fetch_series(series_id, use_cache=True)
