/**
 * UrbanIQ Frontend POI Service
 * Routes all OSM/Overpass queries through the backend proxy (/api/pois).
 * Benefits:
 * - Server-side multi-mirror failover (no browser CORS / block issues)
 * - In-memory and disk caching
 * - Rich categories (competitors, schools, colleges, hospitals, transit, offices)
 * - No mock or silent fake fallbacks
 */

import { fetchPois } from "./api";
import type { POIPlace, POIResponse } from "../types/api";

export type Place = POIPlace;

export interface BusinessDataResult {
  businesses: Place[];
  hospitals: Place[];
  schools: Place[];
  colleges: Place[];
  offices: Place[];
  bus_stops: Place[];
  railway_stations: Place[];
  timestamp: string;
  mirror: string;
  from_cache: boolean;
  poi_counts: Record<string, number>;
  data_source?: string;
  results_capped?: boolean;
  calls_made?: number;
  feature_statuses?: Record<string, string>;
  data_quality?: {
    overall_status: string;
    category_statuses: Record<string, string>;
    feature_statuses: Record<string, string>;
    warnings: string[];
  };
}

export async function getBusinessData(
  businessType: string,
  latitude: number,
  longitude: number,
  radius = 2000,
  debug = true,
  signal?: AbortSignal
): Promise<BusinessDataResult> {
  const data: POIResponse = await fetchPois(businessType, latitude, longitude, radius, debug, signal);

  return {
    businesses: data.businesses || [],
    hospitals: data.hospitals || [],
    schools: data.schools || [],
    colleges: data.colleges || [],
    offices: data.offices || [],
    bus_stops: data.bus_stops || [],
    railway_stations: data.railway_stations || [],
    timestamp: data.timestamp || new Date().toISOString(),
    mirror: data.mirror || "cached",
    from_cache: Boolean(data.from_cache),
    poi_counts: data.poi_counts || {},
    data_source: data.data_source || "osm",
    results_capped: Boolean(data.results_capped),
    calls_made: data.calls_made || 0,
    feature_statuses: data.feature_statuses,
    data_quality: data.data_quality,
  };
}