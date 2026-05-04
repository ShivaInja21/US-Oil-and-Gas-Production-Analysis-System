"""KPI calculation helpers used by the Streamlit app.
"""
from __future__ import annotations
import pandas as pd
from typing import Optional


def projected_production(forecast_series: pd.Series, year: int) -> Optional[float]:
    try:
        return float(forecast_series.loc[year])
    except Exception:
        return None


def yoy_growth(series: pd.Series, year: int) -> Optional[float]:
    try:
        return (series.loc[year] - series.loc[year - 1]) / series.loc[year - 1]
    except Exception:
        return None


def decline_rate(series: pd.Series, years: int = 5) -> Optional[float]:
    """Compute average annual decline rate over the last `years` years as a fraction.

    Returns None on failure.
    """
    if series.empty:
        return None
    s = series.dropna()
    if len(s) < 2:
        return None
    recent = s.iloc[-years:]
    # fit linear slope
    idx = recent.index.astype(int)
    vals = recent.values.astype(float)
    A = (idx - idx[0]).astype(float)
    # slope per year
    slope = (vals[-1] - vals[0]) / (idx[-1] - idx[0]) if idx[-1] != idx[0] else 0.0
    # express as fraction of starting value
    frac = slope / vals[0] if vals[0] != 0 else None
    return frac


def revenue_estimate(volume: float, price_per_unit: float) -> float:
    return float(volume) * float(price_per_unit)


def projected_production_kpi(combined_df: pd.DataFrame, year: int, price_per_unit: Optional[float] = None,
                             revenue_threshold: Optional[float] = None) -> dict:
    """Compute a structured KPI for Projected Production for a selected year.

    Inputs:
    - combined_df: DataFrame produced by `forecast_with_pivot` with columns ['actual','forecast','is_forecast']
      and integer year index.
    - year: integer year for which to surface the KPI.
    - price_per_unit: optional price to estimate revenue in the same units as volume.
    - revenue_threshold: optional numeric threshold to help produce a binary recommendation.

    Output: a dict with keys:
    - label: human-friendly label
    - value: projected volume (float) or None
    - unit: string (e.g., 'barrels')
    - is_forecast: bool or None
    - confidence: float in [0,1]
    - recommendation: short string answer to "Is this region worth pursuing?"
    - estimated_revenue: optional float
    - pct_change: optional float (year-over-year change fraction)
    - provenance: small dict with context (last_actual, last_actual_year)

    This function is intentionally lightweight and uses simple heuristics for
    confidence and recommendation so the app can explain decisions deterministically.
    """
    out = {
        "label": f"Projected production ({year})",
        "value": None,
        "unit": "barrels",
        "is_forecast": None,
        "confidence": 0.0,
        "recommendation": "Insufficient data",
        "estimated_revenue": None,
        "pct_change": None,
        "provenance": {},
    }

    if combined_df is None or combined_df.empty:
        return out

    # prefer actual if available for the year, otherwise forecast
    try:
        val_actual = combined_df["actual"].get(year) if "actual" in combined_df.columns else None
    except Exception:
        val_actual = None
    try:
        val_fore = combined_df["forecast"].get(year) if "forecast" in combined_df.columns else None
    except Exception:
        val_fore = None

    value = None
    is_fore = None
    if pd.notna(val_actual):
        value = float(val_actual)
        is_fore = False
    elif pd.notna(val_fore):
        value = float(val_fore)
        is_fore = True

    out["value"] = value
    out["is_forecast"] = is_fore

    # provenance: last actual year and value
    try:
        last_actual_series = combined_df["actual"].dropna()
        last_actual_year = int(last_actual_series.index[-1]) if len(last_actual_series) else None
        last_actual_value = float(last_actual_series.iloc[-1]) if len(last_actual_series) else None
    except Exception:
        last_actual_year = None
        last_actual_value = None

    out["provenance"] = {"last_actual_year": last_actual_year, "last_actual_value": last_actual_value}

    # pct change vs prior year (use combined actual+forecast series)
    try:
        combined_values = combined_df["actual"].combine_first(combined_df["forecast"]).astype(float)
        if year in combined_values.index and (year - 1) in combined_values.index and pd.notna(combined_values.get(year - 1)):
            out["pct_change"] = (combined_values.loc[year] - combined_values.loc[year - 1]) / combined_values.loc[year - 1]
    except Exception:
        out["pct_change"] = None

    # estimated revenue
    if value is not None and price_per_unit is not None:
        try:
            est_rev = revenue_estimate(value, price_per_unit)
            out["estimated_revenue"] = est_rev
        except Exception:
            out["estimated_revenue"] = None

    # A simple confidence heuristic
    if value is None:
        out["confidence"] = 0.0
        out["recommendation"] = "Insufficient data"
        return out

    # base confidence: more if value is actual, less if forecasted
    out["confidence"] = 0.9 if is_fore is False else 0.6

    # boost/dampen confidence by how recent the last actual is relative to the forecast year
    if last_actual_year is not None:
        years_gap = year - last_actual_year
        if years_gap <= 0:
            out["confidence"] = min(1.0, out["confidence"] + 0.05)
        else:
            # penalize for longer extrapolations (simple rule)
            out["confidence"] = max(0.1, out["confidence"] - 0.05 * years_gap)

    # recommendation heuristic
    recommend = "Consider further analysis"
    try:
        # if growth positive or projected >= last actual -> favorable
        if out.get("pct_change") is not None and out["pct_change"] > 0:
            recommend = "Worth pursuing"
        elif last_actual_value is not None and value >= last_actual_value:
            recommend = "Worth pursuing"

        # if revenue threshold set, use it as a hard cutoff
        if revenue_threshold is not None and out.get("estimated_revenue") is not None:
            if out["estimated_revenue"] >= revenue_threshold:
                recommend = "Worth pursuing"
            else:
                recommend = "Likely not a priority"
    except Exception:
        recommend = "Consider further analysis"

    out["recommendation"] = recommend
    return out
