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
    dataState?: "observed" | "confirmed_zero" | "unavailable" | "partial" | string;
    isEstimated?: boolean;
    rawCount?: number;
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

function sanitizeForCsv(val: any): string {
  if (val === null || val === undefined) return "";
  let str = String(val);
  // Prevent CSV Formula Injection in Excel (=, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  // Escape quotes
  return `"${str.replace(/"/g, '""')}"`;
}

export function downloadAnalysisReport(report: AnalysisReport) {
  const sections: string[][] = [];

  // 1. EXECUTIVE HEADER & METADATA
  sections.push(["URBANIQ BUSINESS FEASIBILITY REPORT"]);
  sections.push(["Report Title", "UrbanIQ Location Suitability Assessment"]);
  sections.push(["Generated Timestamp", new Date(report.generatedAt).toISOString()]);
  sections.push(["Target Business Category", report.businessType]);
  sections.push(["Administrative City", report.city]);
  sections.push(["Study Zone / Area", report.areaName || "Selected Study Centre"]);
  sections.push(["Centre Latitude", report.latitude.toFixed(5)]);
  sections.push(["Centre Longitude", report.longitude.toFixed(5)]);
  sections.push(["Study Radius (km)", (report.radiusMeters / 1000).toFixed(1)]);
  sections.push(["Overall Opportunity Score", `${report.score}/100`]);
  sections.push(["Suitability Potential", report.suitabilityLabel || report.level]);
  sections.push(["Data Confidence Level", report.confidenceLevel || "Standard"]);
  sections.push(["Data Freshness / Quality", report.dataStatus === "live" ? "Live Verified OSM Data" : "Unverified / Sparse Data"]);
  sections.push(["Primary Data Source", report.dataSource === "google_places" ? "Google Places API" : "OpenStreetMap"]);
  sections.push(["Executive Recommendation", report.practicalRecommendation || ""]);
  sections.push([]);

  // 2. DISCLOSURES & WARNINGS
  if (report.missingDataWarnings && report.missingDataWarnings.length > 0) {
    sections.push(["DATA NOTICES & UNCERTAINTY DISCLOSURES"]);
    sections.push(["Notice Index", "Disclosure Details"]);
    report.missingDataWarnings.forEach((w, idx) => {
      sections.push([`Notice #${idx + 1}`, w]);
    });
    sections.push([]);
  }

  // 3. FACTOR EVALUATION BREAKDOWN (ONE RECORD PER ROW, CLEAR COLUMNS)
  sections.push(["FEASIBILITY FACTOR BREAKDOWN (MCDA MODEL)"]);
  sections.push(["Factor Name", "Score (0-100)", "Weight (%)", "Contribution (pts)", "Data Status", "Criterion Insight"]);
  report.factors.forEach((f) => {
    const contribution = f.weightedContribution !== undefined
      ? f.weightedContribution.toString()
      : (f.value * (f.weight / 100)).toFixed(1);
    const state = f.dataState || f.status;
    const status = (state === "unavailable" || f.isEstimated)
      ? "Estimated / Proxy"
      : (state === "confirmed_zero" ? "Confirmed 0" : (state === "partial" ? "Partially Verified" : "Observed"));
    sections.push([
      f.name,
      f.value.toString(),
      f.weight.toString(),
      contribution,
      status,
      f.description || ""
    ]);
  });
  sections.push([]);

  // 4. STRATEGIC DRIVERS & RISKS
  sections.push(["KEY STRATEGIC CONSIDERATIONS"]);
  sections.push(["Type", "Description"]);
  (report.positiveDrivers || report.explanations || []).forEach((d) => {
    sections.push(["Positive Driver", d]);
  });
  (report.negativeRisks || ["Standard competitive and demographic market risk"]).forEach((r) => {
    sections.push(["Risk / Trade-off", r]);
  });
  sections.push([]);

  // 5. DIRECT COMPETITORS TABLE (EACH IN SEPARATE COLUMNS & ROWS)
  sections.push([`MAPPED COMPETITOR DIRECTORY (${report.competitors.length} RECORDED PLACES)`]);
  if (report.competitors.length > 0) {
    sections.push(["Index", "Business Name", "Category", "Latitude", "Longitude", "Data Source"]);
    report.competitors.forEach((c, idx) => {
      sections.push([
        (idx + 1).toString(),
        c.name || "Commercial Venue",
        c.category || report.businessType,
        c.latitude.toFixed(5),
        c.longitude.toFixed(5),
        "OpenStreetMap POI"
      ]);
    });
  } else {
    sections.push(["Status", "No direct competitor points of interest recorded in current study circle"]);
  }
  sections.push([]);

  // 6. CANDIDATE LOCATIONS MATRIX (IF AVAILABLE)
  if (report.recommendedAreas && report.recommendedAreas.length > 0) {
    sections.push(["AREA DISCOVERY — RECOMMENDED CANDIDATE LOCATIONS (500M CATCHMENT)"]);
    sections.push(["Rank", "Locality / Landmark", "Suitability Score", "Suitability Badge", "Competitors (500m)", "Coordinates", "Street Verification Status"]);
    report.recommendedAreas.forEach((cand) => {
      sections.push([
        `#${cand.rank}`,
        cand.landmark,
        `${cand.score}/100`,
        cand.badge || "Candidate",
        cand.competitors_500m.toString(),
        `(${cand.latitude.toFixed(4)}, ${cand.longitude.toFixed(4)})`,
        cand.has_verified_street ? "Verified Commercial Street" : "Approximate Zone"
      ]);
    });
    sections.push([]);
  }

  // 7. LEGAL & METHODOLOGY DISCLAIMER
  sections.push(["LEGAL & METHODOLOGY DISCLAIMER"]);
  sections.push(["Scope", "Deterministic multi-criteria decision analysis (MCDA) and Mamdani fuzzy logic screening."]);
  sections.push(["Disclaimer", "UrbanIQ estimates provide commercial screening signals only and do not guarantee footfall, revenue, or business profitability. Validate lease terms, local zoning, and physical conditions prior to financial commitment."]);

  // Construct CSV content with Excel UTF-8 BOM
  const csvContent = sections
    .map((row) => row.map(sanitizeForCsv).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const cleanLoc = (report.areaName || report.city).replace(/[^a-zA-Z0-9]+/g, "_");
  const cleanCat = report.businessType.replace(/[^a-zA-Z0-9]+/g, "_");
  const dateTag = new Date().toISOString().split("T")[0];
  link.href = url;
  link.download = `UrbanIQ_Feasibility_${cleanLoc}_${cleanCat}_${dateTag}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
