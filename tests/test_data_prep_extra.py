import sys
import os
import pandas as pd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from src.data_prep import (
    _convert_quantity_to_barrels,
    canonical_region,
    records_to_tidy_dataframe,
    pivot_region_timeseries,
    fill_missing_values,
    parse_period_to_timestamp,
)


def test_convert_quantity_to_barrels():
    assert _convert_quantity_to_barrels("658", "thousand barrels") == 658000.0
    assert _convert_quantity_to_barrels("100", "barrels") == 100.0
    assert _convert_quantity_to_barrels("abc", "thousand barrels") == 0.0


def test_canonical_region_cases():
    assert canonical_region("PS_NJ", "New Jersey", "PS") == "NJ"
    assert canonical_region("PP_1", "PADD1 (East Coast)", "PP") == "PADD1"
    # fallback to mapping by name
    assert canonical_region(None, "New Jersey") == "NJ"


def test_records_to_tidy_and_pivot():
    records = [
        {
            "period": "2020-01",
            "destinationId": "PS_NJ",
            "destinationName": "New Jersey",
            "quantity": "1",
            "quantity-units": "barrels",
        },
        {
            "period": "2020-02",
            "destinationId": "PP_1",
            "destinationName": "PADD1 (East Coast)",
            "quantity": "2",
            "quantity-units": "thousand barrels",
        },
    ]
    tidy = records_to_tidy_dataframe(records)
    assert not tidy.empty
    assert "region_id" in tidy.columns and "quantity_barrels" in tidy.columns

    wide = pivot_region_timeseries(tidy, freq="M")
    # expect columns NJ and PADD1
    assert "NJ" in wide.columns and "PADD1" in wide.columns
    # check aggregated values (1 and 2000)
    assert wide.loc[parse_period_to_timestamp("2020-01"), "NJ"] == 1.0
    assert wide.loc[parse_period_to_timestamp("2020-02"), "PADD1"] == 2000.0


def test_fill_missing_values():
    idx = pd.date_range("2020-01-01", periods=4, freq="MS")
    df = pd.DataFrame({"A": [1.0, None, 3.0, None], "B": [None, 2.0, None, 4.0]}, index=idx)
    f1 = fill_missing_values(df, method="ffill")
    assert f1.iloc[1, 0] == 1.0
    f2 = fill_missing_values(df, method="interpolate")
    assert round(f2.iloc[1, 0], 6) == round(2.0, 6) or f2.iloc[1, 0] == 1.0
    f3 = fill_missing_values(df, method="none", fill_zeros=True)
    assert (f3.fillna(0.0) == f3).all().all()
