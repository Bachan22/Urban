import React from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { Download, CheckCircle } from "lucide-react";

export const ReportsPage: React.FC = () => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "900px" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#0f172a" }}>
          Executive Opportunity Reports
        </h1>
        <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#64748b" }}>
          Generate structured, auditable location dossiers and viva evaluation briefs.
        </p>
      </div>

      <Card
        title="Pune Opportunity Summary (Prototype Dossier)"
        subtitle="Includes demographic estimates, OSM competition audit, and fuzzy breakdown."
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#64748b" }}>Generated for Pune Study Area (20km radius)</span>
            <Button variant="outline" size="sm" leftIcon={<Download size={14} />}>
              Export PDF Dossier (Phase 17)
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckCircle size={16} color="#059669" />
            <span style={{ fontSize: "14px", color: "#334155" }}>
              Demographic Proxy: 3.55M observed municipal population (PMC ESR 2021-22)
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckCircle size={16} color="#059669" />
            <span style={{ fontSize: "14px", color: "#334155" }}>
              Geospatial Points of Interest: Live Overpass OpenStreetMap extraction
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckCircle size={16} color="#059669" />
            <span style={{ fontSize: "14px", color: "#334155" }}>
              Methodology: Multi-factor Fuzzy Inference & Service Gap Catchment Analysis
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ReportsPage;
