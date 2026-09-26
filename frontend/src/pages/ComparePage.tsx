import React from "react";
import Card from "../components/Card";
import { GitCompare, Info } from "lucide-react";

export const ComparePage: React.FC = () => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#0f172a" }}>
          Location Comparison Engine
        </h1>
        <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#64748b" }}>
          Side-by-side multi-factor benchmarking across Candidate A, B, and C.
        </p>
      </div>

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
            Multi-Location Comparison Module (Phase 14)
          </h3>
          <p style={{ maxWidth: "540px", margin: "10px auto 0 auto", fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
            This module will allow you to select up to 3 candidate zones and compare them across
            opportunity score, competition density, transport accessibility, and service gap ratio.
            Does not declare an arbitrary "winner" unless user-defined criteria are specified.
          </p>
          <div style={{ marginTop: "20px", display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#f8fafc", padding: "6px 14px", borderRadius: "6px", fontSize: "13px", color: "#64748b" }}>
            <Info size={15} /> Scheduled for Phase 14 after GIS Feature Pipeline is ready.
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ComparePage;
