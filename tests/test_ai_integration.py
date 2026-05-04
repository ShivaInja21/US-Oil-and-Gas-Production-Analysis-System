"""Tests for AI integration features."""
import pytest
import pandas as pd
from src.ai_summary import detect_anomalies, ask_question


def test_detect_anomalies_empty():
    """Test anomaly detection with empty series."""
    ts = pd.Series(dtype=float)
    anomalies = detect_anomalies(ts)
    assert anomalies == []


def test_detect_anomalies_normal():
    """Test anomaly detection with normal data."""
    ts = pd.Series([100, 105, 102, 98, 103], index=[2020, 2021, 2022, 2023, 2024])
    anomalies = detect_anomalies(ts, threshold=2.0)
    assert len(anomalies) == 0


def test_detect_anomalies_with_outlier():
    """Test anomaly detection with clear outlier."""
    ts = pd.Series([100, 105, 102, 200, 103], index=[2020, 2021, 2022, 2023, 2024])
    anomalies = detect_anomalies(ts, threshold=1.5)
    assert len(anomalies) > 0
    assert any(a["year"] == 2023 for a in anomalies)
    assert all(a["severity"] in ["Medium", "High"] for a in anomalies)


def test_ask_question_without_api_key(monkeypatch):
    """Test conversational AI without API key."""
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    context = {"region": "Texas", "last_actual_value": 1000}
    result = ask_question("What is the trend?", context)
    assert "OPENAI_API_KEY not set" in result["answer"]
    assert result["data_sources"] == []
    assert result["is_inference"] is False


def test_ask_question_structure():
    """Test that ask_question returns correct structure."""
    context = {"region": "Texas", "series_id": "PET.MCRFPTX2.M"}
    result = ask_question("test", context)
    assert "answer" in result
    assert "data_sources" in result
    assert "is_inference" in result
    assert isinstance(result["data_sources"], list)
    assert isinstance(result["is_inference"], bool)
