"""AI-powered analysis features with provenance tracking.

Provides conversational interface and auto-generated summaries grounded in live data.
Clearly distinguishes between data-backed facts and AI-generated inference.
"""
from __future__ import annotations
import os
import json
from typing import Dict, Any, List
import pandas as pd


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


def generate_summary(region: str, facts: Dict[str, Any], model: str = "gpt-3.5-turbo") -> Dict[str, Any]:
    """Generate a short executive summary given data-backed facts.

    If OPENAI_API_KEY is not set, return a placeholder explaining the missing key.
    """
    if not OPENAI_API_KEY:
        return {
            "text": (
                "OPENAI_API_KEY not set. To enable AI summaries, set OPENAI_API_KEY as an env var."
            ),
            "provenance": facts,
        }

    # Lazy import to avoid hard dependency when not used
    try:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
    except Exception as e:
        return {"text": f"openai package error: {e}", "provenance": facts}

    # Build a concise prompt with labeled facts
    fact_lines = []
    for k, v in facts.items():
        fact_lines.append(f"- {k}: {v}")
    prompt = (
        "You are an assistant that summarizes energy data for decision makers. "
        "Use only the facts provided below and label any inference clearly. "
        "Provide a 3-sentence executive summary and one bullet list of recommended next steps.\n\n"
        "FACTS:\n"
        + "\n".join(fact_lines)
    )

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are concise and factual."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=300,
            temperature=0.2,
        )
        text = resp.choices[0].message.content.strip()
        return {"text": text, "provenance": facts}
    except Exception as e:
        error_msg = str(e)
        if "insufficient_quota" in error_msg or "quota" in error_msg.lower():
            return {
                "text": "⚠️ OpenAI API quota exceeded. Please add credits at https://platform.openai.com/account/billing or use a different API key.",
                "provenance": facts
            }
        return {"text": f"LLM error: {e}", "provenance": facts}


def ask_question(question: str, context: Dict[str, Any], model: str = "gpt-3.5-turbo") -> Dict[str, Any]:
    """Conversational AI interface for asking questions about regional data and forecasts.
    
    Args:
        question: User's natural language question
        context: Dictionary containing live data (region, historical data, forecasts, KPIs)
        model: OpenAI model to use
    
    Returns:
        Dict with 'answer' (str), 'data_sources' (list), and 'is_inference' (bool)
    """
    if not OPENAI_API_KEY:
        return {
            "answer": "OPENAI_API_KEY not set. Configure it to enable conversational AI.",
            "data_sources": [],
            "is_inference": False,
        }
    
    try:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
    except Exception as e:
        return {"answer": f"openai package error: {e}", "data_sources": [], "is_inference": False}
    
    # Build context string from live data
    context_str = json.dumps(context, indent=2, default=str)
    
    system_prompt = (
        "You are an energy data analyst assistant. Answer questions using ONLY the provided data context. "
        "Always cite specific numbers from the data. If you make any inference beyond the raw data, "
        "explicitly state 'INFERENCE:' before that part. Keep answers concise (2-3 sentences max)."
    )
    
    user_prompt = f"DATA CONTEXT:\n{context_str}\n\nQUESTION: {question}"
    
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=250,
            temperature=0.1,
        )
        answer = resp.choices[0].message.content.strip()
        
        # Detect if answer contains inference
        is_inference = "INFERENCE" in answer.upper() or "LIKELY" in answer.upper() or "MAY" in answer.upper()
        
        # Extract data sources referenced
        data_sources = []
        if context.get("region"):
            data_sources.append(f"Region: {context['region']}")
        if context.get("series_id"):
            data_sources.append(f"EIA Series: {context['series_id']}")
        if context.get("last_actual_year"):
            data_sources.append(f"Latest data: {context['last_actual_year']}")
        
        return {
            "answer": answer,
            "data_sources": data_sources,
            "is_inference": is_inference,
        }
    except Exception as e:
        error_msg = str(e)
        if "insufficient_quota" in error_msg or "quota" in error_msg.lower():
            return {
                "answer": "⚠️ OpenAI API quota exceeded. Please add credits at https://platform.openai.com/account/billing",
                "data_sources": [],
                "is_inference": False
            }
        return {"answer": f"Error: {e}", "data_sources": [], "is_inference": False}


def detect_anomalies(ts: pd.Series, threshold: float = 2.0) -> List[Dict[str, Any]]:
    """AI-powered anomaly detection that flags unusual production patterns.
    
    Args:
        ts: Time series of production data (indexed by year)
        threshold: Number of standard deviations to consider anomalous
    
    Returns:
        List of anomaly dicts with year, value, expected, and severity
    """
    if ts is None or len(ts) < 3:
        return []
    
    anomalies = []
    values = ts.values.astype(float)
    mean = values.mean()
    std = values.std()
    
    if std == 0:
        return []
    
    for year, value in ts.items():
        z_score = abs((value - mean) / std)
        if z_score > threshold:
            severity = "High" if z_score > 3.0 else "Medium"
            anomalies.append({
                "year": int(year),
                "value": float(value),
                "expected_range": f"{mean - threshold*std:.0f} - {mean + threshold*std:.0f}",
                "z_score": float(z_score),
                "severity": severity,
                "description": f"Production in {int(year)} deviates {z_score:.1f}σ from historical average"
            })
    
    return sorted(anomalies, key=lambda x: x["z_score"], reverse=True)
