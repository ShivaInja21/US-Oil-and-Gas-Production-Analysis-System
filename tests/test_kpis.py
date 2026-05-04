import sys
import os
import pandas as pd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from src.kpis import projected_production, yoy_growth, decline_rate, revenue_estimate
from src.kpis import projected_production_kpi


def test_projected_production_and_revenue():
    s = pd.Series([100, 110, 121], index=[2018, 2019, 2020])
    preds = pd.Series([130], index=[2021])
    val = projected_production(preds, 2021)
    assert val == 130
    rev = revenue_estimate(val, 10)
    assert rev == 1300


def test_yoy_growth_and_decline_rate():
    s = pd.Series([100, 90, 81, 73.0, 65.7], index=[2016, 2017, 2018, 2019, 2020])
    gy = yoy_growth(s, 2018)
    assert round(gy, 4) == round((81 - 90) / 90, 4)
    dr = decline_rate(s, years=3)
    assert dr is not None


def test_projected_production_kpi_structured():
    # build a simple combined DataFrame like forecast_with_pivot would return
    idx = [2018, 2019, 2020, 2021]
    actual = pd.Series([100.0, 110.0, 120.0, None], index=idx)
    forecast = pd.Series([None, None, None, 130.0], index=idx)
    is_forecast = pd.Series([False, False, False, True], index=idx)
    combined = pd.DataFrame({"actual": actual, "forecast": forecast, "is_forecast": is_forecast})

    k = projected_production_kpi(combined, 2021, price_per_unit=10.0, revenue_threshold=1000)
    assert isinstance(k, dict)
    assert k["value"] == 130.0
    assert k["estimated_revenue"] == 1300.0
    # since growth from 2020 (120) to 2021 (130) is positive, recommendation should be Worth pursuing
    assert k["recommendation"] == "Worth pursuing"
