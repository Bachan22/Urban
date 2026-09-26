import React from "react";
import Card from "../components/Card";
import { Sliders, Info } from "lucide-react";

export const SimulatorPage: React.FC = () => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#0f172a" }}>
          What-If Opportunity Simulator
        </h1>
        <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#64748b" }}>
          Simulate how shifts in competition, transit, or population affect opportunity scores.
        </p>
      </div>

      <Card>
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              backgroundColor: "#f5f3ff",
              color: "#7c3aed",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <Sliders size={28} />
          </div>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#0f172a" }}>
            Dynamic Scenario Simulator (Phase 14)
          </h3>
          <p style={{ maxWidth: "540px", margin: "10px auto 0 auto", fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
            Users will be able to modify key variables (e.g. +20% competitor increase, +5,000 population,
            new metro station) and evaluate live sensitivity using our Fuzzy Scoring Engine rather
            than random UI increments.
          </p>
          <div style={{ marginTop: "20px", display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#f8fafc", padding: "6px 14px", borderRadius: "6px", fontSize: "13px", color: "#64748b" }}>
            <Info size={15} /> Scheduled for Phase 14 after Fuzzy Logic Engine integration.
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SimulatorPage;
