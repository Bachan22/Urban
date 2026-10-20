import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Button from "../components/Button";
import { GitCompare, MapPin, ArrowRight, AlertTriangle, CheckCircle, Trash2, ExternalLink } from "lucide-react";
import { getComparisonHistory, clearComparisonHistory, type AnalysisReport } from "../utils/analysisReport";

export const ComparePage: React.FC = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<AnalysisReport[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>("All");

  useEffect(() => {
    const refresh = () => setHistory(getComparisonHistory());
    refresh();
    window.addEventListener("urbaniq:analysis-report-updated", refresh);
    return () => window.removeEventListener("urbaniq:analysis-report-updated", refresh);
  }, []);

  const handleClear = () => {
    clearComparisonHistory();
    setHistory([]);
  };

  const categories = ["All", ...Array.from(new Set(history.map((h) => h.businessType)))];

  const filteredHistory = filterCategory === "All"
    ? history
    : history.filter((h) => h.businessType === filterCategory);

  // Rank descending by overall score
  const rankedLocations = [...filteredHistory].sort((a, b) => b.score - a.score);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#0f172a" }}>
            Multi-Location Site Comparison Engine
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#64748b" }}>
            Data-driven benchmarking using consistent MCDA weights and Mamdani fuzzy inference.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {categories.length > 2 && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                height: "36px",
                padding: "0 10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                background: "white",
                color: "#1e293b",
              }}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "All" ? "All Categories" : cat}
                </option>
              ))}
            </select>
          )}

          {history.length > 0 && (
            <button
              onClick={handleClear}
              style={{
                height: "36px",
                padding: "0 12px",
                borderRadius: "6px",
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#dc2626",
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Trash2 size={14} /> Clear History
            </button>
          )}

          <Button
            onClick={() => navigate("/map?business=Cafe&city=Mumbai&location=Mira+Road")}
            rightIcon={<ArrowRight size={16} />}
          >
            Analyze New Site
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {rankedLocations.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                backgroundColor: "#eff6ff",
                color: "#2563eb",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <GitCompare size={28} />
            </div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#0f172a" }}>
              No Analyzed Locations Yet
            </h3>
            <p style={{ maxWidth: "520px", margin: "10px auto 20px auto", fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
              Open the interactive GIS map and analyze two or more locations (for instance, Mira Road, Bandra, or Pune Kothrud).
              Each analyzed point is recorded with real POI counts and evaluated side-by-side here.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              <Button
                onClick={() => navigate("/map?business=Cafe&city=Mumbai&location=Mira+Road")}
                rightIcon={<MapPin size={16} />}
              >
                Analyze Mira Road (Cafe)
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/map?business=Cafe&city=Pune&location=Kothrud")}
                rightIcon={<MapPin size={16} />}
              >
                Analyze Pune Kothrud (Cafe)
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Advisory banner if no site meets threshold */}
          {rankedLocations[0].score < 50 && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                padding: "12px 16px",
                color: "#991b1b",
                fontSize: "13px",
                lineHeight: 1.5,
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong>Advisory: No analyzed site currently meets the suitability threshold (≥ 50/100).</strong>
                <p style={{ margin: "4px 0 0 0", color: "#7f1d1d" }}>
                  While {rankedLocations[0].areaName || rankedLocations[0].city} ranks highest among candidate options ({rankedLocations[0].score}/100), its score reflects elevated commercial saturation or limited footfall anchors. Consider testing additional sectors before committing capital.
                </p>
              </div>
            </div>
          )}

          {/* Comparison Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(320px, 1fr))`, gap: "18px" }}>
            {rankedLocations.map((item, idx) => {
              const rank = idx + 1;
              const isTop = rank === 1;

              return (
                <div
                  key={item.id || `${item.latitude}-${item.longitude}`}
                  style={{
                    background: "white",
                    borderRadius: "12px",
                    border: isTop ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                    boxShadow: isTop ? "0 4px 18px rgba(59, 130, 246, 0.12)" : "0 2px 8px rgba(0,0,0,0.04)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      padding: "16px",
                      background: isTop ? "#eff6ff" : "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: isTop
                              ? (item.score >= 70 ? "#16a34a" : (item.score >= 50 ? "#d97706" : "#64748b"))
                              : "#94a3b8",
                            color: "white",
                          }}
                        >
                          #{rank}{" "}
                          {isTop && (
                            item.score >= 70
                              ? "Top Recommendation"
                              : (item.score >= 50 ? "Highest-Ranked Candidate" : "Highest-Ranked (Below Threshold)")
                          )}
                        </span>
                        <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                          {item.businessType}
                        </span>
                      </div>
                      <h3 style={{ margin: "6px 0 0 0", fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
                        {item.areaName || `${item.city} Location`}
                      </h3>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        {item.city} · {item.radiusMeters / 1000} km study radius · ({item.latitude.toFixed(4)}, {item.longitude.toFixed(4)})
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "28px", fontWeight: 800, color: item.score >= 70 ? "#15803d" : (item.score >= 50 ? "#d97706" : "#dc2626") }}>
                        {item.score}
                        <small style={{ fontSize: "13px", fontWeight: 500, color: "#64748b" }}>/100</small>
                      </div>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                        {item.suitabilityLabel || item.level} Suitability
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>
                    {/* Metadata & Confidence badges */}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 7px",
                          borderRadius: "4px",
                          background: item.confidenceLevel === "High" ? "#dcfce7" : (item.confidenceLevel === "Medium" ? "#fef3c7" : "#fee2e2"),
                          color: item.confidenceLevel === "High" ? "#166534" : (item.confidenceLevel === "Medium" ? "#92400e" : "#b91c1c"),
                        }}
                      >
                        Confidence: {item.confidenceLevel || "Medium"}
                      </span>
                      {item.dataSource && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: "4px",
                            background: item.dataSource === "google_places" ? "#e0f2fe" : "#f1f5f9",
                            color: item.dataSource === "google_places" ? "#0369a1" : "#475569",
                            border: `1px solid ${item.dataSource === "google_places" ? "#bae6fd" : "#e2e8f0"}`,
                          }}
                        >
                          {item.dataSource === "google_places" ? "Google Places" : "OpenStreetMap"}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 500,
                          padding: "2px 7px",
                          borderRadius: "4px",
                          background: "#f1f5f9",
                          color: "#475569",
                        }}
                      >
                        {item.competitors?.length ?? 0} Competitors
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#94a3b8",
                          marginLeft: "auto",
                        }}
                      >
                        {new Date(item.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {/* Factor Breakdown Bars */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>
                        Factor Scores
                      </div>
                      {item.factors.map((f) => {
                        const barColor = f.value >= 75 ? "#10b981" : (f.value >= 50 ? "#3b82f6" : "#f59e0b");
                        return (
                          <div key={f.name}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "2px" }}>
                              <span style={{ color: "#334155" }}>{f.name}</span>
                              <strong style={{ color: "#0f172a" }}>{f.value}/100 ({f.weight}%)</strong>
                            </div>
                            <div style={{ height: "5px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{ width: `${Math.min(100, f.value)}%`, background: barColor, height: "100%" }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Trade-Offs / Highlights */}
                    <div style={{ fontSize: "12px", background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                      <strong style={{ fontSize: "11px", color: "#1e293b", display: "block", marginBottom: "4px" }}>
                        Key Location Driver:
                      </strong>
                      <div style={{ color: "#15803d", display: "flex", alignItems: "flex-start", gap: "5px", marginBottom: "4px" }}>
                        <CheckCircle size={13} style={{ flexShrink: 0, marginTop: "2px" }} />
                        <span>{item.positiveDrivers?.[0] || item.explanations?.[0] || "Active urban catchment"}</span>
                      </div>
                      <strong style={{ fontSize: "11px", color: "#1e293b", display: "block", margin: "6px 0 4px 0" }}>
                        Main Trade-Off / Consideration:
                      </strong>
                      <div style={{ color: "#b91c1c", display: "flex", alignItems: "flex-start", gap: "5px" }}>
                        <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: "2px" }} />
                        <span>{item.negativeRisks?.[0] || "Competitor presence requires differentiation"}</span>
                      </div>
                    </div>

                    {/* Missing Data Disclosure */}
                    {item.missingDataWarnings && item.missingDataWarnings.length > 0 && (
                      <div style={{ fontSize: "11px", color: "#92400e", background: "#fffbeb", border: "1px solid #fef3c7", padding: "6px 10px", borderRadius: "6px" }}>
                        <strong>Missing Data / Limitations: </strong>
                        {item.missingDataWarnings.join(" ")}
                      </div>
                    )}

                    {/* Practical Recommendation */}
                    {item.practicalRecommendation && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: item.score >= 70 ? "#166534" : (item.score >= 50 ? "#854d0e" : "#991b1b"),
                          lineHeight: 1.5,
                          borderLeft: `3px solid ${item.score >= 70 ? "#16a34a" : (item.score >= 50 ? "#d97706" : "#dc2626")}`,
                          background: item.score >= 70 ? "#f0fdf4" : (item.score >= 50 ? "#fefce8" : "#fef2f2"),
                          padding: "6px 10px",
                          borderRadius: "0 6px 6px 0",
                        }}
                      >
                        <strong>Recommendation: </strong>
                        {item.practicalRecommendation}
                      </div>
                    )}
                  </div>

                  {/* Card Footer Action */}
                  <div style={{ padding: "12px 16px", borderTop: "1px solid #f1f5f9", background: "#fcfdfe" }}>
                    <button
                      onClick={() =>
                        navigate(
                          `/map?business=${encodeURIComponent(item.businessType)}&city=${encodeURIComponent(item.city)}&lat=${item.latitude}&lon=${item.longitude}&radius=${item.radiusMeters / 1000}`
                        )
                      }
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        background: "white",
                        color: "#2563eb",
                        fontWeight: 600,
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <ExternalLink size={14} /> Open in GIS Map
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparative Summary & Methodology Note */}
          {rankedLocations.length >= 2 && (
            <Card title="Comparative Ranking Rationale" subtitle="Why the top location was selected">
              <div style={{ fontSize: "13px", color: "#334155", lineHeight: 1.6 }}>
                <p style={{ margin: "0 0 10px 0" }}>
                  <strong>{rankedLocations[0].areaName || `${rankedLocations[0].city} Site`}</strong> ranks #{1} with a score of <strong>{rankedLocations[0].score}/100</strong>,
                  outperforming #{2} <strong>{rankedLocations[1].areaName || `${rankedLocations[1].city} Site`}</strong> ({rankedLocations[1].score}/100) by{" "}
                  <strong>{rankedLocations[0].score - rankedLocations[1].score} points</strong>.
                </p>
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600, marginBottom: "4px", color: "#0f172a" }}>Evaluation Integrity Guidelines:</div>
                  <ul style={{ margin: 0, paddingLeft: "18px", color: "#64748b", fontSize: "12px" }}>
                    <li>All locations are scored using identical category-specific factor weights (Competitor density 20%, Demand 25%, Customer access 20%, Transit 15%, Synergy 10%, Confidence 10%).</li>
                    <li>Mamdani fuzzy inference evaluates trade-offs between demand and competitive saturation.</li>
                    <li>Scores reflect location suitability for further on-the-ground investigation; they are not financial revenue guarantees.</li>
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default ComparePage;
