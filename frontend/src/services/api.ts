import type {
  City,
  Category,
  OpportunityRequest,
  OpportunityResponse,
  CompetitionAnalysisResult,
  ServiceGapResult,
  GeocodeResult,
  ReverseGeocodeResult,
  POIResponse,
} from "../types/api";

// All API calls go through this single base URL.
// Change this one line if the backend port or domain ever changes.
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

/**
 * Generic HTTP fetch helper with clean JSON parsing.
 * Throws a descriptive error on non-2xx responses.
 */
async function fetchFromApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status} from ${endpoint}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

// ──────────────────────────────────────────────
// CATEGORIES
// ──────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetchFromApi<{ total: number; data: Category[] }>("/categories");
    return res.data;
  } catch (err) {
    // Graceful fallback for offline / presentation mode
    console.warn("[UrbanIQ] Backend unavailable, using fallback categories:", err);
    return [
      {
        id: "healthcare",
        name: "Healthcare",
        description: "Hospitals, clinics, and pharmacies.",
        icon: "activity",
        target_amenities: ["hospital", "clinic", "pharmacy"],
        is_active: true,
      },
      {
        id: "education",
        name: "Education",
        description: "Schools, colleges, and institutes.",
        icon: "book-open",
        target_amenities: ["school", "college"],
        is_active: true,
      },
      {
        id: "food-restaurant",
        name: "Food & Restaurant",
        description: "Dining, cafes, and quick service.",
        icon: "utensils",
        target_amenities: ["restaurant", "cafe"],
        is_active: true,
      },
    ];
  }
}

// ──────────────────────────────────────────────
// CITIES
// ──────────────────────────────────────────────

export async function getCities(): Promise<City[]> {
  try {
    const res = await fetchFromApi<{ total: number; data: City[] }>("/cities");
    return res.data;
  } catch (err) {
    console.warn("[UrbanIQ] Backend unavailable, using fallback cities:", err);
    return [
      {
        id: "pune",
        name: "Pune",
        state: "Maharashtra",
        center: { latitude: 18.5204, longitude: 73.8567 },
        study_radius_km: 20.0,
        observed_population: 3556000,
        data_source: "Pune Municipal Corporation ESR 2021-22",
        data_confidence: "Estimated / Proxy (PMC 2021-22)",
      },
      {
        id: "mumbai",
        name: "Mumbai",
        state: "Maharashtra",
        center: { latitude: 19.076, longitude: 72.8777 },
        study_radius_km: 25.0,
        observed_population: 12442373,
        data_source: "Census of India 2011 (Proxy Baseline)",
        data_confidence: "Historical Census Proxy",
      },
      {
        id: "nashik",
        name: "Nashik",
        state: "Maharashtra",
        center: { latitude: 19.9975, longitude: 73.7898 },
        study_radius_km: 15.0,
        observed_population: 1486053,
        data_source: "Census of India 2011 (Proxy Baseline)",
        data_confidence: "Historical Census Proxy",
      },
    ];
  }
}

// ──────────────────────────────────────────────
// OPPORTUNITY ENGINE (POST)
// ──────────────────────────────────────────────

export async function calculateOpportunity(
  req: OpportunityRequest
): Promise<OpportunityResponse> {
  return fetchFromApi<OpportunityResponse>("/opportunity", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ──────────────────────────────────────────────
// COMPETITION ANALYSIS
// ──────────────────────────────────────────────

export async function getCompetition(
  categoryId: string,
  lat: number,
  lon: number,
  radius = 2000
): Promise<CompetitionAnalysisResult> {
  return fetchFromApi<CompetitionAnalysisResult>(
    `/competition?category_id=${encodeURIComponent(categoryId)}&latitude=${lat}&longitude=${lon}&radius_meters=${radius}`
  );
}

// ──────────────────────────────────────────────
// SERVICE GAP ANALYSIS
// ──────────────────────────────────────────────

export async function getServiceGap(
  categoryId: string,
  lat: number,
  lon: number,
  populationProxy = 100000,
  radius = 2000
): Promise<ServiceGapResult> {
  return fetchFromApi<ServiceGapResult>(
    `/service-gap?category_id=${encodeURIComponent(categoryId)}&latitude=${lat}&longitude=${lon}&radius_meters=${radius}&population_proxy=${populationProxy}`
  );
}

// ──────────────────────────────────────────────
// GEOCODING & POI PROXY (STAGES A & B)
// ──────────────────────────────────────────────

export async function geocodeLocation(
  query: string,
  city = "pune"
): Promise<GeocodeResult> {
  return fetchFromApi<GeocodeResult>("/geocode", {
    method: "POST",
    body: JSON.stringify({ query, city }),
  });
}

export async function reverseGeocodeLocation(
  lat: number,
  lon: number
): Promise<ReverseGeocodeResult> {
  return fetchFromApi<ReverseGeocodeResult>(
    `/reverse-geocode?lat=${lat}&lon=${lon}`
  );
}

export async function fetchPois(
  businessType: string,
  lat: number,
  lon: number,
  radius = 2000,
  debug = false,
  signal?: AbortSignal
): Promise<POIResponse> {
  return fetchFromApi<POIResponse>(
    `/pois?business_type=${encodeURIComponent(businessType)}&lat=${lat}&lon=${lon}&radius=${radius}${debug ? "&debug=true" : ""}`,
    { signal }
  );
}

// ──────────────────────────────────────────────
// CANDIDATE AREA DISCOVERY (AREA RECOMMENDATION)
// ──────────────────────────────────────────────

export interface CandidateArea {
  rank: number;
  latitude: number;
  longitude: number;
  score: number;
  level: string;
  suitability_label: string;
  confidence_level?: string;
  recommendation_badge: string;
  badge: string;
  is_recommended: boolean;
  landmark: string;
  road: string;
  locality: string;
  has_verified_street: boolean;
  street_status: string;
  full_address: string;
  competitors_500m: number;
  demand_anchors_500m: number;
  nearest_transit_dist_m: number;
  distance_from_center_m: number;
  market_archetype?: string;
  factors: Record<string, number>;
  factor_details?: {
    name: string;
    key: string;
    value: number;
    weight: number;
    weightedContribution?: number;
    description: string;
    status: string;
  }[];
  why_here: string[];
  risks: string[];
  limitations: string[];
  practical_recommendation?: string;
}

export interface RecommendAreasResponse {
  status: string;
  city: string;
  business_type: string;
  center: { latitude: number; longitude: number };
  radius_meters: number;
  suitability_advisory: string;
  has_recommended_sites: boolean;
  recommended_sites: CandidateArea[];
  data_source: string;
  timestamp?: string;
}

export async function fetchRecommendedAreas(
  businessType: string,
  lat: number,
  lon: number,
  radiusMeters = 2000,
  cityName = "Mumbai",
  signal?: AbortSignal
): Promise<RecommendAreasResponse> {
  return fetchFromApi<RecommendAreasResponse>("/recommend-sites", {
    method: "POST",
    body: JSON.stringify({
      business_type: businessType,
      latitude: lat,
      longitude: lon,
      radius_meters: radiusMeters,
      city_name: cityName,
    }),
    signal,
  });
}


