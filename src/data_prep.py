"""Data preparation helpers: convert EIA series frames into timeseries.

Functions here are intentionally small and focused: parse_period, to_annual_series.
"""
from __future__ import annotations
import pandas as pd
from typing import Tuple, List, Dict, Optional
import json
from pathlib import Path


def parse_period_to_timestamp(period: str) -> pd.Timestamp:
    """Parse EIA 'period' strings to pandas.Timestamp.

    Examples:
    - '2020' -> 2020-01-01
    - '202001' -> 2020-01-01
    - '2020Q1' -> 2020-01-01 (approx)
    """
    s = str(period)
    if s.isdigit() and len(s) == 4:
        return pd.Timestamp(f"{s}-01-01")
    if s.isdigit() and len(s) == 6:
        return pd.Timestamp(f"{s[:4]}-{s[4:6]}-01")
    # handle quarterly formats like 2020Q1 or Q12020
    if "Q" in s.upper():
        digits = "".join(ch for ch in s if ch.isdigit())
        if len(digits) >= 4:
            year = digits[:4]
            q = [c for c in s.upper() if c in "1234"]
            quarter = int(q[0]) if q else 1
            month = (quarter - 1) * 3 + 1
            return pd.Timestamp(f"{year}-{month:02d}-01")
    # try pandas to parse common ISO-like formats (e.g., '2026-01' or '2026-01-01')
    try:
        ts = pd.to_datetime(s, errors="coerce", infer_datetime_format=True)
        if pd.notna(ts):
            # normalize to first of period (month)
            return pd.Timestamp(year=ts.year, month=ts.month, day=1)
    except Exception:
        pass
    return pd.NaT


def to_annual_series(df: pd.DataFrame, period_col: str = "period", value_col: str = "value") -> pd.Series:
    """Convert a EIA-style DataFrame to an annual pandas.Series indexed by int year.

    The function will aggregate by year if needed (sum) and return a Series with
    integer years as index.
    """
    df = df.copy()
    df["ts"] = df[period_col].astype(str).map(parse_period_to_timestamp)
    df = df.dropna(subset=["ts"])
    df["year"] = df["ts"].dt.year
    # convert value to numeric
    df[value_col] = pd.to_numeric(df[value_col], errors="coerce")
    annual = df.groupby("year")[value_col].sum().sort_index()
    annual.index = annual.index.astype(int)
    return annual


def _convert_quantity_to_barrels(quantity: str | int | float, units: Optional[str]) -> float:
    """Convert EIA quantity into barrels (float).

    Handles strings like '658' and units like 'thousand barrels'.
    Unknown units will return the numeric value as-is.
    """
    try:
        q = float(quantity)
    except Exception:
        return 0.0
    if not units:
        return q
    u = units.lower().strip()
    if "thousand" in u and "barrel" in u:
        return q * 1_000.0
    if "barrel" in u:
        return q
    # fallback: return numeric value
    return q


_STATE_NAME_TO_ABBR: Dict[str, str] = {
    # minimal mapping for common states - expand as needed
    "alabama": "AL",
    "alaska": "AK",
    "arizona": "AZ",
    "arkansas": "AR",
    "california": "CA",
    "new jersey": "NJ",
    "louisiana": "LA",
    "delaware": "DE",
    "united states": "US",
}


def canonical_region(destination_id: Optional[str], destination_name: Optional[str], destination_type: Optional[str] = None) -> str:
    """Produce a canonical region identifier from EIA destination fields.

    Strategy (practical, not exhaustive):
    - If `destination_id` == 'US' -> 'US'
    - If `destination_id` contains '_' and a known prefix (PS, RS, PT, PP, RP) try to extract meaningful suffix
      * PS/RS -> state abbreviation (PS_NJ -> NJ)
      * PP with numeric suffix -> PADD{n} (PP_1 -> PADD1)
    - Otherwise fall back to a cleaned uppercase version of `destination_name` or the raw id.
    """
    if destination_id:
        did = str(destination_id)
        if did.upper() == "US":
            return "US"
        if "_" in did:
            prefix, suffix = did.split("_", 1)
            prefix = prefix.upper()
            if prefix in ("PS", "RS"):
                # state-like codes PS_NJ, RS_NJ
                return suffix.upper()
            if prefix == "PP":
                # PP_1 -> PADD1
                if suffix.isdigit():
                    return f"PADD{suffix}"
                return suffix.upper()
            # ports and refineries often have PT_ or RF_ codes; use destination_name when available
    # fallback to name mapping
    if destination_name:
        name = str(destination_name).strip().lower()
        if name in _STATE_NAME_TO_ABBR:
            return _STATE_NAME_TO_ABBR[name]
        # use a cleaned uppercase name token (first word)
        return name.title()
    # last resort
    return str(destination_id or "unknown").upper()


def records_to_tidy_dataframe(records: List[dict]) -> pd.DataFrame:
    """Convert raw EIA API 'data' records into a tidy DataFrame.

    Output columns: ['period','ts','region_id','region_name','quantity_barrels'] plus originals.
    """
    rows = []
    for r in records:
        period = r.get("period")
        dest_id = r.get("destinationId") or r.get("destination_id")
        dest_name = r.get("destinationName") or r.get("destination_name")
        units = r.get("quantity-units") or r.get("quantity_units") or r.get("quantity_units")
        qty = _convert_quantity_to_barrels(r.get("quantity"), units)
        region = canonical_region(dest_id, dest_name, r.get("destinationType"))
        ts = parse_period_to_timestamp(str(period))
        rows.append({
            "period": period,
            "ts": ts,
            "region_id": region,
            "region_name": dest_name,
            "quantity_barrels": qty,
            **r,
        })
    df = pd.DataFrame(rows)
    # drop rows without parsed timestamp
    df = df.dropna(subset=["ts"]) if not df.empty else df
    return df


def pivot_region_timeseries(df: pd.DataFrame, freq: str = "M", value_col: str = "quantity_barrels") -> pd.DataFrame:
    """Return a wide DataFrame with datetime index (period start) and one column per region.

    - `freq` should be a pandas offset alias (e.g., 'M' for monthly, 'A' for annual).
    - Missing periods for a region will appear as NaN; caller can fill using fill_missing_values.
    """
    if df.empty:
        return pd.DataFrame()
    # ensure ts is a Timestamp
    df = df.copy()
    df["ts"] = pd.to_datetime(df["ts"])
    # normalize to period start based on freq
    if freq.upper() == "A":
        df["period_ts"] = df["ts"].dt.to_period("A").dt.to_timestamp()
    else:
        df["period_ts"] = df["ts"].dt.to_period(freq).dt.to_timestamp()
    grouped = df.groupby(["period_ts", "region_id"])[value_col].sum().reset_index()
    wide = grouped.pivot(index="period_ts", columns="region_id", values=value_col).sort_index()
    wide.index.name = "ts"
    return wide


def fill_missing_values(df: pd.DataFrame, method: str = "ffill", limit: Optional[int] = None, fill_zeros: bool = False) -> pd.DataFrame:
    """Fill missing values in a wide timeseries DataFrame.

    - method: 'ffill', 'bfill', 'interpolate', or 'none'
    - limit: maximum consecutive NaNs to fill
    - fill_zeros: after other methods, replace remaining NaNs with 0.0 if True
    """
    out = df.copy()
    if method == "ffill":
        out = out.fillna(method="ffill", limit=limit)
    elif method == "bfill":
        out = out.fillna(method="bfill", limit=limit)
    elif method == "interpolate":
        out = out.interpolate(limit=limit)
    # optional fallback
    if fill_zeros:
        out = out.fillna(0.0)
    return out


def create_structured_layer_from_eia_raw(json_path: str | Path, out_path: str | Path | None = None, freq: str = "M") -> pd.DataFrame:
    """Read a raw EIA JSON file (as returned by fetch_all) and produce a cleaned wide timeseries DataFrame.

    Writes to `out_path` if provided (Parquet preferred, falls back to CSV extension).
    Returns the DataFrame for immediate use.
    """
    p = Path(json_path)
    with p.open("r", encoding="utf-8") as fh:
        payload = json.load(fh)
    records = []
    # payload may store data under response->data
    if isinstance(payload, dict) and "response" in payload and "data" in payload["response"]:
        records = payload["response"]["data"]
    elif isinstance(payload, dict) and "data" in payload:
        records = payload["data"]
    else:
        raise ValueError("Unrecognized EIA raw JSON structure")
    tidy = records_to_tidy_dataframe(records)
    wide = pivot_region_timeseries(tidy, freq=freq)
    if out_path:
        out = Path(out_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        if out.suffix.lower() == ".parquet":
            wide.to_parquet(out)
        else:
            wide.to_csv(out)
    return wide
