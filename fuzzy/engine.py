"""
UrbanIQ Soft Computing Engine — Fuzzy Logic Inference
Implements Fuzzification, Mamdani Rule Evaluation, and Defuzzification.
"""
from typing import Dict, Tuple, List


def trimf(x: float, a: float, b: float, c: float) -> float:
    """Triangular membership function."""
    if x <= a or x >= c:
        return 0.0
    if a < x <= b:
        return (x - a) / (b - a) if b != a else 1.0
    return (c - x) / (c - b) if c != b else 1.0


def trapmf_left(x: float, a: float, b: float) -> float:
    """Trapezoidal membership function (left shoulder for 'Low')."""
    if x <= a:
        return 1.0
    if a < x < b:
        return (b - x) / (b - a)
    return 0.0


def trapmf_right(x: float, a: float, b: float) -> float:
    """Trapezoidal membership function (right shoulder for 'High')."""
    if x <= a:
        return 0.0
    if a < x < b:
        return (x - a) / (b - a)
    return 1.0


class FuzzyOpportunityEngine:
    """
    Evaluates urban factors (Demand, Gap, Competition, Accessibility)
    and computes a crisp 0-100 Opportunity Score via Fuzzy Inference.
    """

    @staticmethod
    def fuzzify(value: float) -> Dict[str, float]:
        """
        Fuzzifies a normalized 0-100 input into Low, Medium, and High membership values.
        """
        val = max(0.0, min(100.0, float(value)))
        return {
            "low": trapmf_left(val, 25.0, 50.0),
            "medium": trimf(val, 25.0, 50.0, 75.0),
            "high": trapmf_right(val, 50.0, 75.0),
        }

    @classmethod
    def evaluate(
        cls,
        demand: float,
        service_gap: float,
        competition_opportunity: float,
        accessibility: float,
    ) -> Tuple[int, str, List[str]]:
        """
        Evaluate fuzzy rules and defuzzify into a crisp score.
        Returns: (score: int, level: str, active_reasons: List[str])
        """
        f_demand = cls.fuzzify(demand)
        f_gap = cls.fuzzify(service_gap)
        f_comp = cls.fuzzify(competition_opportunity)
        f_access = cls.fuzzify(accessibility)

        # Rule evaluation (Mamdani min operator for AND)
        # Rule 1: Very High Opportunity
        # IF demand is HIGH and gap is HIGH and competition is HIGH (low comp) and access is HIGH
        r1 = min(f_demand["high"], f_gap["high"], f_comp["high"], f_access["high"])

        # Rule 2: High Opportunity (Strong demand + gap, moderate competition/access)
        r2 = min(f_demand["high"], f_gap["high"], max(f_comp["medium"], f_access["medium"]))

        # Rule 3: High Opportunity (Exceptional gap with acceptable access)
        r3 = min(f_gap["high"], f_access["high"], f_demand["medium"])

        # Rule 4: Moderate Opportunity
        r4 = min(f_demand["medium"], f_gap["medium"])

        # Rule 5: Low Opportunity (Low gap or saturated competition)
        r5 = max(f_gap["low"], f_comp["low"])

        # Defuzzification using Weighted Centroid:
        # Centroid centers:
        # Very High -> 92, High -> 80, Moderate -> 55, Low -> 30
        weights = [
            (r1, 92.0),
            (r2, 80.0),
            (r3, 78.0),
            (r4, 55.0),
            (r5, 30.0),
        ]

        total_weight = sum(w for w, _ in weights)
        if total_weight > 0.001:
            crisp_score = sum(w * c for w, c in weights) / total_weight
        else:
            # Fallback linear approximation if all memberships are near zero
            crisp_score = (demand * 0.3 + service_gap * 0.3 + competition_opportunity * 0.2 + accessibility * 0.2)

        final_score = int(round(max(10.0, min(98.0, crisp_score))))

        # Linguistic Level
        if final_score >= 75:
            level = "High"
        elif final_score >= 50:
            level = "Medium"
        else:
            level = "Low"

        # Traceable Explanations
        reasons: List[str] = []
        if f_gap["high"] > 0.5:
            reasons.append("High service gap indicates underserved catchment population.")
        if f_demand["high"] > 0.5:
            reasons.append("Strong local population density suggests solid baseline demand.")
        if f_comp["high"] > 0.5:
            reasons.append("Low competitor concentration provides favorable market entry room.")
        if f_access["high"] > 0.5:
            reasons.append("Good transit accessibility enables customer reach beyond the immediate zone.")

        if not reasons:
            reasons.append("Balanced urban indicators with moderate overall opportunity.")

        return final_score, level, reasons
