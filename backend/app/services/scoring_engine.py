"""
UrbanIQ Data-Driven Location Scoring & Suitability Engine
=========================================================
Implements:
1. Multi-Criteria Decision Analysis (MCDA) with 6 configurable weighted factors:
   - Nearby competitor density (20%)
   - Relevant business demand & nearby activity (25%)
   - Population or customer access indicators (20%)
   - Accessibility & transport connectivity (15%)
   - Nearby complementary businesses & amenities (10%)
   - Location-specific risk & data confidence (10%)
2. Category-Specific Sensitivity:
   - Evaluates Cafe, Pharmacy, Restaurant, Gym, Education Institute, Clothing Store, Clinic
     with tailored demand drivers, cluster dynamics, and complementary anchors.
3. Soft Computing (Fuzzy Logic):
   - Mamdani fuzzy inference system evaluating Competition, Demand, Accessibility,
     defuzzified via weighted centroid into a crisp suitability score.
4. Transparent Blending Formula:
   - final_score = round(0.70 * weighted_factor_score + 0.30 * fuzzy_suitability_score)
5. TCS Principles:
   - Deterministic, contract-validated, zero-randomness, explicit missing data warnings.
"""

from typing import Dict, Any, List, Optional, Tuple
import math
from pydantic import BaseModel, Field

# ── Configurable Baseline Factor Weights ──────────────────────────────
DEFAULT_WEIGHTS = {
    "competitor_density": 0.20,
    "business_demand": 0.25,
    "customer_access": 0.20,
    "accessibility": 0.15,
    "complementary_amenities": 0.10,
    "risk_and_confidence": 0.10,
}


class FactorDetail(BaseModel):
    name: str
    key: str
    score: float = Field(..., ge=0.0, le=100.0)
    weight_percent: float
    weighted_contribution: float
    description: str
    status: str  # "strong", "moderate", "low", "risk"
    data_state: str = "observed"  # "observed", "confirmed_zero", "unavailable", "partial"
    is_estimated: bool = False
    raw_count: Optional[int] = None


class LocationScoringInput(BaseModel):
    business_type: str
    latitude: float
    longitude: float
    radius_meters: int = 2000
    city_name: str = "Mumbai"
    competitors_count: int = 0
    hospitals_count: int = 0
    schools_count: int = 0
    colleges_count: int = 0
    offices_count: int = 0
    bus_stops_count: int = 0
    railway_stations_count: int = 0
    nearest_transit_dist_m: Optional[float] = None
    data_source: str = "google_places"
    population_estimate: Optional[int] = None
    weights: Optional[Dict[str, float]] = None
    data_statuses: Optional[Dict[str, str]] = None  # Explicit data states per category/factor


class LocationScoringResult(BaseModel):
    overall_score: int = Field(..., ge=0, le=100)
    suitability_label: str  # "Poor", "Fair", "Good", "Excellent"
    confidence_level: str   # "High", "Medium", "Low"
    is_provisional: bool
    weighted_base_score: float
    fuzzy_suitability_score: float
    factors: List[FactorDetail]
    positive_drivers: List[str]
    negative_risks: List[str]
    missing_data_warnings: List[str]
    practical_recommendation: str
    explanation: str
    competitor_count: int
    radius_meters: int
    business_type: str
    city_name: str
    formula_documentation: str


# ── Fuzzy Membership Functions ─────────────────────────────────────────
def _trapmf_left(x: float, a: float, b: float) -> float:
    """Trapezoidal left shoulder: 1.0 below a, slopes to 0 at b."""
    if x <= a:
        return 1.0
    if a < x < b:
        return (b - x) / (b - a)
    return 0.0


def _trimf(x: float, a: float, b: float, c: float) -> float:
    """Triangular: slopes up a->b, slopes down b->c."""
    if x <= a or x >= c:
        return 0.0
    if a < x <= b:
        return (x - a) / (b - a) if b != a else 1.0
    return (c - x) / (c - b) if c != b else 1.0


def _trapmf_right(x: float, a: float, b: float) -> float:
    """Trapezoidal right shoulder: 0 below a, slopes to 1 at b."""
    if x <= a:
        return 0.0
    if a < x < b:
        return (x - a) / (b - a)
    return 1.0


# ── Mamdani Fuzzy Inference Engine ─────────────────────────────────────
def evaluate_fuzzy_suitability(
    competition_score: float,
    demand_score: float,
    accessibility_score: float,
) -> Tuple[float, str]:
    """
    Evaluates competition, demand, and accessibility using Mamdani Fuzzy Rules.
    Returns: (crisp_score: float 0-100, label: str)
    """
    # Fuzzify Competition Opportunity (0-100, where higher means better opportunity)
    comp_low = _trapmf_left(competition_score, 30.0, 50.0)
    comp_med = _trimf(competition_score, 30.0, 55.0, 80.0)
    comp_high = _trapmf_right(competition_score, 60.0, 85.0)

    # Fuzzify Demand (0-100)
    dem_low = _trapmf_left(demand_score, 30.0, 50.0)
    dem_med = _trimf(demand_score, 30.0, 60.0, 80.0)
    dem_high = _trapmf_right(demand_score, 65.0, 85.0)

    # Fuzzify Accessibility (0-100)
    acc_poor = _trapmf_left(accessibility_score, 30.0, 55.0)
    acc_mod = _trimf(accessibility_score, 35.0, 60.0, 80.0)
    acc_good = _trapmf_right(accessibility_score, 65.0, 85.0)

    # Mamdani Rule Base (min operator for AND, max for OR):
    # R1: Strong Demand + Good Access + Favorable/Moderate Competition -> Excellent
    r1 = min(dem_high, acc_good, max(comp_high, comp_med))

    # R2: Strong Demand + Good Access + Fierce Competition -> Fair (cluster demand, high churn risk)
    r2 = min(dem_high, acc_good, comp_low)

    # R3: Moderate Demand + Good/Mod Access + Low Competition -> Good
    r3 = min(dem_med, max(acc_good, acc_mod), comp_high)

    # R4: Moderate Demand + Moderate Competition -> Fair
    r4 = min(dem_med, comp_med)

    # R5: Low Demand OR Poor Access -> Poor
    r5 = max(dem_low, acc_poor)

    # Centroid values for output singletons:
    # Excellent -> 90, Good -> 75, Fair -> 52, Poor -> 28
    weights = [
        (r1, 90.0),
        (r2, 52.0),
        (r3, 75.0),
        (r4, 55.0),
        (r5, 28.0),
    ]

    total_w = sum(w for w, _ in weights)
    if total_w > 0.001:
        crisp = sum(w * c for w, c in weights) / total_w
    else:
        crisp = 50.0

    crisp = max(0.0, min(100.0, crisp))

    if crisp >= 80:
        label = "Excellent"
    elif crisp >= 65:
        label = "Good"
    elif crisp >= 45:
        label = "Fair"
    else:
        label = "Poor"

    return round(crisp, 1), label


# ── Core Deterministic Scoring Engine ──────────────────────────────────
class ScoringEngine:
    @staticmethod
    def calculate_score(inp: LocationScoringInput) -> LocationScoringResult:
        weights = inp.weights or DEFAULT_WEIGHTS
        btype = inp.business_type
        radius_km = inp.radius_meters / 1000.0
        area_sq_km = math.pi * (radius_km ** 2)

        missing_data_warnings: List[str] = []
        positive_drivers: List[str] = []
        negative_risks: List[str] = []

        statuses = inp.data_statuses or {}
        comp_state = statuses.get("competitors", "observed" if inp.competitors_count > 0 else "confirmed_zero")
        transit_state = statuses.get("transit", "observed" if (inp.bus_stops_count + inp.railway_stations_count) > 0 else "confirmed_zero")
        civic_state = statuses.get("civic", "observed" if (inp.schools_count + inp.hospitals_count) > 0 else "confirmed_zero")
        demand_state = statuses.get("demand", "observed" if (inp.offices_count + inp.colleges_count) > 0 else "confirmed_zero")

        # ── 1. Competitor Density (Weight: 20%) ────────────────────────
        comp_density = inp.competitors_count / max(0.1, area_sq_km)
        comp_is_estimated = False

        if comp_state == "unavailable":
            comp_score = 50.0  # Neutral baseline prior
            comp_is_estimated = True
            comp_desc = "Competitor data could not be verified because the data source failed; evaluated at neutral baseline prior."
            missing_data_warnings.append("Competitor data could not be verified because the data source failed.")
        elif comp_state == "confirmed_zero" or inp.competitors_count == 0:
            comp_state = "confirmed_zero"
            if btype in ["Cafe", "Restaurant"]:
                comp_score = 65.0
                comp_desc = f"Zero competitors confirmed in {radius_km:.1f} km radius: uncontested market with unproven footfall."
                negative_risks.append("No matching competitors found in queried area: uncontested territory with unproven commercial demand.")
            else:
                comp_score = 75.0
                comp_desc = f"Zero competitors confirmed in {radius_km:.1f} km radius: clear market headroom."
                positive_drivers.append("No direct competitors found in queried radius.")
        else:
            comp_state = "observed"
            if btype in ["Cafe", "Restaurant"]:
                if comp_density <= 1.0:
                    comp_score = round(92.0 - comp_density * 4.0, 1)
                    positive_drivers.append(f"Low competitor density ({inp.competitors_count} competitors, {comp_density:.1f}/km²): high market headroom.")
                elif comp_density <= 4.0:
                    comp_score = round(88.0 - ((comp_density - 1.0) / 3.0) * 16.0, 1)
                    positive_drivers.append(f"Active commercial cluster ({inp.competitors_count} competitors, {comp_density:.1f}/km²): proven category viability with competitive headroom.")
                elif comp_density <= 12.0:
                    comp_score = round(72.0 - ((comp_density - 4.0) / 8.0) * 28.0, 1)
                    negative_risks.append(f"High competitor concentration ({inp.competitors_count} competitors, {comp_density:.1f}/km²): requires strong product differentiation.")
                else:
                    comp_score = round(max(20.0, 44.0 - (comp_density - 12.0) * 1.5), 1)
                    negative_risks.append(f"Severe market saturation ({inp.competitors_count} competitors, {comp_density:.1f}/km²): high customer acquisition and rental costs.")
            elif btype == "Pharmacy":
                if comp_density <= 0.8:
                    comp_score = round(95.0 - comp_density * 8.0, 1)
                    positive_drivers.append("Low pharmacy saturation: clear territorial catchment.")
                elif comp_density <= 3.0:
                    comp_score = round(88.6 - ((comp_density - 0.8) / 2.2) * 28.0, 1)
                elif comp_density <= 6.0:
                    comp_score = round(60.6 - ((comp_density - 3.0) / 3.0) * 25.0, 1)
                    negative_risks.append(f"Moderate-to-high pharmacy density ({inp.competitors_count} nearby): patient footfall is split.")
                else:
                    comp_score = round(max(15.0, 35.6 - (comp_density - 6.0) * 3.0), 1)
                    negative_risks.append(f"High pharmacy saturation ({inp.competitors_count} nearby): limits prescription volume per store.")
            elif btype == "Education Institute":
                if comp_density <= 1.0:
                    comp_score = round(92.0 - comp_density * 6.0, 1)
                    positive_drivers.append("Substantial underserved student catchment with few institutes.")
                elif comp_density <= 4.0:
                    comp_score = round(86.0 - ((comp_density - 1.0) / 3.0) * 20.0, 1)
                    positive_drivers.append("Established education corridor with student transit habits.")
                else:
                    comp_score = round(max(20.0, 66.0 - (comp_density - 4.0) * 4.0), 1)
                    negative_risks.append(f"High education institute competition ({inp.competitors_count} nearby).")
            else:
                if comp_density <= 1.5:
                    comp_score = round(90.0 - comp_density * 8.0, 1)
                elif comp_density <= 5.0:
                    comp_score = round(78.0 - ((comp_density - 1.5) / 3.5) * 24.0, 1)
                else:
                    comp_score = round(max(20.0, 54.0 - (comp_density - 5.0) * 3.0), 1)
            comp_desc = f"{inp.competitors_count} competitors ({comp_density:.1f}/km² in {radius_km:.1f} km radius)."

        # ── 2. Business Demand & Relevant Activity (Weight: 25%) ───────
        demand_is_estimated = False
        if demand_state == "unavailable":
            demand_score = 50.0  # Neutral baseline prior
            demand_is_estimated = True
            demand_desc = "Commercial demand drivers (offices/colleges) could not be verified because the data source failed; scored at neutral prior."
            missing_data_warnings.append("Commercial demand drivers could not be verified because the data source failed.")
        elif demand_state == "confirmed_zero" or (inp.offices_count == 0 and inp.colleges_count == 0 and inp.hospitals_count == 0 and inp.schools_count == 0):
            demand_score = 30.0
            demand_state = "confirmed_zero"
            demand_desc = "No commercial demand anchors (offices/colleges) found in queried area."
            negative_risks.append("No matching commercial demand anchors detected in immediate zone.")
        else:
            demand_state = "observed"
            if btype == "Cafe":
                anchors = inp.offices_count * 2.0 + inp.colleges_count * 2.5 + (inp.bus_stops_count + inp.railway_stations_count) * 0.8
                target_anchors = 12.0
                demand_score = min(95.0, max(25.0, 30.0 + (anchors / target_anchors) * 65.0))
                if anchors >= 8:
                    positive_drivers.append(f"High daily customer activity from offices ({inp.offices_count}), colleges ({inp.colleges_count}), and transit hubs.")
                else:
                    negative_risks.append("Limited high-frequency commercial footfall anchors (offices/colleges) detected in immediate zone.")
            elif btype == "Pharmacy":
                anchors = inp.hospitals_count * 3.5 + (inp.bus_stops_count + inp.railway_stations_count) * 0.6
                target_anchors = 8.0
                demand_score = min(96.0, max(30.0, 32.0 + (anchors / target_anchors) * 64.0))
                if inp.hospitals_count >= 2:
                    positive_drivers.append(f"Strong medical prescription demand generated by {inp.hospitals_count} nearby hospital(s)/clinic(s).")
                else:
                    negative_risks.append("Few nearby healthcare facilities; pharmacy must rely primarily on OTC residential walk-ins.")
            elif btype == "Education Institute":
                anchors = inp.schools_count * 2.2 + inp.colleges_count * 3.0 + inp.bus_stops_count * 0.5
                target_anchors = 10.0
                demand_score = min(95.0, max(25.0, 30.0 + (anchors / target_anchors) * 65.0))
                if inp.schools_count + inp.colleges_count >= 4:
                    positive_drivers.append(f"Rich student demographic base ({inp.schools_count} schools, {inp.colleges_count} colleges).")
            elif btype == "Gym":
                anchors = inp.offices_count * 2.0 + inp.colleges_count * 1.5 + inp.bus_stops_count * 0.5
                demand_score = min(92.0, max(30.0, 35.0 + (anchors / 8.0) * 57.0))
            elif btype == "Restaurant":
                anchors = inp.offices_count * 2.2 + inp.colleges_count * 1.5 + (inp.bus_stops_count + inp.railway_stations_count) * 1.0
                demand_score = min(95.0, max(28.0, 30.0 + (anchors / 10.0) * 65.0))
            else:
                anchors = (inp.offices_count + inp.hospitals_count + inp.schools_count + inp.colleges_count) * 1.2
                demand_score = min(90.0, max(30.0, 35.0 + (anchors / 10.0) * 55.0))
            demand_desc = f"Demand drivers: offices ({inp.offices_count}), colleges ({inp.colleges_count}), civic anchors ({inp.schools_count + inp.hospitals_count})."

        # ── 3. Population & Customer Access Indicators (Weight: 20%) ────
        pop_is_estimated = False
        if transit_state == "unavailable" and civic_state == "unavailable":
            pop_score = 50.0  # Neutral prior
            pop_data_state = "unavailable"
            pop_is_estimated = True
            pop_desc = "Customer catchment infrastructure unverified due to data source failure."
            missing_data_warnings.append("Customer catchment indicators unverified due to query failure.")
        elif transit_state == "unavailable" or civic_state == "unavailable":
            pop_data_state = "partial"
            pop_is_estimated = True
            transit_nodes = inp.bus_stops_count + (inp.railway_stations_count * 3)
            civic_anchors = inp.schools_count + inp.hospitals_count
            urban_access_proxy = transit_nodes * 1.5 + civic_anchors * 1.2
            pop_score = min(95.0, max(40.0, 45.0 + (urban_access_proxy / 10.0) * 45.0))
            pop_desc = "Catchment partially estimated from available urban infrastructure nodes."
        elif transit_state == "confirmed_zero" and civic_state == "confirmed_zero":
            pop_score = 38.0
            pop_data_state = "confirmed_zero"
            pop_is_estimated = False
            pop_desc = "Confirmed absence of transit and civic anchors within queried radius."
            negative_risks.append("Confirmed absence of transit and civic facilities in queried radius.")
        else:
            pop_data_state = "observed"
            pop_is_estimated = False
            transit_nodes = inp.bus_stops_count + (inp.railway_stations_count * 3)
            civic_anchors = inp.schools_count + inp.hospitals_count
            urban_access_proxy = transit_nodes * 1.5 + civic_anchors * 1.2
            pop_score = min(95.0, max(30.0, 40.0 + (urban_access_proxy / 12.0) * 55.0))
            pop_desc = "Catchment vitality derived from verified transit nodes and civic infrastructure."

        if inp.population_estimate is not None:
            pop_ratio = min(1.5, inp.population_estimate / 100000.0)
            pop_score = round(pop_score * 0.5 + (pop_ratio * 60.0) * 0.5, 1)

        if pop_score >= 75 and pop_data_state == "observed":
            positive_drivers.append("High urban density and active pedestrian catchment indicated by transit and civic infrastructure.")

        # ── 4. Accessibility & Transport Connectivity (Weight: 15%) ────
        nearest_d: Optional[float] = inp.nearest_transit_dist_m
        acc_is_estimated = False

        if transit_state == "unavailable":
            acc_score = 50.0  # Neutral baseline prior
            nearest_d = None  # Do NOT report a fake distance
            acc_data_state = "unavailable"
            acc_is_estimated = True
            acc_desc = "Transit infrastructure could not be verified because the data source failed (unknown distance)."
            missing_data_warnings.append("Transit infrastructure could not be verified because the data source failed.")
        elif transit_state == "confirmed_zero" or (inp.bus_stops_count == 0 and inp.railway_stations_count == 0 and nearest_d is None):
            acc_score = 30.0
            acc_data_state = "confirmed_zero"
            acc_is_estimated = False
            nearest_d = None
            acc_desc = f"No matching transit features were found in the queried {inp.radius_meters}m area."
            negative_risks.append("Confirmed absence of transit stations within queried radius; location depends heavily on private vehicular access.")
        else:
            acc_data_state = "observed"
            acc_is_estimated = False
            if nearest_d is None:
                if inp.railway_stations_count > 0:
                    nearest_d = 300.0
                elif inp.bus_stops_count >= 3:
                    nearest_d = 200.0
                elif inp.bus_stops_count > 0:
                    nearest_d = 450.0

            if nearest_d is not None:
                if nearest_d <= 200.0:
                    acc_score = 95.0
                    positive_drivers.append(f"Outstanding transit connectivity (~{round(nearest_d)}m to nearest stop).")
                elif nearest_d <= 450.0:
                    acc_score = 80.0
                    positive_drivers.append(f"Good walkability to public transit (~{round(nearest_d)}m).")
                elif nearest_d <= 800.0:
                    acc_score = 58.0
                    negative_risks.append(f"Moderate distance to public transit (~{round(nearest_d)}m).")
                else:
                    acc_score = 30.0
                    negative_risks.append(f"Poor transit accessibility (>800m); business depends on private vehicular access.")
                acc_desc = f"Nearest public transit measured at ~{round(nearest_d)}m."
            else:
                acc_score = 50.0
                acc_desc = "Transit distance could not be determined."

        # ── 5. Complementary Amenities & Synergy (Weight: 10%) ─────────
        comp_amenities_estimated = False
        if civic_state == "unavailable" and demand_state == "unavailable":
            comp_amenities_score = 50.0  # Neutral prior
            comp_amenities_state = "unavailable"
            comp_amenities_estimated = True
            comp_amenities_desc = "Complementary amenities unverified due to data source timeout."
            missing_data_warnings.append("Complementary amenities could not be verified due to query timeout.")
        elif civic_state == "confirmed_zero" and demand_state == "confirmed_zero":
            comp_amenities_score = 30.0
            comp_amenities_state = "confirmed_zero"
            comp_amenities_estimated = False
            comp_amenities_desc = "Confirmed absence of complementary commercial/civic anchors in queried area."
        else:
            comp_amenities_state = "observed" if (civic_state == "observed" or demand_state == "observed") else "partial"
            comp_amenities_estimated = (comp_amenities_state == "partial")
            if btype == "Cafe":
                synergy_count = inp.offices_count + inp.colleges_count + inp.schools_count
            elif btype == "Pharmacy":
                synergy_count = inp.hospitals_count * 2 + inp.offices_count
            elif btype == "Education Institute":
                synergy_count = inp.schools_count + inp.colleges_count + inp.bus_stops_count
            else:
                synergy_count = inp.offices_count + inp.hospitals_count + inp.schools_count

            comp_amenities_score = min(95.0, max(25.0, 30.0 + (synergy_count / 8.0) * 65.0))
            if synergy_count >= 5:
                positive_drivers.append(f"Favorable commercial ecosystem with {synergy_count} complementary anchors.")
            comp_amenities_desc = f"Surrounding ecosystem with {synergy_count} complementary anchors."

        # ── 6. Location Risk & Data Confidence (Weight: 10%) ───────────
        conf_points = 50.0
        if inp.data_source == "google_places":
            conf_points += 25.0
        elif inp.data_source == "osm":
            conf_points += 15.0

        total_pois_detected = (
            inp.competitors_count + inp.hospitals_count + inp.schools_count +
            inp.colleges_count + inp.offices_count + inp.bus_stops_count + inp.railway_stations_count
        )

        unavail_count = sum(1 for s in [comp_state, transit_state, civic_state, demand_state] if s == "unavailable")

        if unavail_count >= 2:
            conf_points -= 45.0
            confidence_level = "Low"
            is_provisional = True
        elif unavail_count == 1:
            conf_points -= 25.0
            confidence_level = "Medium"
            is_provisional = True
        else:
            # All categories completed without API failure
            if total_pois_detected >= 15:
                conf_points += 25.0
            elif total_pois_detected >= 6:
                conf_points += 15.0
            elif total_pois_detected >= 1:
                conf_points += 5.0
            else:
                conf_points -= 25.0
                missing_data_warnings.append(f"Sparse POI density ({total_pois_detected} total venues found); score is provisional.")

            risk_conf_score_calc = max(20.0, min(100.0, conf_points))
            if risk_conf_score_calc >= 70:
                confidence_level = "High"
                is_provisional = False
            elif risk_conf_score_calc >= 48:
                confidence_level = "Medium"
                is_provisional = False
            else:
                confidence_level = "Low"
                is_provisional = True

        risk_conf_score = max(15.0, min(100.0, conf_points))

        # ── Multi-Criteria Weighted Base Score Calculation ─────────────
        w_comp = weights.get("competitor_density", 0.20)
        w_dem = weights.get("business_demand", 0.25)
        w_pop = weights.get("customer_access", 0.20)
        w_acc = weights.get("accessibility", 0.15)
        w_amen = weights.get("complementary_amenities", 0.10)
        w_risk = weights.get("risk_and_confidence", 0.10)

        total_w = w_comp + w_dem + w_pop + w_acc + w_amen + w_risk
        weighted_base = (
            comp_score * w_comp +
            demand_score * w_dem +
            pop_score * w_pop +
            acc_score * w_acc +
            comp_amenities_score * w_amen +
            risk_conf_score * w_risk
        ) / total_w

        # ── Soft Computing (Mamdani Fuzzy Inference) ───────────────────
        fuzzy_score, _fuzzy_label = evaluate_fuzzy_suitability(
            competition_score=comp_score,
            demand_score=demand_score,
            accessibility_score=acc_score,
        )

        # ── Blending Formula (MCDA 70% + Fuzzy Logic 30%) ──────────────
        final_score_raw = 0.70 * weighted_base + 0.30 * fuzzy_score
        final_score = int(round(final_score_raw))
        final_score = max(0, min(100, final_score))

        # Suitability classification (Official bands preserved)
        if final_score >= 80:
            suitability_label = "Excellent"
            rec_text = (
                f"Strong candidate location for {btype}. The area combines active customer footfall "
                f"and viable competitive headroom. Recommended for detailed footfall validation and lease exploration."
            )
        elif final_score >= 65:
            suitability_label = "Good"
            rec_text = (
                f"Promising site for {btype}. Demonstrates solid demand indicators with manageable competitive pressure. "
                f"Inspect exact street frontage, pedestrian flows, and rental terms."
            )
        elif final_score >= 50:
            suitability_label = "Fair"
            rec_text = (
                f"Moderate suitability for {btype}. Trade-offs exist between competitive saturation and customer reach. "
                f"Requires differentiated concept or prime micro-corner location to succeed."
            )
        else:
            suitability_label = "Poor"
            rec_text = (
                f"Challenging location for {btype} under current data. Weak demand drivers or heavy saturation present elevated risk. "
                f"Investigate alternative candidate sectors within {inp.city_name}."
            )

        # Build factors list with explicit data state and estimation tracking
        factors: List[FactorDetail] = [
            FactorDetail(
                name="Competitor Density",
                key="competitor_density",
                score=round(comp_score, 1),
                weight_percent=round(w_comp * 100, 1),
                weighted_contribution=round(comp_score * w_comp, 1),
                description=comp_desc,
                status="strong" if comp_score >= 75 else ("moderate" if comp_score >= 50 else "risk"),
                data_state=comp_state,
                is_estimated=comp_is_estimated,
                raw_count=inp.competitors_count,
            ),
            FactorDetail(
                name="Relevant Business Demand",
                key="business_demand",
                score=round(demand_score, 1),
                weight_percent=round(w_dem * 100, 1),
                weighted_contribution=round(demand_score * w_dem, 1),
                description=demand_desc,
                status="strong" if demand_score >= 75 else ("moderate" if demand_score >= 50 else "risk"),
                data_state=demand_state,
                is_estimated=demand_is_estimated,
                raw_count=inp.offices_count + inp.colleges_count,
            ),
            FactorDetail(
                name="Customer Access & Catchment",
                key="customer_access",
                score=round(pop_score, 1),
                weight_percent=round(w_pop * 100, 1),
                weighted_contribution=round(pop_score * w_pop, 1),
                description=pop_desc,
                status="strong" if pop_score >= 75 else ("moderate" if pop_score >= 50 else "risk"),
                data_state=pop_data_state,
                is_estimated=pop_is_estimated,
                raw_count=inp.schools_count + inp.hospitals_count,
            ),
            FactorDetail(
                name="Transport Accessibility",
                key="accessibility",
                score=round(acc_score, 1),
                weight_percent=round(w_acc * 100, 1),
                weighted_contribution=round(acc_score * w_acc, 1),
                description=acc_desc,
                status="strong" if acc_score >= 75 else ("moderate" if acc_score >= 50 else "risk"),
                data_state=acc_data_state,
                is_estimated=acc_is_estimated,
                raw_count=inp.bus_stops_count + inp.railway_stations_count,
            ),
            FactorDetail(
                name="Complementary Amenities",
                key="complementary_amenities",
                score=round(comp_amenities_score, 1),
                weight_percent=round(w_amen * 100, 1),
                weighted_contribution=round(comp_amenities_score * w_amen, 1),
                description=comp_amenities_desc,
                status="strong" if comp_amenities_score >= 75 else ("moderate" if comp_amenities_score >= 50 else "risk"),
                data_state=comp_amenities_state,
                is_estimated=comp_amenities_estimated,
                raw_count=inp.schools_count + inp.offices_count + inp.colleges_count,
            ),
            FactorDetail(
                name="Data Confidence & Risk",
                key="risk_and_confidence",
                score=round(risk_conf_score, 1),
                weight_percent=round(w_risk * 100, 1),
                weighted_contribution=round(risk_conf_score * w_risk, 1),
                description=f"Confidence: {confidence_level} ({inp.data_source}, {total_pois_detected} mapped POIs, {unavail_count} unavailable categories).",
                status="strong" if risk_conf_score >= 75 else ("moderate" if risk_conf_score >= 50 else "risk"),
                data_state="observed" if unavail_count == 0 else "partial",
                is_estimated=is_provisional,
                raw_count=total_pois_detected,
            ),
        ]

        explanation_summary = (
            f"{suitability_label} suitability ({final_score}/100) for {btype} in {inp.city_name}. "
            f"Competitor density is {factors[0].status} ({inp.competitors_count} competitors), "
            f"and business demand is {factors[1].status}."
        )

        doc = (
            "Final Score = round(0.70 * MCDA_Score + 0.30 * Fuzzy_Score), where "
            "MCDA_Score = sum(Factor_i * Weight_i) across 6 factors, and "
            "Fuzzy_Score = Mamdani Min-Max Inference on (Competition, Demand, Accessibility) "
            "with Weighted Centroid Defuzzification."
        )

        return LocationScoringResult(
            overall_score=final_score,
            suitability_label=suitability_label,
            confidence_level=confidence_level,
            is_provisional=is_provisional,
            weighted_base_score=round(weighted_base, 1),
            fuzzy_suitability_score=fuzzy_score,
            factors=factors,
            positive_drivers=positive_drivers,
            negative_risks=negative_risks,
            missing_data_warnings=missing_data_warnings,
            practical_recommendation=rec_text,
            explanation=explanation_summary,
            competitor_count=inp.competitors_count,
            radius_meters=inp.radius_meters,
            business_type=btype,
            city_name=inp.city_name,
            formula_documentation=doc,
        )
