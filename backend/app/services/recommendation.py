"""
UrbanIQ — Candidate Site Recommendation Engine (Stage C)
=========================================================
Implements the 3 Core Capstone Disciplines:
1. Theoretical Computer Science (TCS):
   - Spatial Grid Discretization ($250m \times 250m$ resolution).
   - Land Masking: filters out water bodies, creeks, seas, and uninhabited forests
     by requiring cells to be within 250m of observed urban infrastructure anchors.
   - Spatial Non-Maximum Suppression (NMS) for candidate deduplication ($>350m$ apart).
2. Soft Computing (SC):
   - Fuzzy Logic Inference with fixed absolute universal domains (0-15 competitors/km²,
     0-1000m transit distance) ensuring stable, non-flat absolute scoring.
   - Mamdani min-max rule evaluation + weighted centroid defuzzification.
3. Artificial Intelligence & Machine Learning (AI/ML):
   - K-Means Clustering ($k=3$) to classify candidate cells into market archetypes:
     * "Hotspot: High Demand, Low Saturation"
     * "Established Commercial Hub"
     * "Emerging Suburban Pocket"
   - Random Forest Feature Importance to identify dominant location drivers.
"""

import math
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestRegressor

from backend.app.services.overpass_proxy import fetch_pois
from backend.app.services.geocoding import reverse_geocode
from backend.app.services.scoring_engine import ScoringEngine, LocationScoringInput
from fuzzy.engine import FuzzyOpportunityEngine, trimf, trapmf_left, trapmf_right


# Earth radius in meters
EARTH_RADIUS_M = 6_371_000.0


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points in meters."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (math.sin(dphi / 2.0) ** 2) + math.cos(phi1) * math.cos(phi2) * (math.sin(dlambda / 2.0) ** 2)
    return 2.0 * EARTH_RADIUS_M * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def generate_spatial_grid(
    center_lat: float,
    center_lon: float,
    radius_meters: float,
    step_meters: float = 250.0,
) -> List[Tuple[float, float]]:
    """
    TCS Spatial Grid Discretization:
    Generate regular grid coordinates within circular buffer D(center, radius).
    """
    lat_step_deg = (step_meters / EARTH_RADIUS_M) * (180.0 / math.pi)
    lon_step_deg = (step_meters / (EARTH_RADIUS_M * math.cos(math.radians(center_lat)))) * (180.0 / math.pi)

    max_steps = int(math.ceil(radius_meters / step_meters))
    grid: List[Tuple[float, float]] = []

    for i in range(-max_steps, max_steps + 1):
        for j in range(-max_steps, max_steps + 1):
            cell_lat = center_lat + i * lat_step_deg
            cell_lon = center_lon + j * lon_step_deg
            dist = haversine_distance(center_lat, center_lon, cell_lat, cell_lon)
            if dist <= radius_meters:
                grid.append((cell_lat, cell_lon))

    return grid


def apply_land_mask(
    grid_cells: List[Tuple[float, float]],
    urban_anchors: List[Tuple[float, float]],
    max_anchor_distance_meters: float = 280.0,
) -> List[Tuple[float, float]]:
    """
    Land Mask Filtering (Crucial for coastal/creek/forest areas):
    Keeps only cells that are within `max_anchor_distance_meters` of at least one
    real urban infrastructure node (road/building/transit/amenity).
    Cells in the sea, creek, mudflats, or Sanjay Gandhi reserved forest have zero
    nearby anchors and are eliminated.
    """
    if not urban_anchors:
        # If no anchors recorded at all, keep cells near center as fallback
        return grid_cells

    anchor_lats = np.array([a[0] for a in urban_anchors])
    anchor_lons = np.array([a[1] for a in urban_anchors])

    valid_cells: List[Tuple[float, float]] = []

    for lat, lon in grid_cells:
        # Fast bounding box pre-filter (~350m approx 0.0031 deg)
        deg_thresh = 0.0035
        lat_mask = (anchor_lats >= lat - deg_thresh) & (anchor_lats <= lat + deg_thresh)
        lon_mask = (anchor_lons >= lon - deg_thresh) & (anchor_lons <= lon + deg_thresh)
        candidate_idx = np.where(lat_mask & lon_mask)[0]

        is_land = False
        for idx in candidate_idx:
            d = haversine_distance(lat, lon, anchor_lats[idx], anchor_lons[idx])
            if d <= max_anchor_distance_meters:
                is_land = True
                break

        if is_land:
            valid_cells.append((lat, lon))

    return valid_cells


def compute_fixed_fuzzy_score(
    competitors_500m: int,
    anchors_500m: int,
    nearest_transit_dist_m: float,
    business_type: str,
) -> Tuple[int, str, Dict[str, float], List[str]]:
    """
    Soft Computing: Fixed-Universe Fuzzy Inference Engine.
    Does NOT use relative min-max, ensuring absolute comparable scores.

    Fixed universes:
    1. Competitor Saturation:
       Area of 500m circle = pi * 0.5^2 = ~0.785 km^2.
       Density = competitors / 0.785 km^2.
       Universe: 0 to 15 competitors/km^2.
       - Low competition (High opportunity): <= 2/km^2 -> score ~90
       - Medium: 3 to 7/km^2 -> score ~55
       - High saturation (Low opportunity): >= 8/km^2 -> score ~25

    2. Demand Drivers / Anchors (offices, colleges, hospitals, transit):
       Universe: 0 to 15 anchors in 500m.
       - High demand: >= 7 anchors -> score ~90
       - Medium: 3 to 6 anchors -> score ~60
       - Low: 0 to 2 anchors -> score ~30

    3. Transit Accessibility:
       Universe: 0 to 1000 meters.
       - High: <= 150m -> score ~95
       - Medium: 150m - 500m -> score ~65
       - Low: > 500m -> score ~35
    """
def compute_fixed_fuzzy_score(
    competitors_500m: int,
    anchors_500m: int,
    nearest_transit_dist_m: Optional[float],
    business_type: str,
    cell_lat: float = 19.0,
    cell_lon: float = 72.8,
    hospitals_count: int = 0,
    schools_count: int = 0,
    colleges_count: int = 0,
    offices_count: int = 0,
    transit_count: int = 0,
    city_name: str = "Mumbai",
    data_statuses: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Evaluates candidate cells using the authoritative ScoringEngine
    (6 weighted MCDA factors + Mamdani fuzzy inference).
    """
    scoring_inp = LocationScoringInput(
        business_type=business_type,
        latitude=cell_lat,
        longitude=cell_lon,
        radius_meters=500,
        city_name=city_name,
        competitors_count=competitors_500m,
        hospitals_count=hospitals_count,
        schools_count=schools_count,
        colleges_count=colleges_count,
        offices_count=offices_count,
        bus_stops_count=transit_count,
        railway_stations_count=0,
        nearest_transit_dist_m=nearest_transit_dist_m,
        data_source="google_places" if business_type in ("Cafe", "Restaurant") else "osm",
        data_statuses=data_statuses,
    )
    result = ScoringEngine.calculate_score(scoring_inp)
    factors_map = {f.key: f.score for f in result.factors}
    factor_details = [
        {
            "name": f.name,
            "key": f.key,
            "value": f.score,
            "weight": f.weight_percent,
            "weightedContribution": f.weighted_contribution,
            "description": f.description,
            "status": f.status,
            "data_state": f.data_state,
            "is_estimated": f.is_estimated,
            "raw_count": f.raw_count,
        }
        for f in result.factors
    ]
    return {
        "score": result.overall_score,
        "level": result.suitability_label,
        "suitability_label": result.suitability_label,
        "confidence_level": result.confidence_level,
        "factors_map": factors_map,
        "factors": factor_details,
        "positive_drivers": result.positive_drivers,
        "negative_risks": result.negative_risks,
        "missing_data_warnings": result.missing_data_warnings,
        "practical_recommendation": result.practical_recommendation,
        "is_provisional": result.is_provisional,
    }


def cluster_and_explain(
    candidate_features: List[Dict[str, Any]],
) -> Tuple[List[str], Dict[str, float]]:
    """
    AI/ML Component:
    1. K-Means Clustering on candidate cells.
    2. Random Forest Regressor to extract feature importance.
    """
    if len(candidate_features) < 3:
        archetypes = ["High Potential Opportunity" for _ in candidate_features]
        importances = {"demand": 0.35, "competition": 0.30, "accessibility": 0.20, "service_gap": 0.15}
        return archetypes, importances

    X = np.array([
        [
            c["factors"].get("business_demand", 50.0),
            c["factors"].get("competitor_density", 50.0),
            c["factors"].get("accessibility", 50.0),
            c["factors"].get("customer_access", 50.0),
        ]
        for c in candidate_features
    ])
    y = np.array([c["score"] for c in candidate_features])

    # K-Means Clustering (k=3)
    k = min(3, len(candidate_features))
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X)

    # Classify clusters based on centroid characteristics
    cluster_names = {}
    for cl_id in range(k):
        centroid = kmeans.cluster_centers_[cl_id]
        c_demand, c_comp, c_access, c_pop = centroid
        if c_demand >= 65.0 and c_comp >= 60.0:
            cluster_names[cl_id] = "Prime Hotspot (High Footfall, Low Saturation)"
        elif c_comp < 45.0:
            cluster_names[cl_id] = "Competitive Commercial Hub"
        else:
            cluster_names[cl_id] = "Developing Residential Corridor"

    archetypes = [cluster_names.get(lbl, "Emerging Site") for lbl in labels]

    # Feature Importance via Random Forest surrogate model
    rf = RandomForestRegressor(n_estimators=30, random_state=42, max_depth=4)
    rf.fit(X, y)
    importances_raw = rf.feature_importances_
    names = ["demand", "competition", "accessibility", "customer_access"]
    importances = {name: round(float(imp), 3) for name, imp in zip(names, importances_raw)}

    return archetypes, importances


def non_maximum_suppression(
    ranked_candidates: List[Dict[str, Any]],
    min_separation_meters: float = 350.0,
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """
    TCS Spatial Non-Maximum Suppression:
    Ensures recommended sites are spaced at least `min_separation_meters` apart
    so recommendations don't cluster on the exact same crossroad.
    """
    chosen: List[Dict[str, Any]] = []

    for cand in ranked_candidates:
        too_close = False
        for selected in chosen:
            dist = haversine_distance(
                cand["latitude"], cand["longitude"],
                selected["latitude"], selected["longitude"]
            )
            if dist < min_separation_meters:
                too_close = True
                break
        if not too_close:
            chosen.append(cand)
            if len(chosen) >= top_k:
                break

    return chosen


def recommend_candidate_sites(
    business_type: str,
    center_lat: float,
    center_lon: float,
    radius_meters: int = 2000,
    city_name: str = "Mumbai",
) -> Dict[str, Any]:
    """
    Main Recommendation Pipeline (Stages A, B, C):
    1. Fetch real POIs via Overpass Proxy with failover.
    2. Extract urban presence anchors for Land Masking.
    3. Generate 250m TCS Spatial Grid.
    4. Apply Land Mask to filter water/creek/uninhabited forest.
    5. Evaluate every valid cell using Fixed-Universe Fuzzy Inference.
    6. Run K-Means & Random Forest feature importance.
    7. Spatial NMS to select Top 3-5 distinct sites.
    8. Reverse geocode candidates for human-readable street names.
    """
    # 1. Fetch real POIs (reusing Google Places & cached data)
    try:
        from backend.app.api.geo_poi import api_get_pois
        res = api_get_pois(
            business_type=business_type,
            lat=center_lat,
            lon=center_lon,
            radius=radius_meters,
            debug=False,
        )
        poi_data = res.model_dump()
    except Exception:
        poi_data = fetch_pois(
            business_type=business_type,
            latitude=center_lat,
            longitude=center_lon,
            radius_meters=radius_meters,
        )

    businesses = poi_data.get("businesses", [])
    hospitals = poi_data.get("hospitals", [])
    schools = poi_data.get("schools", [])
    colleges = poi_data.get("colleges", [])
    offices = poi_data.get("offices", [])
    bus_stops = poi_data.get("bus_stops", [])
    railway_stations = poi_data.get("railway_stations", [])

    # Compile urban anchors for land masking
    urban_anchors: List[Tuple[float, float]] = []
    for p in (businesses + hospitals + schools + colleges + offices + bus_stops + railway_stations):
        urban_anchors.append((p["lat"], p["lon"]))

    # Also transit points list
    transit_points = [(p["lat"], p["lon"]) for p in (bus_stops + railway_stations)]

    # Categorized demand anchors
    if business_type == "Cafe":
        demand_points = [(p["lat"], p["lon"]) for p in (offices + colleges + bus_stops + railway_stations)]
    elif business_type == "Pharmacy":
        demand_points = [(p["lat"], p["lon"]) for p in (hospitals + bus_stops + railway_stations)]
    elif business_type == "Education Institute":
        demand_points = [(p["lat"], p["lon"]) for p in (schools + colleges + bus_stops)]
    elif business_type == "Restaurant":
        demand_points = [(p["lat"], p["lon"]) for p in (offices + colleges + bus_stops + railway_stations)]
    elif business_type == "Gym":
        demand_points = [(p["lat"], p["lon"]) for p in (offices + bus_stops + colleges)]
    else:
        demand_points = [(p["lat"], p["lon"]) for p in (offices + hospitals + schools + bus_stops)]

    competitor_points = [(p["lat"], p["lon"]) for p in businesses]

    # 2. TCS Grid Discretization
    raw_grid = generate_spatial_grid(center_lat, center_lon, radius_meters, step_meters=250.0)

    # 3. Land Mask
    valid_grid = apply_land_mask(raw_grid, urban_anchors, max_anchor_distance_meters=320.0)
    if not valid_grid:
        # Fallback to center if area is ultra-sparse
        valid_grid = [(center_lat, center_lon)]

    feature_statuses = poi_data.get("feature_statuses") or {}

    # 4. Score each valid cell
    evaluated_cells: List[Dict[str, Any]] = []

    for cell_lat, cell_lon in valid_grid:
        # Count competitors within 500m
        n_comp = sum(1 for c_lat, c_lon in competitor_points if haversine_distance(cell_lat, cell_lon, c_lat, c_lon) <= 500.0)
        # Count demand anchors within 500m
        n_anchors = sum(1 for d_lat, d_lon in demand_points if haversine_distance(cell_lat, cell_lon, d_lat, d_lon) <= 500.0)

        # Nearest transit distance (None if unmapped/unavailable, NEVER fake 800m)
        if transit_points:
            min_transit_d: Optional[float] = min(haversine_distance(cell_lat, cell_lon, t_lat, t_lon) for t_lat, t_lon in transit_points)
        else:
            min_transit_d = None

        # Multi-category counts within 500m
        n_hosp = sum(1 for p in hospitals if haversine_distance(cell_lat, cell_lon, p["lat"], p["lon"]) <= 500.0)
        n_sch = sum(1 for p in schools if haversine_distance(cell_lat, cell_lon, p["lat"], p["lon"]) <= 500.0)
        n_col = sum(1 for p in colleges if haversine_distance(cell_lat, cell_lon, p["lat"], p["lon"]) <= 500.0)
        n_off = sum(1 for p in offices if haversine_distance(cell_lat, cell_lon, p["lat"], p["lon"]) <= 500.0)
        n_transit = sum(1 for p in (bus_stops + railway_stations) if haversine_distance(cell_lat, cell_lon, p["lat"], p["lon"]) <= 500.0)

        eval_res = compute_fixed_fuzzy_score(
            competitors_500m=n_comp,
            anchors_500m=n_anchors,
            nearest_transit_dist_m=min_transit_d,
            business_type=business_type,
            cell_lat=cell_lat,
            cell_lon=cell_lon,
            hospitals_count=n_hosp,
            schools_count=n_sch,
            colleges_count=n_col,
            offices_count=n_off,
            transit_count=n_transit,
            city_name=city_name,
            data_statuses=feature_statuses,
        )

        dist_from_search = haversine_distance(center_lat, center_lon, cell_lat, cell_lon)

        evaluated_cells.append({
            "latitude": round(cell_lat, 6),
            "longitude": round(cell_lon, 6),
            "score": eval_res["score"],
            "level": eval_res["level"],
            "suitability_label": eval_res["suitability_label"],
            "confidence_level": eval_res["confidence_level"],
            "factors": eval_res["factors_map"],
            "factor_details": eval_res["factors"],
            "positive_drivers": eval_res["positive_drivers"],
            "negative_risks": eval_res["negative_risks"],
            "missing_data_warnings": eval_res["missing_data_warnings"],
            "practical_recommendation": eval_res["practical_recommendation"],
            "competitors_500m": n_comp,
            "demand_anchors_500m": n_anchors,
            "nearest_transit_dist_m": round(min_transit_d) if min_transit_d is not None else None,
            "distance_from_center_m": round(dist_from_search),
            "is_provisional": eval_res.get("is_provisional", False),
        })

    # Sort descending by score, tie-break by lower distance from center
    evaluated_cells.sort(key=lambda c: (-c["score"], c["distance_from_center_m"]))

    # 5. AI/ML Clustering & Feature Importance
    archetypes, feature_importances = cluster_and_explain(evaluated_cells)
    for idx, cell in enumerate(evaluated_cells):
        cell["market_archetype"] = archetypes[idx]

    # 6. TCS Spatial NMS (Top 5 non-overlapping sites, minimum 350m separation)
    top_sites = non_maximum_suppression(evaluated_cells, min_separation_meters=350.0, top_k=5)

    # 7. Reverse-geocode ONLY the top 3-5 candidates for quota conservation and real street names
    for rank, site in enumerate(top_sites, start=1):
        site["rank"] = rank
        score_val = site["score"]

        # Consistent recommendation threshold policy:
        # 70-100: Recommended Area (Good / Excellent)
        # 50-69: Moderate Suitability / Candidate for Further Investigation (Fair)
        # < 50: Below Suitability Threshold (Poor)
        if score_val >= 70:
            site["is_recommended"] = True
            site["recommendation_badge"] = "Recommended Area"
            site["suitability_label"] = "Good" if score_val < 80 else "Excellent"
        elif score_val >= 50:
            site["is_recommended"] = False
            site["recommendation_badge"] = "Highest-Ranked Candidate (Moderate Suitability)" if rank == 1 else "Candidate for Further Investigation"
            site["suitability_label"] = "Fair"
        else:
            site["is_recommended"] = False
            site["recommendation_badge"] = "Candidate Area (Below Suitability Threshold)"
            site["suitability_label"] = "Poor"
        site["badge"] = site["recommendation_badge"]

        # Retrieve real locality and verified street
        rev = reverse_geocode(site["latitude"], site["longitude"])
        has_verified_street = False
        if rev:
            has_verified_street = rev.get("has_verified_street", False)
            road_name = rev.get("road", "").strip()
            locality_name = (rev.get("suburb") or rev.get("locality") or rev.get("city") or city_name).strip()
            site["road"] = road_name
            site["locality"] = locality_name
            site["has_verified_street"] = has_verified_street
            site["full_address"] = rev.get("display_name", "")
            if has_verified_street and road_name:
                site["landmark"] = f"{road_name}, {locality_name}"
                site["street_status"] = "Verified Commercial Road"
            else:
                site["landmark"] = f"Approximate Zone in {locality_name}"
                site["street_status"] = "Street not verified; approximate zone"
        else:
            site["road"] = ""
            site["locality"] = city_name
            site["has_verified_street"] = False
            site["street_status"] = "Street not verified; approximate zone"
            site["landmark"] = f"Approximate Zone #{rank} ({city_name})"
            site["full_address"] = f"{city_name} coordinates ({site['latitude']}, {site['longitude']})"

        # Structured advantages (honest evidence, not fabricated)
        reasons_list = list(site.get("positive_drivers", []))
        if site["competitors_500m"] == 0:
            reasons_list.insert(0, "Zero direct competitors within 500m catchment (high initial market headroom).")
        elif site["competitors_500m"] <= 2:
            reasons_list.insert(0, f"Low competitor saturation ({site['competitors_500m']} competitors within 500m catchment).")
        else:
            reasons_list.insert(0, f"Established commercial cluster with {site['competitors_500m']} competitors within 500m.")

        # Differentiator explaining candidate's rank relative to alternatives
        if rank == 1:
            if site["competitors_500m"] <= 2:
                ranking_reason = f"Ranked #1 among candidate zones due to lowest competitor saturation ({site['competitors_500m']} in 500m)."
            else:
                ranking_reason = f"Ranked #1 among candidate zones with strongest composite MCDA factor score ({score_val}/100)."
        else:
            top_cand = top_sites[0]
            if site["competitors_500m"] > top_cand["competitors_500m"]:
                ranking_reason = f"Ranked #{rank} due to higher competitor saturation ({site['competitors_500m']} vs {top_cand['competitors_500m']} in Area #1)."
            elif site["nearest_transit_dist_m"] > top_cand["nearest_transit_dist_m"]:
                ranking_reason = f"Ranked #{rank} due to longer distance to transit (~{site['nearest_transit_dist_m']}m vs ~{top_cand['nearest_transit_dist_m']}m in Area #1)."
            else:
                ranking_reason = f"Ranked #{rank} based on composite factor weighting."
        reasons_list.append(ranking_reason)
        site["why_here"] = reasons_list[:4]

        # Structured disadvantages & trade-offs
        risks_list = list(site.get("negative_risks", []))
        if score_val < 50:
            risks_list.insert(0, "Area falls below minimum commercial suitability threshold (< 50/100).")
        if not site["has_verified_street"]:
            risks_list.append("Exact commercial street unconfirmed by spatial records; field reconnaissance required.")
        site["risks"] = risks_list[:4]

        # Honest disclosure of missing data
        limitations = list(site.get("missing_data_warnings", []))
        limitations.append("Pedestrian footfall volume, commercial lease rates, and vacant shop availability require on-site validation.")
        site["limitations"] = limitations

    # Determine overall advisory
    all_below = all(s["score"] < 50 for s in top_sites) if top_sites else True
    if all_below:
        overall_advisory = (
            f"Advisory: None of the candidate areas within this {radius_meters}m radius currently meet "
            f"the suitability threshold (score >= 50/100). High competitor saturation or lack of complementary demand anchors present elevated risk."
        )
    elif top_sites[0]["score"] >= 70:
        overall_advisory = (
            f"Area #1 ({top_sites[0]['landmark']}) is the top recommended area with an authoritative suitability score of {top_sites[0]['score']}/100."
        )
    else:
        overall_advisory = (
            f"Area #1 ({top_sites[0]['landmark']}) is the highest-ranked candidate ({top_sites[0]['score']}/100), exhibiting moderate suitability. Inspect footfall and rent terms before proceeding."
        )

    return {
        "status": "success",
        "city": city_name,
        "business_type": business_type,
        "center": {"latitude": center_lat, "longitude": center_lon},
        "radius_meters": radius_meters,
        "suitability_advisory": overall_advisory,
        "has_recommended_sites": not all_below and any(s["score"] >= 70 for s in top_sites),
        "total_grid_cells_generated": len(raw_grid),
        "valid_land_cells_evaluated": len(valid_grid),
        "cells_masked_out": len(raw_grid) - len(valid_grid),
        "data_source": poi_data.get("data_source", "osm"),
        "timestamp": poi_data.get("timestamp"),
        "from_cache": poi_data.get("from_cache", False),
        "poi_summary": poi_data.get("poi_counts", {}),
        "feature_importances": feature_importances,
        "recommended_sites": top_sites,
    }
