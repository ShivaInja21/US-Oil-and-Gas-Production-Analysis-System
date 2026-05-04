import sys
import os
import pandas as pd

# Make sure repo root is importable for `src` package imports during tests
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from src.data_prep import parse_period_to_timestamp, to_annual_series


def test_parse_period_year():
    ts = parse_period_to_timestamp("2020")
    assert ts.year == 2020


def test_parse_period_month():
    ts = parse_period_to_timestamp("202001")
    assert ts.year == 2020 and ts.month == 1


def test_to_annual_series_aggregates():
    df = pd.DataFrame({
        "period": ["202001", "202002", "202101"],
        "value": [10, 20, 30],
    })
    s = to_annual_series(df)
    assert 2020 in s.index and 2021 in s.index
    assert s.loc[2020] == 30
    assert s.loc[2021] == 30
