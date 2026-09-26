import React from "react";
import Card from "../components/Card";
import { TrendingUp, Info } from "lucide-react";

export const FuturePage: React.FC = () => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#0f172a" }}>
          Future Opportunity Forecasting
        </h1>
        <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#64748b" }}>
          Anticipate growth corridors based on population trends and planned infrastructure.
        </p>
      </div>

      <Card>
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              backgroundColor: "#ecfdf5",
              color: "#059669",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <TrendingUp size={28} />
          </div>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#0f172a" }}>
            Urban Growth Projection Model (Phase 15)
          </h3>
          <p style={{ maxWidth: "540px", margin: "10px auto 0 auto", fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
            Projects 3-5 year growth vectors using historical demographic trends and developmental
            infrastructure pipelines where empirical ground truth permits, clearly labeled as
            prototype projections.
          </p>
          <div style={{ marginTop: "20px", display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#f8fafc", padding: "6px 14px", borderRadius: "6px", fontSize: "13px", color: "#64748b" }}>
            <Info size={15} /> Scheduled for Phase 15.
          </div>
        </div>
      </Card>
    </div>
  );
};

export default FuturePage;
