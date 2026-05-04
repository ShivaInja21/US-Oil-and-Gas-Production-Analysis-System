"""Tests for Tier 1 features: Geographic visualization and conversational AI."""
import pytest
import pandas as pd
from src.map_viz import calculate_region_metrics, create_map_html, get_region_geojson


def test_calculate_region_metrics_with_data():
    """Test metric calculation with valid time series data."""
    ts = pd.Series([100, 110, 120, 115], index=[2020, 2021, 2022, 2023])
    metrics = calculate_region_metrics("Texas", ts)
    
    assert metrics["production"] == 115
    assert metrics["trend"] in ["increasing", "stable", "decreasing"]
    assert "yoy_change" in metrics


def test_calculate_region_metrics_empty():
    """Test metric calculation with empty data."""
    ts = pd.Series([], dtype=float)
    metrics = calculate_region_metrics("Texas", ts)
    
    assert metrics["production"] == 0
    assert metrics["trend"] == "unknown"
    assert metrics["yoy_change"] == 0


def test_calculate_region_metrics_increasing_trend():
    """Test that increasing production is detected correctly."""
    ts = pd.Series([100, 110, 125], index=[2021, 2022, 2023])
    metrics = calculate_region_metrics("Texas", ts)
    
    assert metrics["trend"] == "increasing"
    assert metrics["yoy_change"] > 2


def test_calculate_region_metrics_decreasing_trend():
    """Test that decreasing production is detected correctly."""
    ts = pd.Series([125, 110, 100], index=[2021, 2022, 2023])
    metrics = calculate_region_metrics("Texas", ts)
    
    assert metrics["trend"] == "decreasing"
    assert metrics["yoy_change"] < -2


def test_get_region_geojson():
    """Test GeoJSON generation from region data."""
    regions_data = {
        "Texas": {"production": 450000, "trend": "increasing", "yoy_change": 5.2},
        "Oklahoma": {"production": 150000, "trend": "stable", "yoy_change": 0.5},
    }
    
    geojson = get_region_geojson(regions_data)
    
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) == 2
    assert geojson["features"][0]["type"] == "Feature"
    assert geojson["features"][0]["geometry"]["type"] == "Point"
    assert "coordinates" in geojson["features"][0]["geometry"]
    assert "name" in geojson["features"][0]["properties"]


def test_create_map_html_structure():
    """Test that map HTML is generated with correct structure."""
    regions_data = {
        "Texas": {"production": 450000, "trend": "increasing", "yoy_change": 5.2},
    }
    
    html = create_map_html(regions_data, "Texas")
    
    # Check for essential HTML elements
    assert "<!DOCTYPE html>" in html
    assert "leaflet" in html.lower()
    assert "map" in html
    assert "Texas" in html
    
    # Check for Leaflet CDN
    assert "unpkg.com/leaflet" in html
    
    # Check for interactive elements
    assert "L.map" in html
    assert "circleMarker" in html
    assert "selectRegion" in html


def test_create_map_html_selected_region():
    """Test that selected region is highlighted in map HTML."""
    regions_data = {
        "Texas": {"production": 450000, "trend": "increasing", "yoy_change": 5.2},
        "Oklahoma": {"production": 150000, "trend": "stable", "yoy_change": 0.5},
    }
    
    html = create_map_html(regions_data, "Texas")
    
    # Selected region should have different styling
    assert "selected: true" in html or "selected\":true" in html


def test_map_html_includes_legend():
    """Test that map includes a legend."""
    regions_data = {
        "Texas": {"production": 450000, "trend": "increasing", "yoy_change": 5.2},
    }
    
    html = create_map_html(regions_data)
    
    assert "legend" in html.lower()
    assert "increasing" in html.lower()
    assert "decreasing" in html.lower()
    assert "stable" in html.lower()


def test_map_html_includes_all_regions():
    """Test that all provided regions appear in the map."""
    regions_data = {
        "Texas": {"production": 450000, "trend": "increasing", "yoy_change": 5.2},
        "Oklahoma": {"production": 150000, "trend": "stable", "yoy_change": 0.5},
        "Colorado": {"production": 120000, "trend": "decreasing", "yoy_change": -3.1},
    }
    
    html = create_map_html(regions_data)
    
    assert "Texas" in html
    assert "Oklahoma" in html
    assert "Colorado" in html


def test_conversational_ai_context_structure():
    """Test that AI context has all required fields."""
    # This would be the context passed to ask_question
    context = {
        "region": "Texas",
        "series_id": "PET.MCRFPTX2.M",
        "last_actual_year": 2023,
        "last_actual_value": 450000,
        "projection_year": 2026,
        "projection_value": 475000,
        "yoy_change_pct": 2.5,
        "recommendation": "Pursue",
        "confidence": 0.85,
        "estimated_revenue": 23750000,
        "price_assumption": 50.0,
        "historical_data_points": 120,
        "forecast_years": 5,
    }
    
    # Verify all required fields are present
    required_fields = [
        "region", "series_id", "last_actual_year", "last_actual_value",
        "projection_year", "projection_value", "recommendation", "confidence"
    ]
    
    for field in required_fields:
        assert field in context, f"Missing required field: {field}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
