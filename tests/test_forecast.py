import sys
import os
import pandas as pd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from src.forecast import linear_trend_forecast
from src.forecast import forecast_with_pivot


def test_linear_trend_forecast_length_and_increasing():
    # simple increasing series: year -> value = year * 2
    years = [2016, 2017, 2018, 2019]
    values = [x * 2 for x in range(len(years))]
    s = pd.Series(values, index=years)
    preds = linear_trend_forecast(s, 3)
    assert len(preds) == 3
    # predictions should continue the increasing trend
    assert preds.iloc[1] > preds.iloc[0]


def test_forecast_with_pivot_trims_history_and_produces_forecast():
    years = [2016, 2017, 2018, 2019, 2020]
    values = [10, 12, 14, 16, 18]
    s = pd.Series(values, index=years)
    # choose a pivot in the past which trims history
    pivot = 2018
    df = forecast_with_pivot(s, pivot_year=pivot, years_after=2, method="linear")
    # actuals should only be present up to pivot
    assert all(y <= pivot or pd.isna(v) for y, v in df['actual'].items() if not pd.isna(v))
    # forecasts should appear after pivot
    assert any(df['is_forecast'].loc[y] for y in df.index if y > pivot)
