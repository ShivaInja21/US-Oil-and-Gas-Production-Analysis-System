"""Streamlit entrypoint for the Energy Intelligence System app.

This file is intentionally a minimal, working skeleton that wires together
the client, data preparation, forecasting, and KPI modules. It is safe to
run without API keys (it will show warnings and fallbacks).
"""
from __future__ import annotations
import os
import streamlit as st
import pandas as pd
from src.eia_client import fetch_series_cached
from src.data_prep import to_annual_series
from src.forecast import linear_trend_forecast, forecast_with_pivot
from src.kpis import projected_production, yoy_growth, revenue_estimate, projected_production_kpi
from src.ai_summary import generate_summary, ask_question, detect_anomalies
from src.map_viz import create_map_html, calculate_region_metrics
import streamlit.components.v1 as components

# Set OpenAI key from secrets if available
if "OPENAI_API_KEY" in st.secrets:
    os.environ["OPENAI_API_KEY"] = st.secrets["OPENAI_API_KEY"]
if "EIA_API_KEY" in st.secrets:
    os.environ["EIA_API_KEY"] = st.secrets["EIA_API_KEY"]


st.set_page_config(layout="wide", page_title="Energy Intelligence System")

st.title("Energy Intelligence System — Streamlit")

# Check for API keys from environment or Streamlit secrets
eia_key = os.getenv("EIA_API_KEY") or st.secrets.get("EIA_API_KEY")
openai_key = os.getenv("OPENAI_API_KEY") or st.secrets.get("OPENAI_API_KEY")

if not eia_key:
    st.warning("EIA_API_KEY is not set. Data fetches will fail until you set it.")

if not openai_key:
    st.info("💡 Tip: Set OPENAI_API_KEY in .streamlit/secrets.toml to enable conversational AI and executive summaries. Anomaly detection works without it.")

# U.S. Crude Oil Production by State/Region - verified EIA series IDs
# Only includes states with active crude oil production data available from EIA
REGION_TO_SERIES = {
    "United States": "PET.MCRFPUS1.M",
    "Alabama": "PET.MCRFPAL2.M",
    "Alaska": "PET.MCRFPAK2.M",
    "Arkansas": "PET.MCRFPAR2.M",
    "California": "PET.MCRFPCA2.M",
    "Colorado": "PET.MCRFPCO2.M",
    "Florida": "PET.MCRFPFL2.M",
    "Illinois": "PET.MCRFPIL2.M",
    "Indiana": "PET.MCRFPIN2.M",
    "Kansas": "PET.MCRFPKS2.M",
    "Kentucky": "PET.MCRFPKY2.M",
    "Louisiana": "PET.MCRFPLA2.M",
    "Michigan": "PET.MCRFPMI2.M",
    "Mississippi": "PET.MCRFPMS2.M",
    "Montana": "PET.MCRFPMT2.M",
    "Nebraska": "PET.MCRFPNE2.M",
    "New Mexico": "PET.MCRFPNM2.M",
    "North Dakota": "PET.MCRFPND2.M",
    "Ohio": "PET.MCRFPOH2.M",
    "Oklahoma": "PET.MCRFPOK2.M",
    "Pennsylvania": "PET.MCRFPPA2.M",
    "Texas": "PET.MCRFPTX2.M",
    "Utah": "PET.MCRFPUT2.M",
    "West Virginia": "PET.MCRFPWV2.M",
    "Wyoming": "PET.MCRFPWY2.M",
    "Federal Offshore Gulf of Mexico": "PET.MCRFP3FM2.M",
}

# Initialize session state for region selection from map
if "selected_region" not in st.session_state:
    st.session_state.selected_region = "United States"

# Geographic Visualization Section
st.header("🗺️ Geographic Production Overview")
st.caption("Interactive map showing regional oil production data. Click any region to update the dashboard below.")

# Fetch data for all regions to populate map
regions_data = {}
for reg_name, ser_id in REGION_TO_SERIES.items():
    try:
        df_temp, _ = fetch_series_cached(ser_id)
        ts_temp = to_annual_series(df_temp)
        metrics = calculate_region_metrics(reg_name, ts_temp)
        regions_data[reg_name] = metrics
    except:
        regions_data[reg_name] = {"production": 0, "trend": "unknown", "yoy_change": 0}

# Render interactive map
map_html = create_map_html(regions_data, st.session_state.selected_region)
map_component = components.html(map_html, height=520, scrolling=False)

st.markdown("---")

# Regional Analysis Section
st.header("📊 Regional Analysis & Forecasting")

col1, col2 = st.columns([1, 3])
with col1:
    region = st.selectbox("Region", list(REGION_TO_SERIES.keys()), 
                         index=list(REGION_TO_SERIES.keys()).index(st.session_state.selected_region) 
                         if st.session_state.selected_region in REGION_TO_SERIES else 0)
    
    # Update session state when selectbox changes
    if region != st.session_state.selected_region:
        st.session_state.selected_region = region
    
    year = st.slider("Projection year", 2023, 2035, 2026)
    years_after = st.slider("Years after pivot to forecast", 1, 10, 5)
    price = st.number_input("Price assumption (USD/unit)", value=50.0)
    refresh = st.button("Refresh data")

with col2:
    st.subheader(f"Selected region: {region}")
    # Show quick stats from map data
    if region in regions_data:
        metric_col1, metric_col2, metric_col3 = st.columns(3)
        with metric_col1:
            st.metric("Latest Production", f"{regions_data[region]['production']:,.0f}K bbl/mo")
        with metric_col2:
            st.metric("YoY Change", f"{regions_data[region]['yoy_change']:.1f}%")
        with metric_col3:
            st.metric("Trend", regions_data[region]['trend'].title())

series_id = REGION_TO_SERIES.get(region)

df = None
metadata = None
if series_id:
    try:
        # control refresh by bypassing cache when requested
        df, metadata = fetch_series_cached(series_id) if not refresh else fetch_series_cached.__wrapped__(series_id)
    except Exception as e:
        st.error(f"Failed to fetch series {series_id}: {e}")

if df is not None:
    ts = to_annual_series(df)
    # Build historical (trimmed to pivot) + forecast beyond pivot
    combined = forecast_with_pivot(ts, pivot_year=year, years_after=years_after, method="linear")
    # Render actuals and forecasts as separate series so they are visually distinct
    st.line_chart(combined[["actual", "forecast"]])

    # Core KPI: structured projected production estimate (clearly labeled & distinct)
    kpi = projected_production_kpi(combined, year, price_per_unit=price)
    st.subheader("📈 Core KPI: Projected Production Estimate")
    label = kpi.get("label", "Projected production")
    val = kpi.get("value")
    if val is not None:
        # show number with thousands separator and unit; show pct change as delta if available
        delta = None
        if kpi.get("pct_change") is not None:
            delta = f"{kpi['pct_change']:.2%}"
        st.metric(label, f"{val:,.0f} {kpi.get('unit','')}", delta=delta)
    else:
        st.metric(label, "N/A")

    # Recommendation and confidence summarize whether to pursue this region
    rec = kpi.get("recommendation")
    conf = kpi.get("confidence", 0.0)
    st.markdown(f"**Recommendation:** {rec}  \n**Confidence:** {conf:.0%}")

    # show estimated revenue if available
    if kpi.get("estimated_revenue") is not None:
        st.metric("Estimated revenue", f"${kpi['estimated_revenue']:,.0f}")

    # AI-powered anomaly detection
    st.subheader("🔍 AI-Powered Anomaly Detection")
    anomalies = detect_anomalies(ts, threshold=2.0)
    if anomalies:
        st.warning(f"Detected {len(anomalies)} unusual production pattern(s)")
        for anom in anomalies:
            with st.expander(f"⚠️ {anom['severity']} anomaly in {anom['year']}"):
                st.write(anom['description'])
                st.write(f"**Actual value:** {anom['value']:,.0f}")
                st.write(f"**Expected range:** {anom['expected_range']}")
                st.write(f"**Statistical deviation:** {anom['z_score']:.2f}σ")
    else:
        st.success("No significant anomalies detected in historical data")

    # Conversational AI interface
    st.subheader("💬 Ask Questions About This Region")
    st.caption("AI-powered conversational interface with access to live data")
    
    # Build context from live data
    context = {
        "region": region,
        "series_id": series_id,
        "last_actual_year": int(ts.index[-1]) if len(ts) else None,
        "last_actual_value": float(ts.iloc[-1]) if len(ts) else None,
        "projection_year": year,
        "projection_value": kpi.get("value"),
        "yoy_change_pct": kpi.get("pct_change"),
        "recommendation": rec,
        "confidence": conf,
        "estimated_revenue": kpi.get("estimated_revenue"),
        "price_assumption": price,
        "historical_data_points": len(ts),
        "forecast_years": years_after,
    }
    
    # Sample questions
    sample_questions = [
        f"What is the production trend for {region}?",
        f"Should we invest in {region}?",
        f"How does {region} compare to historical performance?",
        f"What is the projected production for {year}?",
    ]
    
    question = st.text_input(
        "Ask a question:",
        placeholder="e.g., What is the production trend for this region?",
        help="Ask questions about production data, forecasts, or investment recommendations"
    )
    
    col_q1, col_q2 = st.columns(2)
    with col_q1:
        if st.button("📊 Ask Question") and question:
            with st.spinner("Analyzing data..."):
                result = ask_question(question, context)
                
                # Display answer with clear provenance
                st.markdown("**Answer:**")
                st.info(result["answer"])
                
                # Show data sources
                if result["data_sources"]:
                    st.markdown("**Data sources:**")
                    for source in result["data_sources"]:
                        st.caption(f"✓ {source}")
                
                # Flag inference vs data-backed
                if result["is_inference"]:
                    st.warning("⚠️ This answer contains AI-generated inference beyond raw data")
                else:
                    st.success("✓ This answer is grounded in verified data")
    
    with col_q2:
        st.markdown("**Sample questions:**")
        for sq in sample_questions[:2]:
            st.caption(f"• {sq}")

    # AI summary (facts)
    st.subheader("📋 Executive Summary")
    facts = {
        "region": region,
        "series_id": series_id,
        "last_actual_year": int(ts.index[-1]) if len(ts) else None,
        "last_actual_value": float(ts.iloc[-1]) if len(ts) else None,
        "projection_year": year,
        "projection_value_estimate": kpi.get("value"),
    }
    if st.button("Generate executive summary"):
        summary = generate_summary(region, facts)
        st.markdown("**Executive summary**")
        st.write(summary.get("text"))
        st.markdown("**Provenance**")
        st.json(summary.get("provenance"))
else:
    st.info("No data available. Set a valid EIA series mapping and EIA_API_KEY.")
