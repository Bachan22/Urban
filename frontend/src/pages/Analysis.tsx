import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Download, ExternalLink, RefreshCw } from "lucide-react";

import GoogleMapView from "../components/Map/GoogleMapView";
import type { Place as GMapPlace } from "../components/Map/GoogleMapView";

import { BUSINESS_TYPES, puneData } from "../data/puneData";
import type { BusinessType } from "../data/puneData";

import { getBusinessData } from "../services/overpass";
import type { Place } from "../services/overpass";
import { fetchRecommendedAreas, type CandidateArea } from "../services/api";

import {
  calculateOpportunityScore,
} from "../utils/opportunityScore";
import { downloadAnalysisReport, saveAnalysisReport, addLocationToComparison, type AnalysisReport } from "../utils/analysisReport";

// Leaflet icon definitions removed — Google Maps uses inline marker icons

type AnalysisProps = {
  initialBusinessType?: BusinessType;
  cityName?: string;
  areaName?: string;
  areaNotFound?: boolean;
  initialCenter?: Location;
  studyRadiusKm?: number;
  onBack: () => void;
};

type Location = {
  latitude: number;
  longitude: number;
};

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: string;
}) {
  return (
    <div className="ui-stat-card">
      <div className="ui-stat-icon">
        {icon}
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function distanceInMeters(from: Location, to: Location) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);
  const latDistance = lat2 - lat1;
  const lonDistance = radians(to.longitude - from.longitude);
  const haversine = Math.sin(latDistance / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDistance / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

export default function Analysis({
  initialBusinessType = "Education Institute",
  cityName = "Pune",
  areaName = "",
  areaNotFound = false,
  initialCenter = puneData.center,
  studyRadiusKm = puneData.studyRadiusKm,
  onBack,
}: AnalysisProps) {
  const [businessType, setBusinessType] =
    useState<BusinessType>(
      initialBusinessType
    );

  const [selectedLocation, setSelectedLocation] =
    useState<Location>({
      latitude: initialCenter.latitude,
      longitude: initialCenter.longitude,
    });

  const [radiusKm, setRadiusKm] =
    useState<number>(studyRadiusKm && [1, 2, 5].includes(studyRadiusKm) ? studyRadiusKm : 2);

  // Secondary layers visibility (Default: Competitors and Recommended Areas visible)
  const [layers, setLayers] = useState({
    competitors: true,
    schools: false,
    colleges: false,
    hospitals: false,
    transit: false,
    recommendedAreas: true,
  });

  const [recommendedAreas, setRecommendedAreas] = useState<CandidateArea[]>([]);
  const [suitabilityAdvisory, setSuitabilityAdvisory] = useState<string>("");
  const [loadingRecommendations, setLoadingRecommendations] = useState<boolean>(false);

  const [businesses, setBusinesses] =
    useState<Place[]>([]);

  const [hospitals, setHospitals] =
    useState<Place[]>([]);

  const [schools, setSchools] =
    useState<Place[]>([]);

  const [colleges, setColleges] =
    useState<Place[]>([]);

  const [transitStops, setTransitStops] =
    useState<Place[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [hasCompletedAnalysis, setHasCompletedAnalysis] =
    useState(false);

  const [liveDataAvailable, setLiveDataAvailable] = useState(false);  const [error, setError] = useState("");
  const [offices, setOffices] = useState<Place[]>([]);
  const [dataSource, setDataSource] = useState<string>("osm");
  const [resultsCapped, setResultsCapped] = useState<boolean>(false);
  const [callsMade, setCallsMade] = useState<number>(0);
  const [featureStatuses, setFeatureStatuses] = useState<Record<string, string>>({});
  const [dataQuality, setDataQuality] = useState<any>(null);

  const navigate = useNavigate();
  const [currentAreaName, setCurrentAreaName] = useState<string>(areaName || "");
  const [comparedRanks, setComparedRanks] = useState<Record<number, boolean>>({});
  const [compareToast, setCompareToast] = useState<{
    visible: boolean;
    message: string;
    count: number;
    landmark?: string;
  } | null>(null);

  const handleAddCandidateToCompare = (cand: CandidateArea) => {
    const candReport: AnalysisReport = {
      id: `cand-${cand.rank}-${cand.latitude.toFixed(4)}-${cand.longitude.toFixed(4)}`,
      generatedAt: new Date().toISOString(),
      city: cityName,
      areaName: cand.landmark || `${cand.road ? `${cand.road}, ` : ""}${cand.locality || cityName}`,
      businessType,
      latitude: cand.latitude,
      longitude: cand.longitude,
      radiusMeters: 500,
      dataStatus: "live",
      dataSource,
      score: cand.score,
      level: cand.level,
      suitabilityLabel: cand.suitability_label,
      confidenceLevel: cand.confidence_level || "Medium",
      factors: cand.factor_details || [],
      explanations: cand.why_here || [],
      positiveDrivers: cand.why_here || [],
      negativeRisks: cand.risks || [],
      missingDataWarnings: cand.limitations || [],
      practicalRecommendation: cand.practical_recommendation || "",
      competitors: [],
    };
    const res = addLocationToComparison(candReport);
    setComparedRanks((prev) => ({ ...prev, [cand.rank]: true }));
    setCompareToast({
      visible: true,
      message: `Added Area #${cand.rank} (${cand.landmark}) to Comparison Engine.`,
      count: res.count,
      landmark: cand.landmark,
    });
  };

  useEffect(() => {
    const onCompareEvent = (e: any) => {
      const rank = e.detail?.rank;
      const cand = recommendedAreas.find((c) => c.rank === rank);
      if (cand) {
        handleAddCandidateToCompare(cand);
      }
    };
    window.addEventListener("urbaniq:compare-candidate-event", onCompareEvent);
    return () => window.removeEventListener("urbaniq:compare-candidate-event", onCompareEvent);
  }, [recommendedAreas, businessType, cityName, dataSource]);

  // In-flight request cancellation & race condition guard
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<number>(0);

  async function analyzeLocation(
    latitude: number,
    longitude: number,
    targetRadiusKm = radiusKm,
    newAreaName?: string
  ) {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentRequestId = ++activeRequestIdRef.current;

    const effectiveAreaName = newAreaName !== undefined ? newAreaName : (currentAreaName || areaName);
    if (newAreaName) {
      setCurrentAreaName(newAreaName);
    }

    // Immediately clear stale state and set loading to prevent displaying mismatched results
    setSelectedLocation({ latitude, longitude });
    setBusinesses([]);
    setHospitals([]);
    setSchools([]);
    setColleges([]);
    setOffices([]);
    setTransitStops([]);
    setRecommendedAreas([]);
    setSuitabilityAdvisory("");
    setComparedRanks({});
    setLoading(true);
    setLoadingRecommendations(true);
    setHasCompletedAnalysis(false);
    setError("");

    // Synchronize URL query params with current coordinates, category, and radius
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set("business", businessType);
    urlParams.set("city", cityName.toLowerCase());
    urlParams.set("lat", latitude.toFixed(5));
    urlParams.set("lon", longitude.toFixed(5));
    urlParams.set("radius", targetRadiusKm.toString());
    if (effectiveAreaName) urlParams.set("location", effectiveAreaName);
    window.history.replaceState(null, "", `${window.location.pathname}?${urlParams.toString()}`);

    try {
      const [poiRes, recRes] = await Promise.allSettled([
        getBusinessData(
          businessType,
          latitude,
          longitude,
          targetRadiusKm * 1000,
          true,
          controller.signal
        ),
        fetchRecommendedAreas(
          businessType,
          latitude,
          longitude,
          targetRadiusKm * 1000,
          cityName,
          controller.signal
        ),
      ]);

      // Ignore late responses from prior in-flight searches
      if (currentRequestId !== activeRequestIdRef.current) return;

      if (poiRes.status === "fulfilled") {
        const data = poiRes.value;
        setLiveDataAvailable(true);
        setDataSource(data.data_source || "osm");
        setResultsCapped(Boolean(data.results_capped));
        setCallsMade(data.calls_made || 0);

        // Client-side strict radius filter and deduplication guard
        const filterByRadius = (places: Place[] = []) => {
          const maxMeters = targetRadiusKm * 1000;
          const seen = new Set<string>();
          const valid: Place[] = [];
          for (const p of places) {
            if (p.lat === undefined || p.lon === undefined) continue;
            const dist = distanceInMeters({ latitude, longitude }, { latitude: p.lat, longitude: p.lon });
            if (dist <= maxMeters) {
              const key = `${p.name.trim().toLowerCase()}_${p.lat.toFixed(4)}_${p.lon.toFixed(4)}`;
              if (!seen.has(key)) {
                seen.add(key);
                valid.push({ ...p, distance_meters: Math.round(dist) });
              }
            }
          }
          return valid.sort((a, b) => (a.distance_meters || 0) - (b.distance_meters || 0));
        };

        setBusinesses(filterByRadius(data.businesses));
        setHospitals(filterByRadius(data.hospitals));
        setSchools(filterByRadius(data.schools));
        setColleges(filterByRadius(data.colleges));
        setOffices(filterByRadius(data.offices));
        setTransitStops(filterByRadius([
          ...(data.bus_stops || []),
          ...(data.railway_stations || []),
        ]));
        setFeatureStatuses(data.feature_statuses || {});
        setDataQuality(data.data_quality || null);
      } else {
        if (poiRes.reason?.name !== "AbortError") {
          console.error("POI analysis fetch failed:", poiRes.reason);
          setLiveDataAvailable(false);
          setFeatureStatuses({
            competitors: "unavailable",
            transit: "unavailable",
            civic: "unavailable",
            demand: "unavailable",
          });
          setDataQuality({ overall_status: "degraded", warnings: ["Data source query failed or timed out."] });
          setError("Failed to fetch POI data for this radius. Please retry.");
        }
      }

      if (recRes.status === "fulfilled") {
        setRecommendedAreas(recRes.value.recommended_sites || []);
        setSuitabilityAdvisory(recRes.value.suitability_advisory || "");
      } else {
        if (recRes.reason?.name !== "AbortError") {
          console.warn("Candidate area recommendations fetch failed:", recRes.reason);
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      if (currentRequestId !== activeRequestIdRef.current) return;
      console.error("Analysis fetch failed:", err);
      setLiveDataAvailable(false);
      setFeatureStatuses({
        competitors: "unavailable",
        transit: "unavailable",
        civic: "unavailable",
        demand: "unavailable",
      });
      setError("Failed to fetch data for this location. Please retry.");
    } finally {
      if (currentRequestId === activeRequestIdRef.current) {
        setLoading(false);
        setLoadingRecommendations(false);
        setHasCompletedAnalysis(true);
      }
    }
  }

  useEffect(() => {
    analyzeLocation(
      selectedLocation.latitude,
      selectedLocation.longitude,
      radiusKm
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessType, radiusKm]);

  const competitorPlaces = businesses;

  // Real data-driven scoring calculation using 6-factor MCDA + Mamdani fuzzy inference
  const result = calculateOpportunityScore(businessType, {
    businessType,
    radiusKm,
    competitorsCount: competitorPlaces.length,
    hospitalsCount: hospitals.length,
    schoolsCount: schools.length,
    collegesCount: colleges.length,
    officesCount: offices.length,
    transitStopsCount: transitStops.length,
    dataSource,
    cityName,
    dataStatuses: featureStatuses,
  });

  const report: AnalysisReport = {
    generatedAt: new Date().toISOString(),
    city: cityName,
    areaName,
    businessType,
    latitude: selectedLocation.latitude,
    longitude: selectedLocation.longitude,
    radiusMeters: radiusKm * 1000,
    dataStatus: liveDataAvailable ? "live" : "unavailable",
    dataSource,
    score: result.score,
    level: result.level,
    suitabilityLabel: result.suitabilityLabel,
    confidenceLevel: result.confidenceLevel,
    isProvisional: result.isProvisional,
    fuzzySuitabilityScore: result.fuzzySuitabilityScore,
    factors: result.factors,
    explanations: result.explanation,
    positiveDrivers: result.positiveDrivers,
    negativeRisks: result.negativeRisks,
    missingDataWarnings: result.missingDataWarnings,
    practicalRecommendation: result.practicalRecommendation,
    competitors: competitorPlaces.map((place) => ({
      name: place.name,
      category: place.category || businessType,
      latitude: place.lat,
      longitude: place.lon,
    })),
    recommendedAreas: recommendedAreas.map((a) => ({
      rank: a.rank,
      landmark: a.landmark,
      road: a.road,
      locality: a.locality,
      has_verified_street: a.has_verified_street,
      score: a.score,
      badge: a.badge,
      competitors_500m: a.competitors_500m,
      latitude: a.latitude,
      longitude: a.longitude,
    })),
  };

  useEffect(() => {
    if (!hasCompletedAnalysis) return;
    saveAnalysisReport(report);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businesses, businessType, cityName, hasCompletedAnalysis, selectedLocation, result.score, liveDataAvailable, areaName, recommendedAreas]);

  const handleDownloadReport = () => downloadAnalysisReport(report);

  return (
    <div className="urban-analysis">

      {/* =====================================
          TOP NAVIGATION
      ===================================== */}

      <header className="urban-topbar">

        <div className="urban-brand">

          <button
            className="urban-back"
            onClick={onBack}
          >
            ←
          </button>

          <div>
            <div className="urban-logo">
              Urban<span>IQ</span>
            </div>

            <div className="urban-subtitle">
              Location Intelligence
            </div>
          </div>

        </div>


        <div className="urban-top-center">

          <div className="urban-location-status">
            <span></span>
            LIVE ANALYSIS
          </div>

          <div className="urban-location-name">
            {cityName}, Maharashtra
          </div>

        </div>


        <div className="urban-top-actions">

          <button className="urban-icon-button">
            ?
          </button>

          <button className="urban-profile">
            B
          </button>

        </div>

      </header>


      {/* =====================================
          MAIN LAYOUT
      ===================================== */}

      <main className="urban-layout">


        {/* =====================================
            LEFT SIDEBAR
        ===================================== */}

        <aside className="urban-sidebar">

          <div className="sidebar-heading">

            <span>
              LOCATION ANALYSIS
            </span>

            <h1>
              Find your
              <br />
              opportunity.
            </h1>

            <p>
              Select a business and
              explore its potential
              across {cityName}.
            </p>

          </div>


          {/* BUSINESS SELECTOR */}

          <div className="urban-form">

            <label>
              BUSINESS TYPE
            </label>

            <select
              value={businessType}
              onChange={(event) =>
                setBusinessType(
                  event.target
                    .value as BusinessType
                )
              }
            >
              {BUSINESS_TYPES.map(
                (business) => (
                  <option
                    key={business}
                    value={business}
                  >
                    {business}
                  </option>
                )
              )}
            </select>

          </div>


          {/* RADIUS SELECTOR */}

          <div className="urban-dropdown-group">

            <label>
              ANALYSIS RADIUS
            </label>

            <select
              value={radiusKm}
              onChange={(event) => setRadiusKm(Number(event.target.value))}
            >
              <option value={1}>1 km Radius</option>
              <option value={2}>2 km Radius (Default)</option>
              <option value={5}>5 km Radius</option>
            </select>

          </div>


          {/* LOCATION */}

          <div className="urban-location-card">

            <div className="urban-location-pin">
              ⌖
            </div>

            <div>

              <span>
                STUDY AREA
              </span>

              <strong>
                {cityName}{areaName ? ` · ${areaName}` : ""}
              </strong>

              <small>
                {radiusKm} km analysis radius
              </small>

            </div>

          </div>


          {/* SCORE */}

          <div className="urban-score-card">

            <div className="score-header">

              <span>
                OPPORTUNITY SCORE
              </span>

              <span className="score-live">
                LIVE
              </span>

            </div>

            <div className="score-main">
              <strong>
                {loading ? "..." : (error ? "—" : result.score)}
              </strong>
              <span>
                {loading || error ? "" : "/100"}
              </span>
            </div>

            <div className="score-level">
              <span></span>
              {loading ? "Analyzing zone..." : (error ? "Data unavailable" : `${result.level} opportunity`)}
            </div>

          </div>


          {/* QUICK STATS */}

          <div className="urban-sidebar-section">

            <div className="urban-section-title">
              LOCAL INTELLIGENCE
            </div>

            <div className="urban-mini-stats">

              <StatCard
                label="Businesses"
                value={competitorPlaces.length}
                icon="⌂"
              />

              <StatCard
                label="Schools"
                value={schools.length}
                icon="▣"
              />

              <StatCard
                label="Colleges"
                value={colleges.length}
                icon="◆"
              />

              <StatCard
                label="Hospitals"
                value={hospitals.length}
                icon="+"
              />

            </div>

          </div>


          {/* INSTRUCTION */}

          <div className="urban-sidebar-tip">

            <div>
              <span>●</span>
              MAP INTERACTION
            </div>

            <p>
              Click anywhere on the map
              to analyze that location.
            </p>

          </div>

        </aside>


        {/* =====================================
            MAP AREA
        ===================================== */}

        <section className="urban-map-area">

          <GoogleMapView
            initialCenter={initialCenter}
            selectedLocation={selectedLocation}
            radiusKm={radiusKm}
            businesses={businesses as GMapPlace[]}
            hospitals={hospitals as GMapPlace[]}
            schools={schools as GMapPlace[]}
            colleges={colleges as GMapPlace[]}
            transitStops={[
              ...(transitStops as GMapPlace[]),
            ]}
            layers={layers}
            businessType={businessType}
            score={result.score}
            scoreLevel={result.level}
            recommendedAreas={recommendedAreas}
            onLocationSelect={(lat, lng, landmark) => analyzeLocation(lat, lng, radiusKm, landmark)}
          />


          {/* =====================================
              MAP OVERLAY - SEARCH
          ===================================== */}

          <div className="urban-map-search">

            <div className="urban-search-icon">
              ⌕
            </div>

            <div>
              <span>
                SELECTED AREA
              </span>

              <strong>
                {selectedLocation.latitude.toFixed(
                  4
                )}
                {" , "}
                {selectedLocation.longitude.toFixed(
                  4
                )}
              </strong>
            </div>

          </div>


          {/* =====================================
              MAP OVERLAY - SCORE
          ===================================== */}

          <div className="urban-floating-score">
            <div className="floating-score-top">
              <span>{businessType}</span>
              <div className="floating-status">
                {loading ? "◌ ANALYZING" : (error ? "⚠ UNAVAILABLE" : "● ANALYZED")}
              </div>
            </div>

            <div className="floating-score-number">
              {loading ? "..." : (error ? "—" : result.score)}
              <small>{loading || error ? "" : "/100"}</small>
            </div>

            <div className="floating-score-label">
              {loading ? "Collecting data..." : (error ? "Data unavailable" : `${result.level} Opportunity`)}
            </div>

            <div className="floating-score-line">
              <div
                style={{
                  width: `${loading || error ? 0 : result.score}%`,
                }}
              ></div>
            </div>
          </div>


          {/* =====================================
              MAP CONTROLS
          ===================================== */}

          <div className="urban-map-controls">

            <button>
              +
            </button>

            <button>
              −
            </button>

          </div>


          {/* =====================================
              MAP LEGEND & LAYER TOGGLES
          ===================================== */}

          <div className="urban-map-legend" style={{ minWidth: "190px" }}>

            <div className="legend-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>MAP LAYERS</span>
              <span style={{ fontSize: "10px", color: "#64748b", fontWeight: "normal" }}>{radiusKm} km radius</span>
            </div>

            <div>
              <span className="legend-selected"></span>
              Selected pin
            </div>

            <div>
              <span className="legend-study"></span>
              {radiusKm} km analysis circle
            </div>

            <div style={{ height: "1px", background: "rgba(0,0,0,0.06)", margin: "4px 0" }}></div>

            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "11px" }}>
              <input
                type="checkbox"
                checked={layers.competitors}
                onChange={(e) => setLayers(prev => ({ ...prev, competitors: e.target.checked }))}
              />
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#e11d48", display: "inline-block" }}></span>
              Competitors ({businesses.length})
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "11px" }}>
              <input
                type="checkbox"
                checked={layers.schools}
                onChange={(e) => setLayers(prev => ({ ...prev, schools: e.target.checked }))}
              />
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#16a34a", display: "inline-block" }}></span>
              Schools ({schools.length})
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "11px" }}>
              <input
                type="checkbox"
                checked={layers.colleges}
                onChange={(e) => setLayers(prev => ({ ...prev, colleges: e.target.checked }))}
              />
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#9333ea", display: "inline-block" }}></span>
              Colleges ({colleges.length})
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "11px" }}>
              <input
                type="checkbox"
                checked={layers.hospitals}
                onChange={(e) => setLayers(prev => ({ ...prev, hospitals: e.target.checked }))}
              />
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#0284c7", display: "inline-block" }}></span>
              Hospitals ({hospitals.length})
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "11px" }}>
              <input
                type="checkbox"
                checked={layers.transit}
                onChange={(e) => setLayers(prev => ({ ...prev, transit: e.target.checked }))}
              />
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#ea580c", display: "inline-block" }}></span>
              Transit ({transitStops.length})
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "11px" }}>
              <input
                type="checkbox"
                checked={layers.recommendedAreas}
                onChange={(e) => setLayers(prev => ({ ...prev, recommendedAreas: e.target.checked }))}
              />
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#2563eb", display: "inline-block" }}></span>
              Recommended Areas ({recommendedAreas.length})
            </label>

            <div style={{ height: "1px", background: "rgba(0,0,0,0.06)", margin: "4px 0" }}></div>

            {/* DATA SOURCE BADGE */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" }}>
              <span style={{ fontSize: "10px", color: "#64748b" }}>Source:</span>
              <span
                style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontWeight: 600,
                  background: dataSource === "google_places" ? "#e0f2fe" : "#f1f5f9",
                  color: dataSource === "google_places" ? "#0284c7" : "#475569",
                  border: `1px solid ${dataSource === "google_places" ? "#bae6fd" : "#cbd5e1"}`,
                }}
              >
                {dataSource === "google_places" ? "Google Places" : "OpenStreetMap"}
              </span>
            </div>

            {resultsCapped && (
              <div style={{ fontSize: "10px", color: "#b45309", background: "#fef3c7", padding: "3px 6px", borderRadius: "4px", marginTop: "4px" }}>
                Notice: Dense area reached call limit ({callsMade} calls)
              </div>
            )}

            {dataSource === "google_places" && (
              <div style={{ fontSize: "9px", color: "#94a3b8", marginTop: "3px", textAlign: "right" }}>
                Places data &copy; Google
              </div>
            )}

          </div>


          {/* ERROR DISPLAY WITH RETRY */}

          {error && !loading && (
            <div
              style={{
                position: "absolute",
                top: "16px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                zIndex: 1000,
              }}
            >
              <span>{error}</span>
              <button
                onClick={() => analyzeLocation(selectedLocation.latitude, selectedLocation.longitude, radiusKm)}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                  padding: "3px 8px",
                  cursor: "pointer",
                  fontSize: "11px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <RefreshCw size={12} />
                Retry
              </button>
            </div>
          )}


          {/* LOADING */}

          {loading && (
            <div className="urban-map-loading">

              <div className="urban-spinner"></div>

              <div>
                <strong>
                  Analyzing location
                </strong>

                <span>
                  Collecting urban data ({radiusKm} km radius)...
                </span>
              </div>

            </div>
          )}

        </section>


        {/* =====================================
            RIGHT INTELLIGENCE PANEL
        ===================================== */}

        <aside className="urban-intelligence">

          <div className="intelligence-header">

            <div>

              <span>
                URBANIQ INTELLIGENCE
              </span>

              <h2>
                Location Report
              </h2>

            </div>

            <button onClick={handleDownloadReport} disabled={!hasCompletedAnalysis || loading} aria-label="Download analysis report" title="Download report">
              <Download size={17} />
            </button>

          </div>


          {error && (
            <div className="urban-warning">
              <strong>
                Prototype data
              </strong>

              <p>
                {error}
              </p>
            </div>
          )}

          {areaNotFound && !error && (
            <div className="urban-warning">
              <strong>Area not found</strong>
              <p>Showing the {cityName} city center. Click your intended point on the map to run a precise local analysis.</p>
            </div>
          )}


          {/* DATA CONFIDENCE & SOFT COMPUTING BADGES */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "14px 0 8px 0" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: "6px",
                background: result.confidenceLevel === "High" ? "#dcfce7" : (result.confidenceLevel === "Medium" ? "#fef3c7" : "#fee2e2"),
                color: result.confidenceLevel === "High" ? "#15803d" : (result.confidenceLevel === "Medium" ? "#b45309" : "#b91c1c"),
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              ● Confidence: {result.confidenceLevel}{result.isProvisional ? " (Provisional)" : ""}
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: "6px",
                background: dataQuality?.overall_status === "complete" ? "#f0fdf4" : (dataQuality?.overall_status === "degraded" ? "#fef2f2" : "#f8fafc"),
                color: dataQuality?.overall_status === "complete" ? "#166534" : (dataQuality?.overall_status === "degraded" ? "#991b1b" : "#475569"),
                border: "1px solid #e2e8f0",
              }}
            >
              Data: {dataQuality?.overall_status ? dataQuality.overall_status.toUpperCase() : "STANDARD"}
            </span>
            <a
              href="/compare"
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: "6px",
                background: "#f1f5f9",
                color: "#2563eb",
                textDecoration: "none",
                border: "1px solid #cbd5e1",
                marginLeft: "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              ⇄ Compare Locations
            </a>
          </div>

          {result.missingDataWarnings && result.missingDataWarnings.length > 0 && (
            <div style={{ fontSize: "11px", color: "#b45309", background: "#fffbeb", border: "1px solid #fef3c7", padding: "8px 12px", borderRadius: "8px", margin: "8px 0 14px 0" }}>
              <strong>Data Notice: </strong>
              {result.missingDataWarnings.join(" ")}
            </div>
          )}

          {/* =====================================
              AREA DISCOVERY & SITE RECOMMENDATIONS
          ===================================== */}
          <div className="intelligence-section" style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
            <div className="intelligence-section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ color: "#0f172a", fontWeight: 700 }}>AREA DISCOVERY ENGINE</span>
              <small style={{ color: "#2563eb", fontWeight: 700 }}>STUDY RADIUS: {radiusKm} KM</small>
            </div>

            {loadingRecommendations ? (
              <div style={{ fontSize: "12px", color: "#64748b", padding: "14px 0", textAlign: "center" }}>
                <span className="urban-spinner" style={{ width: "16px", height: "16px", display: "inline-block", verticalAlign: "middle", marginRight: "8px" }}></span>
                Discovering and ranking candidate zones across study area...
              </div>
            ) : recommendedAreas.length === 0 ? (
              <div style={{ fontSize: "12px", color: "#64748b", padding: "8px 0" }}>
                No candidate areas currently detected within this boundary.
              </div>
            ) : (
              <div>
                {/* Overall Advisory Alert */}
                {suitabilityAdvisory && (
                  <div
                    style={{
                      fontSize: "11px",
                      lineHeight: 1.45,
                      padding: "8px 10px",
                      borderRadius: "6px",
                      marginBottom: "12px",
                      background: recommendedAreas[0]?.score >= 70 ? "#ecfdf5" : (recommendedAreas[0]?.score >= 50 ? "#fffbeb" : "#fef2f2"),
                      border: `1px solid ${recommendedAreas[0]?.score >= 70 ? "#a7f3d0" : (recommendedAreas[0]?.score >= 50 ? "#fef3c7" : "#fecaca")}`,
                      color: recommendedAreas[0]?.score >= 70 ? "#065f46" : (recommendedAreas[0]?.score >= 50 ? "#92400e" : "#991b1b"),
                    }}
                  >
                    <strong>Status: </strong>{suitabilityAdvisory}
                  </div>
                )}

                {/* Candidate Area Cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {recommendedAreas.slice(0, 5).map((cand) => {
                    const isTop = cand.rank === 1;
                    const badgeBg = cand.score >= 70 ? "#16a34a" : (cand.score >= 50 ? "#d97706" : "#64748b");
                    const scoreColor = cand.score >= 70 ? "#15803d" : (cand.score >= 50 ? "#d97706" : "#dc2626");

                    return (
                      <div
                        key={cand.rank}
                        style={{
                          background: isTop ? "#ffffff" : "#fbfcfe",
                          borderRadius: "8px",
                          border: isTop ? "2px solid #3b82f6" : "1px solid #cbd5e1",
                          padding: "10px 12px",
                          boxShadow: isTop ? "0 2px 8px rgba(59, 130, 246, 0.1)" : "none",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: badgeBg,
                              color: "white",
                            }}
                          >
                            #{cand.rank} {cand.badge}
                          </span>

                          <span style={{ fontSize: "15px", fontWeight: 800, color: scoreColor }}>
                            {cand.score}<small style={{ fontSize: "10px", color: "#64748b" }}>/100</small>
                          </span>
                        </div>

                        <div style={{ fontWeight: 700, fontSize: "12px", color: "#0f172a", marginBottom: "3px" }}>
                          {cand.landmark}
                        </div>

                        <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px", flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              padding: "1px 5px",
                              borderRadius: "4px",
                              background: cand.has_verified_street ? "#dcfce7" : "#fef3c7",
                              color: cand.has_verified_street ? "#166534" : "#92400e",
                              border: `1px solid ${cand.has_verified_street ? "#bbf7d0" : "#fde68a"}`,
                            }}
                          >
                            {cand.has_verified_street ? "Verified Street" : "Approximate Zone (Street unverified)"}
                          </span>
                          <span style={{ fontSize: "10px", color: "#64748b" }}>
                            {cand.competitors_500m} competitors · {cand.nearest_transit_dist_m}m to transit
                          </span>
                        </div>

                        <div style={{ fontSize: "11px", color: "#475569", lineHeight: 1.4, marginBottom: "8px" }}>
                          <div style={{ color: "#15803d" }}>✓ {cand.why_here[0]}</div>
                          <div style={{ color: "#b91c1c" }}>⚠ {cand.risks[0]}</div>
                          {cand.limitations?.[0] && (
                            <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px", fontStyle: "italic" }}>
                              Notice: {cand.limitations[0]}
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            id={`btn-set-center-${cand.rank}`}
                            onClick={() => {
                              setCompareToast({
                                visible: true,
                                message: `Centered on Area #${cand.rank} (${cand.landmark}). Running fresh analysis...`,
                                count: 0,
                                landmark: cand.landmark,
                              });
                              analyzeLocation(cand.latitude, cand.longitude, radiusKm, cand.landmark);
                            }}
                            style={{
                              flex: 1,
                              padding: "6px 8px",
                              borderRadius: "6px",
                              border: "1px solid #93c5fd",
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              textAlign: "center",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "4px",
                            }}
                            title="Re-run entire analysis centered on this candidate's coordinates"
                          >
                            Set As Centre ➔
                          </button>
                          <button
                            id={`btn-compare-${cand.rank}`}
                            onClick={() => {
                              if (comparedRanks[cand.rank]) {
                                navigate("/compare");
                              } else {
                                handleAddCandidateToCompare(cand);
                              }
                            }}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "6px",
                              border: `1px solid ${comparedRanks[cand.rank] ? "#86efac" : "#cbd5e1"}`,
                              background: comparedRanks[cand.rank] ? "#f0fdf4" : "#ffffff",
                              color: comparedRanks[cand.rank] ? "#166534" : "#334155",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              whiteSpace: "nowrap",
                            }}
                            title={comparedRanks[cand.rank] ? "Saved! Click to view in Multi-Site Comparison" : "Add candidate area to comparison engine"}
                          >
                            {comparedRanks[cand.rank] ? "✓ In Compare (View ➔)" : "⇄ Compare"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* FACTORS */}
          <div className="intelligence-section">
            <div className="intelligence-section-heading">
              <span>MULTI-CRITERIA FACTORS</span>
              <small>WEIGHTED MCDA</small>
            </div>

            <div className="urban-factors">
              {result.factors.map((factor) => {
                const barColor = factor.status === "strong" ? "#10b981" : (factor.status === "moderate" ? "#3b82f6" : "#f59e0b");
                return (
                  <div className="urban-factor" key={factor.name} style={{ marginBottom: "12px" }}>
                    <div className="factor-info" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div>
                        <span>{factor.name}</span>
                        {factor.dataState === "unavailable" && (
                          <span style={{ fontSize: "9px", background: "#fef3c7", color: "#b45309", padding: "1px 5px", borderRadius: "4px", marginLeft: "6px", fontWeight: 600 }}>
                            Estimated Prior
                          </span>
                        )}
                        {factor.dataState === "confirmed_zero" && (
                          <span style={{ fontSize: "9px", background: "#f1f5f9", color: "#64748b", padding: "1px 5px", borderRadius: "4px", marginLeft: "6px", fontWeight: 600 }}>
                            Confirmed 0
                          </span>
                        )}
                      </div>
                      <div>
                        <strong style={{ fontSize: "13px" }}>{factor.value}</strong>
                        <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "4px" }}>
                          (+{factor.weightedContribution} pts)
                        </span>
                      </div>
                    </div>

                    <div className="urban-factor-bar" style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden", margin: "4px 0" }}>
                      <div
                        style={{
                          width: `${Math.min(100, factor.value)}%`,
                          background: barColor,
                          height: "100%",
                          borderRadius: "3px",
                        }}
                      ></div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#64748b" }}>
                      <span>Weight {factor.weight}%</span>
                      <span style={{ fontStyle: "italic", maxWidth: "200px", textAlign: "right" }}>{factor.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* WHY SCORE - POSITIVE DRIVERS & RISKS */}
          <div className="intelligence-section">
            <div className="intelligence-section-heading">
              <span>LOCATION ANALYSIS</span>
              <small>WHY THIS SCORE</small>
            </div>

            {/* Positive Drivers */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#15803d", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Key Positive Drivers
              </div>
              <div className="urban-reasons">
                {result.positiveDrivers.map((reason) => (
                  <div className="urban-reason" key={reason}>
                    <div className="reason-check" style={{ color: "#15803d", fontWeight: "bold" }}>✓</div>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Negative Risks */}
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Key Risks & Trade-Offs
              </div>
              <div className="urban-reasons">
                {result.negativeRisks.map((risk) => (
                  <div className="urban-reason" key={risk}>
                    <div className="reason-check" style={{ color: "#dc2626", fontWeight: "bold" }}>⚠</div>
                    <span style={{ color: "#475569" }}>{risk}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PRACTICAL RECOMMENDATION */}
          <div className="intelligence-section">
            <div className="intelligence-section-heading">
              <span>PRACTICAL RECOMMENDATION</span>
              <small>{result.suitabilityLabel.toUpperCase()}</small>
            </div>

            <div
              style={{
                background: result.score >= 70 ? "#f0fdf4" : (result.score >= 50 ? "#fefce8" : "#fff1f2"),
                border: `1px solid ${result.score >= 70 ? "#bbf7d0" : (result.score >= 50 ? "#fef08a" : "#fecdd3")}`,
                borderRadius: "8px",
                padding: "12px",
                fontSize: "12px",
                lineHeight: 1.55,
                color: result.score >= 70 ? "#166534" : (result.score >= 50 ? "#854d0e" : "#9f1239"),
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                {result.suitabilityLabel} Suitability Signal ({result.score}/100)
              </div>
              <p style={{ margin: 0 }}>
                {result.practicalRecommendation}
              </p>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "8px", borderTop: "1px dashed rgba(0,0,0,0.1)", paddingTop: "6px" }}>
                <strong>Radius Sensitivity: </strong>
                Evaluated within a {radiusKm} km radius ({Math.round(Math.PI * radiusKm * radiusKm * 10) / 10} km² area).
                A 1 km radius narrows to walk-in footfall; a 5 km radius encompasses vehicular catchment.
              </div>
            </div>
          </div>

          {/* LOCATION DATA */}
          <div className="intelligence-section">
            <div className="intelligence-section-heading">
              <span>LOCATION DATA</span>
              <small>{radiusKm} KM RADIUS</small>
            </div>

            <div className="urban-data-table">
              <div>
                <span>Nearby competitors</span>
                <strong>{competitorPlaces.length}</strong>
              </div>
              <div>
                <span>Offices / Workplaces</span>
                <strong>{offices.length}</strong>
              </div>
              <div>
                <span>Schools</span>
                <strong>{schools.length}</strong>
              </div>
              <div>
                <span>Colleges</span>
                <strong>{colleges.length}</strong>
              </div>
              <div>
                <span>Hospitals</span>
                <strong>{hospitals.length}</strong>
              </div>
              <div>
                <span>Transit stops</span>
                <strong>{transitStops.length}</strong>
              </div>
            </div>
          </div>


          {/* NEARBY COMPETITORS */}

          <div className="intelligence-section">
            <div className="intelligence-section-heading">
              <span>NEARBY COMPETITORS</span>
              <small>{competitorPlaces.length} WITHIN {radiusKm} KM</small>
            </div>
            {competitorPlaces.length > 0 ? (
              <div className="urban-competitor-list">
                {competitorPlaces.slice(0, 8).map((place) => (
                  <a
                    className="urban-competitor-row"
                    href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=17/${place.lat}/${place.lon}`}
                    target="_blank"
                    rel="noreferrer"
                    key={`competitor-${place.id}`}
                  >
                    <span className="competitor-marker"><ExternalLink size={13} /></span>
                    <span className="competitor-name"><strong>{place.name}</strong><small>{place.category || businessType}</small></span>
                    <span className="competitor-distance">{(distanceInMeters(selectedLocation, { latitude: place.lat, longitude: place.lon }) / 1000).toFixed(1)} km</span>
                  </a>
                ))}
                {competitorPlaces.length > 8 && <p className="urban-competitor-more">+ {competitorPlaces.length - 8} more shown on the map</p>}
              </div>
            ) : (
              <p className="urban-competitor-empty">No matching places found in this search area. Try another point on the map.</p>
            )}
          </div>


          {/* RECOMMENDATION STYLE SUMMARY */}

          <div className="urban-summary">

            <div className="summary-icon">
              ✦
            </div>

            <div>

              <strong>
                Opportunity signal
              </strong>

              <p>
                The selected location currently shows a{" "}
                <b>{result.level.toLowerCase()}</b> opportunity signal (
                <b>{result.suitabilityLabel}</b> suitability, {result.score}/100) for{" "}
                {businessType.toLowerCase()}.
              </p>

            </div>

          </div>


          {/* DATA DISCLAIMER */}

          <div className="urban-data-note">

            <span>
              DATA NOTE
            </span>

            <p>
              Live POI information is
              collected from OpenStreetMap.
              Population and accessibility
              indicators are prototype
              inputs and will be replaced
              with validated datasets in
              the production model.
            </p>

          </div>

        </aside>

      </main>

      {/* =====================================
          FLOATING COMPARISON NOTIFICATION
      ===================================== */}
      {compareToast && compareToast.visible && (
        <div
          id="compare-toast-banner"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            background: "#0f172a",
            color: "white",
            padding: "12px 18px",
            borderRadius: "10px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            maxWidth: "460px",
            border: "1px solid #334155",
          }}
        >
          <div style={{ flex: 1, fontSize: "13px", lineHeight: 1.4 }}>
            <div style={{ fontWeight: 600 }}>{compareToast.message}</div>
            {compareToast.count > 0 && (
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                {compareToast.count} location{compareToast.count > 1 ? "s" : ""} saved in Multi-Site Comparison.
              </div>
            )}
          </div>
          {compareToast.count > 0 && (
            <button
              id="toast-view-compare-btn"
              onClick={() => navigate("/compare")}
              style={{
                background: "#2563eb",
                color: "white",
                border: "none",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              View Comparison ➔
            </button>
          )}
          <button
            onClick={() => setCompareToast(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: "16px",
              cursor: "pointer",
              padding: "0 4px",
            }}
            title="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

    </div>
  );
}
