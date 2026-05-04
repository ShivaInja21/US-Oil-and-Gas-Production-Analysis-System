"""Fetch an EIA v2 API URL and cache results to data/cache.

Usage:
  # if you have EIA_API_KEY set in env (recommended):
  EIA_API_KEY=your_key python scripts/fetch_eia_v2.py \
      --url "https://api.eia.gov/v2/crude-oil-imports/data/?frequency=monthly&data[0]=quantity&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=5000"

If no API key is provided the script will attempt the request without it but may be rate-limited or blocked.
"""
from __future__ import annotations
import os
import json
from pathlib import Path
from datetime import datetime
import argparse
import requests
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
CACHE_DIR = ROOT / "data" / "cache"
RAW_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def add_api_key_to_url(url: str, key: str | None) -> str:
    if not key:
        return url
    if "api_key=" in url:
        return url
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}api_key={key}"


def fetch_eia_v2(url: str, api_key: str | None = None) -> dict:
    final_url = add_api_key_to_url(url, api_key)
    resp = requests.get(final_url, timeout=30)
    resp.raise_for_status()
    return resp.json()


def save_raw(json_obj: dict, name: str) -> Path:
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    raw_path = RAW_DIR / f"{name}.{ts}.json"
    raw_path.write_text(json.dumps(json_obj, indent=2))
    return raw_path


def data_to_csv(json_obj: dict, region_name: str) -> Path:
    # Expect v2 'data' array
    data = json_obj.get("response", {}).get("data") or json_obj.get("data")
    if data is None:
        # some endpoints use top-level 'data'
        data = json_obj.get("data")
    if data is None:
        raise ValueError("No 'data' field found in EIA response")
    df = pd.DataFrame(data)
    csv_path = CACHE_DIR / f"{region_name.replace(' ','_')}.csv"
    df.to_csv(csv_path, index=False)
    return csv_path


def update_index(region: str, url: str, raw_path: Path, csv_path: Path):
    idx_path = CACHE_DIR / "index.json"
    idx = {}
    if idx_path.exists():
        idx = json.loads(idx_path.read_text())
    idx[region] = {
        "source_url": url,
        "raw_file": str(raw_path),
        "cache_file": str(csv_path),
        "downloaded_at": datetime.utcnow().isoformat(),
    }
    idx_path.write_text(json.dumps(idx, indent=2))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--url", required=True, help="Full EIA v2 API URL")
    p.add_argument("--region", default="eia_v2", help="Region/name to store the CSV under")
    args = p.parse_args()
    api_key = os.getenv("EIA_API_KEY")
    if not api_key:
        print("Warning: EIA_API_KEY not set; attempting request without a key (may fail or be rate-limited).")
    print(f"Fetching EIA v2 URL for region '{args.region}'...")
    j = fetch_eia_v2(args.url, api_key)
    raw_path = save_raw(j, args.region)
    csv_path = data_to_csv(j, args.region)
    update_index(args.region, args.url, raw_path, csv_path)
    print(f"Saved raw JSON to: {raw_path}")
    print(f"Saved CSV to: {csv_path}")


if __name__ == "__main__":
    main()
