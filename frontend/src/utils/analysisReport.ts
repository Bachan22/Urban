export interface AnalysisReport {
  id?: string;
  generatedAt: string;
  city: string;
  areaName: string;
  businessType: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  dataStatus: "live" | "unavailable";
  dataSource?: string;
  score: number;
  level: string;
  suitabilityLabel?: string;
  confidenceLevel?: string;
  isProvisional?: boolean;
  fuzzySuitabilityScore?: number;
  factors: {
    name: string;
    key?: string;
    value: number;
    weight: number;
    weightedContribution?: number;
    description?: string;
    status?: string;
  }[];
  explanations: string[];
  positiveDrivers?: string[];
  negativeRisks?: string[];
  missingDataWarnings?: string[];
  practicalRecommendation?: string;
  competitors: { name: string; category: string; latitude: number; longitude: number }[];
  recommendedAreas?: {
    rank: number;
    landmark: string;
    road: string;
    locality: string;
    has_verified_street: boolean;
    score: number;
    badge: string;
    competitors_500m: number;
    latitude: number;
    longitude: number;
  }[];
}

const REPORT_KEY = "urbaniq.latestAnalysisReport";
const HISTORY_KEY = "urbaniq.analysisHistory";
const REPORT_EVENT = "urbaniq:analysis-report-updated";

export function saveAnalysisReport(report: AnalysisReport) {
  const enriched = {
    ...report,
    id: report.id || `${report.city}-${report.businessType}-${report.latitude.toFixed(4)}-${report.longitude.toFixed(4)}`,
  };
  localStorage.setItem(REPORT_KEY, JSON.stringify(enriched));

  // Also save to comparison history (up to 10 unique locations)
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    let list: AnalysisReport[] = raw ? JSON.parse(raw) : [];
    // Deduplicate by same lat/lon (within 100m) and business type or ID
    list = list.filter(
      (item) =>
        item.id !== enriched.id &&
        !(
          Math.abs(item.latitude - enriched.latitude) < 0.001 &&
          Math.abs(item.longitude - enriched.longitude) < 0.001 &&
          item.businessType === enriched.businessType
        )
    );
    list.unshift(enriched);
    if (list.length > 10) list = list.slice(0, 10);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("Could not save to comparison history:", err);
  }

  window.dispatchEvent(new Event(REPORT_EVENT));
}

export function addLocationToComparison(report: AnalysisReport): { success: boolean; message: string; count: number } {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    let list: AnalysisReport[] = raw ? JSON.parse(raw) : [];

    const enriched: AnalysisReport = {
      ...report,
      id: report.id || `loc-${report.city}-${report.businessType}-${report.latitude.toFixed(4)}-${report.longitude.toFixed(4)}`,
    };

    // Deduplicate by same lat/lon (within 100m) and business type, or matching id
    const existingIndex = list.findIndex(
      (item) =>
        (item.id && item.id === enriched.id) ||
        (Math.abs(item.latitude - enriched.latitude) < 0.001 &&
          Math.abs(item.longitude - enriched.longitude) < 0.001 &&
          item.businessType === enriched.businessType)
    );

    if (existingIndex >= 0) {
      list[existingIndex] = enriched;
    } else {
      list.unshift(enriched);
    }

    if (list.length > 10) list = list.slice(0, 10);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(REPORT_EVENT));

    return {
      success: true,
      message: `Added ${enriched.areaName || enriched.city} (${enriched.score}/100) to comparison.`,
      count: list.length,
    };
  } catch (err) {
    console.error("Failed to add location to comparison:", err);
    return {
      success: false,
      message: "Failed to save location to comparison storage.",
      count: 0,
    };
  }
}

export function getLatestAnalysisReport(): AnalysisReport | null {
  const stored = localStorage.getItem(REPORT_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as AnalysisReport;
  } catch {
    localStorage.removeItem(REPORT_KEY);
    return null;
  }
}

export function getComparisonHistory(): AnalysisReport[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AnalysisReport[];
  } catch {
    return [];
  }
}

export function clearComparisonHistory() {
  localStorage.removeItem(HISTORY_KEY);
  window.dispatchEvent(new Event(REPORT_EVENT));
}

export function subscribeToAnalysisReport(listener: () => void) {
  window.addEventListener(REPORT_EVENT, listener);
  return () => window.removeEventListener(REPORT_EVENT, listener);
}

export function downloadAnalysisReport(report: AnalysisReport) {
  const rows = [
    ["UrbanIQ Location Suitability & Intelligence Report"],
    ["Generated", new Date(report.generatedAt).toLocaleString()],
    ["City", report.city],
    ["Area / Coordinates", `${report.areaName || "Selected Point"} (${report.latitude}, ${report.longitude})`],
    ["Business Type", report.businessType],
    ["Analysis Radius", `${report.radiusMeters / 1000} km (${report.radiusMeters} m)`],
    ["Data Status", report.dataStatus === "live" ? "Live Real-World Data" : "Unverified / Sparse Data"],
    ["Data Source", report.dataSource === "google_places" ? "Google Places Platform" : (report.dataSource === "osm" ? "OpenStreetMap" : "Live POI Aggregation")],
    ["Authoritative Suitability Score", `${report.score}/100 (${report.suitabilityLabel || report.level})`],
    ["Data Confidence", report.confidenceLevel || "Medium"],
    ...(report.missingDataWarnings && report.missingDataWarnings.length > 0
      ? [[], ["Data Notices & Missing Data Disclosures"], ...report.missingDataWarnings.map((w) => [w])]
      : []),
    [],
    ["Multi-Criteria Factor Breakdown", "Score (0-100)", "Weight (%)", "Contribution (pts)"],
    ...report.factors.map((f) => [f.name, f.value, f.weight, f.weightedContribution || (f.value * (f.weight / 100)).toFixed(1)]),
    [],
    ["Key Positive Drivers"],
    ...(report.positiveDrivers || report.explanations).map((d) => [d]),
    [],
    ["Negative Risks & Considerations"],
    ...(report.negativeRisks || ["Standard competitive market risk"]).map((r) => [r]),
    [],
    ["Practical Recommendation", report.practicalRecommendation || ""],
    [],
    ["Competitors Detected", "Category", "Latitude", "Longitude"],
    ...report.competitors.map((place) => [place.name, place.category, place.latitude, place.longitude]),
    ...(report.recommendedAreas && report.recommendedAreas.length > 0
      ? [
          [],
          ["Area Discovery — Candidate Zones within Study Area"],
          ["Rank", "Area / Landmark", "Verified Street Status", "Score", "Suitability Badge", "Competitors (500m)", "Coordinates"],
          ...report.recommendedAreas.map((a) => [
            `#${a.rank}`,
            a.landmark,
            a.has_verified_street ? "Verified Commercial Road" : "Street Unverified (Approximate Zone)",
            `${a.score}/100`,
            a.badge,
            a.competitors_500m,
            `(${a.latitude}, ${a.longitude})`,
          ]),
        ]
      : []),
    [],
    ["Disclaimer", "Scoring is deterministic MCDA + Mamdani fuzzy inference. It provides comparative suitability screening and is not a financial or revenue guarantee."],
  ];

  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const cell = String(value ?? "");
          return `"${cell.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\r\n");

  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `urbaniq-${report.city.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${report.businessType.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-score.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
