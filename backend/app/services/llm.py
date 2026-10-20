"""
UrbanIQ LLM Explanation Service
================================
Generates natural-language executive explanations of the deterministic scoring results.

Guarantees:
- The LLM NEVER generates, alters, or overrides the numerical score or factor values.
- It receives the calculated deterministic scores and articulates a concise 2-sentence rationale.
- If the Grok/Groq API is offline, unconfigured, or times out, the service falls back
  to a transparent deterministic template without failing the request.
"""

import logging
import httpx
from typing import Optional, Dict, Any

from backend.app.core.config import settings, strip_think_tags

logger = logging.getLogger("urbaniq.llm")


def generate_explanation(
    business_type: str,
    city_name: str,
    overall_score: int,
    suitability_label: str,
    competitor_count: int,
    radius_meters: int,
    positive_drivers: list,
    negative_risks: list,
    confidence_level: str,
) -> str:
    """
    Generate an executive natural-language explanation using Grok / Groq API.
    Falls back gracefully to deterministic rule-based text if API is unavailable.
    """
    api_key = settings.GROQ_API_KEY
    if not api_key:
        return _fallback_explanation(business_type, city_name, overall_score, suitability_label, competitor_count, positive_drivers, negative_risks)

    radius_km = radius_meters / 1000.0
    prompt = f"""You are UrbanIQ Location Intelligence Analyst. Summarize the following calculated location evaluation in 2 concise, professional sentences. DO NOT invent or alter any numbers.

Context:
- Business: {business_type}
- City/Area: {city_name}
- Suitability Score: {overall_score}/100 ({suitability_label})
- Competitors: {competitor_count} within {radius_km} km
- Main Strengths: {'; '.join(positive_drivers[:2]) if positive_drivers else 'Standard catchment'}
- Key Risks: {'; '.join(negative_risks[:2]) if negative_risks else 'General retail competition'}
- Data Confidence: {confidence_level}

Output strictly 2 sentences of actionable business insight: sentence 1 summarizes why the score was achieved, and sentence 2 highlights the primary operational consideration."""

    try:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.GROQ_MODEL,
            "messages": [
                {"role": "system", "content": "You are a concise location intelligence analyst. Output exactly 2 sentences with no preamble."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 150,
        }

        with httpx.Client(timeout=4.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                cleaned = strip_think_tags(content).strip()
                if cleaned:
                    return cleaned
    except Exception as e:
        logger.info("LLM explanation service bypassed or timed out (%s); using deterministic template.", e)

    return _fallback_explanation(business_type, city_name, overall_score, suitability_label, competitor_count, positive_drivers, negative_risks)


def _fallback_explanation(
    business_type: str,
    city_name: str,
    overall_score: int,
    suitability_label: str,
    competitor_count: int,
    positive_drivers: list,
    negative_risks: list,
) -> str:
    strength = positive_drivers[0] if positive_drivers else "balanced urban access"
    risk = negative_risks[0] if negative_risks else "standard retail competition"
    return (
        f"This location attains a {suitability_label} suitability rating of {overall_score}/100 for a {business_type.lower()} in {city_name}, "
        f"driven by {strength.lower().rstrip('.')}. "
        f"However, prospective operators must account for {risk.lower().rstrip('.')}."
    )
