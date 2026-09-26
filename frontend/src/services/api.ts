import type {
  City,
  Category,
  OpportunityRequest,
  OpportunityResponse,
  CompetitionAnalysisResult,
  ServiceGapResult,
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
