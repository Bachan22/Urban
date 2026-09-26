import React from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const OpportunitiesPage: React.FC = () => {
  const navigate = useNavigate();

  const demoOpportunities = [
    {
      zone: "Kothrud, Pune",
      category: "Education Institute",
      score: 92,
      level: "High",
      gap: "Significant unmet student demand near transit corridor",
      competition: "Moderate (3 existing within 2km)",
    },
    {
      zone: "Hinjawadi Phase 1, Pune",
      category: "Healthcare / Clinic",
      score: 87,
      level: "High",
      gap: "High residential tech population, limited 24/7 clinics",
      competition: "Low (1 existing within 2km)",
    },
    {
      zone: "Viman Nagar, Pune",
      category: "Food & Restaurant",
      score: 81,
      level: "High",
      gap: "High evening footfall, high accessibility",
      competition: "High (saturated within 500m)",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#0f172a" }}>
            Identified Opportunity Hotspots
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#64748b" }}>
            Candidate locations ranked by demand density, service gaps, and accessibility.
          </p>
        </div>
        <div style={{ fontSize: "12px", color: "#92400e", backgroundColor: "#fef3c7", padding: "6px 12px", borderRadius: "6px" }}>
          Demo Data (Awaiting Backend Engine Connect)
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {demoOpportunities.map((opp, idx) => (
          <Card key={idx}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "12px",
                    backgroundColor: opp.score >= 85 ? "#ecfdf5" : "#eff6ff",
                    color: opp.score >= 85 ? "#059669" : "#2563eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "20px",
                  }}
                >
                  {opp.score}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 600, color: "#0f172a" }}>
                    {opp.zone}
                  </h3>
                  <span style={{ fontSize: "13px", color: "#2563eb", fontWeight: 600 }}>
                    {opp.category}
                  </span>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                    {opp.gap} • {opp.competition}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/map?city=Pune&business=${encodeURIComponent(opp.category)}`)}
                rightIcon={<ArrowRight size={14} />}
              >
                Inspect on Map
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default OpportunitiesPage;
