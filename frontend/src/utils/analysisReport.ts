export interface AnalysisReport {
  generatedAt: string;
  city: string;
  areaName: string;
  businessType: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  dataStatus: "live" | "unavailable";
  score: number;
  level: string;
  factors: { name: string; value: number; weight: number }[];
  explanations: string[];
  competitors: { name: string; category: string; latitude: number; longitude: number }[];
}

const REPORT_KEY = "urbaniq.latestAnalysisReport";
const REPORT_EVENT = "urbaniq:analysis-report-updated";

export function saveAnalysisReport(report: AnalysisReport) {
  localStorage.setItem(REPORT_KEY, JSON.stringify(report));
  window.dispatchEvent(new Event(REPORT_EVENT));
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

export function subscribeToAnalysisReport(listener: () => void) {
  window.addEventListener(REPORT_EVENT, listener);
  return () => window.removeEventListener(REPORT_EVENT, listener);
}

export function downloadAnalysisReport(report: AnalysisReport) {
  const rows = [
    ["UrbanIQ Business Location Report"],
    ["Generated", new Date(report.generatedAt).toLocaleString()],
    ["City", report.city],
    ["Area", report.areaName],
    ["Business type", report.businessType],
    ["Analysis radius (meters)", report.radiusMeters],
    ["OpenStreetMap places loaded", report.dataStatus === "live" ? "Yes" : "No; score is a proxy only"],
    ["Selected latitude", report.latitude],
    ["Selected longitude", report.longitude],
    ["Opportunity signal (proxy)", `${report.level} (${report.score}/100)`],
    [],
    ["Factor", "Score", "Weight (%)"],
    ...report.factors.map((factor) => [factor.name, factor.value, factor.weight]),
    [],
    ["Nearby competitors and places", "Category", "Latitude", "Longitude"],
    ...report.competitors.map((place) => [place.name, place.category, place.latitude, place.longitude]),
    [],
    ["Interpretation"],
    ...report.explanations.map((explanation) => [explanation]),
    [],
    ["Data note", "Nearby places are sourced from OpenStreetMap. Scores use prototype demand and accessibility assumptions; verify site conditions and costs before investing."],
  ];

  const csv = rows.map((row) => row.map((value) => {
    const cell = String(value ?? "");
    return `"${cell.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `urbaniq-${report.city.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${report.businessType.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
