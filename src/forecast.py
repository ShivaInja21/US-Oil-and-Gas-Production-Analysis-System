"""Forecasting helpers: linear trend and optional SARIMAX wrapper.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from typing import Optional


def linear_trend_forecast(ts: pd.Series, years_ahead: int) -> pd.Series:
    """Simple linear trend forecast using ordinary least squares on time index.

    Returns a pandas.Series indexed by integer years for the forecast horizon.
    """
    if ts.empty:
        return pd.Series(dtype=float)
    # x as 0..n-1
    X = np.arange(len(ts)).reshape(-1, 1)
    y = ts.values.astype(float)
    # closed-form linear regression
    A = np.hstack([X, np.ones_like(X)])
    coef, intercept = np.linalg.lstsq(A, y, rcond=None)[0]
    start = int(ts.index[-1])
    future_idx = [start + i + 1 for i in range(years_ahead)]
    future_X = np.arange(len(ts), len(ts) + years_ahead)
    preds = coef * future_X + intercept
    return pd.Series(preds, index=future_idx)


def sarimax_forecast(ts: pd.Series, years_ahead: int, order: tuple[int, int, int] = (1, 1, 1)) -> pd.Series:
    """Optional SARIMAX forecasting. If statsmodels not available, raise ImportError.
    """
    try:
        from statsmodels.tsa.statespace.sarimax import SARIMAX
    except Exception as e:
        raise ImportError("statsmodels is required for sarimax_forecast") from e
    model = SARIMAX(ts, order=order, enforce_stationarity=False, enforce_invertibility=False)
    res = model.fit(disp=False)
    preds = res.get_forecast(steps=years_ahead).predicted_mean
    # Ensure integer year index continuing from ts.index[-1]
    start = int(ts.index[-1])
    preds.index = [start + i + 1 for i in range(len(preds))]
    return preds


def forecast_with_pivot(ts: pd.Series, pivot_year: int, years_after: int = 5, method: str = "linear") -> pd.DataFrame:
        """Produce a combined historical+forecast DataFrame anchored at a pivot year.

        Contract:
        - inputs:
            - ts: pandas.Series indexed by integer years (actuals)
            - pivot_year: the year from which forecasts should start
            - years_after: how many years of forecast to show starting from pivot_year
            - method: 'linear' or 'sarimax' (if statsmodels is installed).
        - output: DataFrame with index = integer years and two columns:
            - 'actual': actual values (NaN where no actual exists)
            - 'forecast': forecasted values from pivot_year through pivot_year + years_after - 1
            - 'is_forecast': boolean flag where True indicates forecasted value

        Forecasting methodology:
        - We fit the chosen model to all available historical data.
        - Forecasts begin at `pivot_year` and continue for `years_after` years.
        - Default linear method uses an OLS fit on the ordinal time index (simple,
            explainable trend). SARIMAX may be used when available for more refined
            temporal structure.

        This function favors clarity and reproducibility over opaque modelling.
        """
        if ts is None or ts.empty:
                return pd.DataFrame(columns=["actual", "forecast", "is_forecast"])  # empty

        # ensure integer year index
        idx = [int(x) for x in ts.index]
        ts = pd.Series(ts.values.astype(float), index=idx)
        ts = ts.sort_index()

        last_actual = int(ts.index[-1])
        
        # Use all historical data for training
        hist = ts.copy()

        # forecast horizon: from pivot_year through pivot_year + years_after - 1
        forecast_start = pivot_year
        forecast_end = pivot_year + years_after - 1
        horizon = forecast_end - last_actual
        forecasts = pd.Series(dtype=float)
        if horizon > 0:
                if method == "sarimax":
                        try:
                                preds = sarimax_forecast(hist, horizon)
                        except ImportError:
                                # fallback to linear if statsmodels missing
                                preds = linear_trend_forecast(hist, horizon)
                else:
                        preds = linear_trend_forecast(hist, horizon)
                forecasts = preds

        # build combined index
        start_year = int(ts.index[0])
        all_years = list(range(start_year, forecast_end + 1))

        actual_col = pd.Series(index=all_years, dtype=float)
        forecast_col = pd.Series(index=all_years, dtype=float)
        is_forecast = pd.Series(False, index=all_years)

        # fill actuals from historical data
        for y, v in ts.items():
                actual_col.at[y] = v

        # fill forecasts from pivot_year onward
        for y, v in forecasts.items():
                if int(y) >= forecast_start:
                        forecast_col.at[int(y)] = float(v)
                        is_forecast.at[int(y)] = True

        out = pd.DataFrame({"actual": actual_col, "forecast": forecast_col, "is_forecast": is_forecast})
        return out
