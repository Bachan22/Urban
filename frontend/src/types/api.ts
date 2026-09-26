export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface City {
  id: string;
  name: string;
  state: string;
  center: Coordinates;
  study_radius_km: number;
  observed_population?: number;
  data_source: string;
  data_confidence: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  target_amenities: string[];
  is_active: boolean;
}

export interface FactorScore {
  name: string;
  value: number;
  weight: number;
  description: string;
}

export interface CompetitorSummary {
  id?: number;
  name: string;
  amenity: string;
  latitude: number;
  longitude: number;
  distance_meters: number;
}

export interface CompetitionAnalysisResult {
  category_id: string;
  center_latitude: number;
  center_longitude: number;
  radius_meters: number;
  competitor_count: number;
  nearest_competitor_distance_meters?: number;
  competitor_density_per_sq_km: number;
  competition_opportunity_score: number;
  competitors: CompetitorSummary[];
  data_source: string;
}

export interface ServiceGapResult {
  category_id: string;
  center_latitude: number;
  center_longitude: number;
  radius_meters: number;
  facility_count: number;
  catchment_population_proxy: number;
  population_per_facility: number;
  has_zero_facilities: boolean;
  nearest_facility_distance_meters?: number;
  service_gap_score: number;
  gap_severity: string;
  data_label: string;
}

export interface OpportunityResponse {
  city_id: string;
  category_id: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  opportunity_score: number;
  opportunity_level: "High" | "Medium" | "Low";
  factors: FactorScore[];
  reasons: string[];
  risks: string[];
  competition: CompetitionAnalysisResult;
  service_gap: ServiceGapResult;
  data_mode: string;
  disclaimer: string;
}

export interface OpportunityRequest {
  city_id: string;
  category_id: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
  population_proxy?: number;
  accessibility_proxy?: number;
}
