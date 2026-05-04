"""Fetch and cache EIA series for a set of regions.

Usage:
  Ensure EIA_API_KEY is set in your environment, then run:
    python scripts/fetch_all.py

The script writes per-series CSVs to data/cache/ (via src.eia_client) and
creates data/cache/index.json with metadata for each fetched series.
"""
from __future__ import annotations
import os
import json
from pathlib import Path
from src.eia_client import fetch_series


# U.S. Crude Oil Production by State/Region - verified EIA series IDs
REGION_TO_SERIES = {
    "United States": "PET.MCRFPUS1.M",
    "Texas": "PET.MCRFPTX2.M",
    "North Dakota": "PET.MCRFPND2.M",
    "New Mexico": "PET.MCRFPNM2.M",
    "Oklahoma": "PET.MCRFPOK2.M",
    "Colorado": "PET.MCRFPCO2.M",
}


def main():
    key = os.getenv("EIA_API_KEY")
    if not key:
        print("EIA_API_KEY not set. Set it in your environment before running.")
        return

    cache_dir = Path("data/cache")
    cache_dir.mkdir(parents=True, exist_ok=True)
    index = {}
    for region, series_id in REGION_TO_SERIES.items():
        print(f"Fetching {region} -> {series_id} ...")
        try:
            df, meta = fetch_series(series_id, use_cache=False)
        except Exception as e:
            print(f"  Failed to fetch {series_id}: {e}")
            continue
        # fetch_series already writes CSV to cache; record metadata
        index[region] = {"series_id": series_id, "metadata": meta}

    idx_path = cache_dir / "index.json"
    with open(idx_path, "w") as f:
        json.dump(index, f, indent=2)

    print(f"Done. Index written to {idx_path}")


if __name__ == "__main__":
    main()
