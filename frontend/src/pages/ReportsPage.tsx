import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Download, FileText, MapPin } from "lucide-react";
import Card from "../components/Card";
import Button from "../components/Button";
import { downloadAnalysisReport, getLatestAnalysisReport, subscribeToAnalysisReport, type AnalysisReport } from "../utils/analysisReport";

export const ReportsPage = () => {
  const navigate = useNavigate();
  const [report, setReport] = useState<AnalysisReport | null>(null);

  useEffect(() => {
    setReport(getLatestAnalysisReport());
    return subscribeToAnalysisReport(() => setReport(getLatestAnalysisReport()));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1000 }}>
      <header>
        <h1 style={{ margin: 0, color: "#101d3e", fontSize: 27 }}>Business feasibility report</h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>Review your latest location analysis and download its score, factors and nearby competitors.</p>
      </header>

      {!report ? (
        <Card>
          <div style={{ padding: "18px 8px", textAlign: "center" }}>
            <FileText size={34} color="#2563eb" />
            <h2 style={{ margin: "12px 0 6px", color: "#0f172a", fontSize: 20 }}>Run an analysis to build your report</h2>
            <p style={{ maxWidth: 530, margin: "0 auto 18px", color: "#64748b", lineHeight: 1.6 }}>Choose a business type, select a city and click a location on the map. UrbanIQ will summarize the opportunity signal and businesses already nearby.</p>
            <Button onClick={() => navigate("/map?business=Pharmacy&city=Pune")} rightIcon={<MapPin size={16} />}>Analyze a location</Button>
          </div>
        </Card>
      ) : (
        <>
          <Card
            title={`${report.businessType} · ${report.city}${report.areaName ? ` · ${report.areaName}` : ""}`}
            subtitle={`Generated ${new Date(report.generatedAt).toLocaleString()} · ${report.radiusMeters / 1000} km study radius`}
            action={<Button size="sm" onClick={() => downloadAnalysisReport(report)} leftIcon={<Download size={15} />}>Download CSV report</Button>}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
              <div style={{ padding: 16, borderRadius: 10, background: "#f1f7ff" }}><span style={{ display: "block", color: "#64748b", fontSize: 12 }}>Opportunity signal (proxy)</span><strong style={{ display: "block", marginTop: 5, color: "#123d87", fontSize: 26 }}>{report.score}/100</strong><span style={{ color: "#334155", fontSize: 13 }}>{report.level} potential</span></div>
              <div style={{ padding: 16, borderRadius: 10, background: "#f0faf6" }}><span style={{ display: "block", color: "#64748b", fontSize: 12 }}>Nearby competitors</span><strong style={{ display: "block", marginTop: 5, color: "#087d63", fontSize: 26 }}>{report.competitors.length}</strong><span style={{ color: "#334155", fontSize: 13 }}>{report.dataStatus === "live" ? "OpenStreetMap places in radius" : "Live competitor data unavailable"}</span></div>
              <div style={{ padding: 16, borderRadius: 10, background: "#f8f6ff" }}><span style={{ display: "block", color: "#64748b", fontSize: 12 }}>Selected point</span><strong style={{ display: "block", marginTop: 8, color: "#433282", fontSize: 14 }}>{report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}</strong></div>
            </div>

            <h3 style={{ margin: "24px 0 10px", color: "#17223e", fontSize: 15 }}>Feasibility factors</h3>
            <div style={{ display: "grid", gap: 9 }}>
              {report.factors.map((factor) => <div key={factor.name} style={{ display: "grid", gridTemplateColumns: "minmax(130px, 1fr) 2fr 42px", alignItems: "center", gap: 12, color: "#475569", fontSize: 13 }}><span>{factor.name} · {factor.weight}%</span><span style={{ height: 8, borderRadius: 8, background: "#e8edf4", overflow: "hidden" }}><span style={{ display: "block", width: `${factor.value}%`, height: "100%", background: "#18816f" }} /></span><strong>{factor.value}</strong></div>)}
            </div>
            <p style={{ margin: "18px 0 0", color: "#475569", fontSize: 13, lineHeight: 1.6 }}>{report.explanations.join(" ")}</p>
          </Card>

          <Card title={`Nearby competitors (${report.competitors.length})`} subtitle="Places mapped by OpenStreetMap. Select a place in the analysis map to open it in OpenStreetMap.">
            {report.competitors.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 9 }}>
                {report.competitors.map((place, index) => <div key={`${place.name}-${place.latitude}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 12px", border: "1px solid #e8edf3", borderRadius: 9 }}><div><strong style={{ display: "block", color: "#1e293b", fontSize: 13 }}>{place.name}</strong><span style={{ color: "#64748b", fontSize: 12 }}>{place.category}</span></div><a href={`https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=17/${place.latitude}/${place.longitude}`} target="_blank" rel="noreferrer" style={{ alignSelf: "center", color: "#1d4f91", fontSize: 12 }}>View map</a></div>)}
              </div>
            ) : <p style={{ color: "#64748b", fontSize: 13 }}>No matching places were found in the selected radius.</p>}
          </Card>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 14, border: "1px solid #f4dfb5", borderRadius: 10, color: "#79551b", background: "#fffaf0", fontSize: 12, lineHeight: 1.55 }}><AlertCircle size={17} style={{ flexShrink: 0 }} /><span>UrbanIQ provides a screening signal, not a guarantee of business success. Competitor listings come from OpenStreetMap and may be incomplete. Population, demand and accessibility factors use prototype assumptions; validate costs, footfall and local rules before investing.</span></div>
        </>
      )}
    </div>
  );
};

export default ReportsPage;
