import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Button from "../components/Button";
import {
  Users,
  Building2,
  Navigation,
  Sparkles,
  MapPin,
  Info,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { getCities, getCategories, calculateOpportunity } from "../services/api";
import type { City, Category, OpportunityResponse } from "../types/api";

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCityId, setSelectedCityId] = useState("pune");
  const [selectedCategoryId, setSelectedCategoryId] = useState("healthcare");
  const [opportunity, setOpportunity] = useState<OpportunityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load cities & categories on mount ──────
  useEffect(() => {
    async function loadMeta() {
      const [cityList, catList] = await Promise.all([getCities(), getCategories()]);
      setCities(cityList);
      setCategories(catList);
    }
    loadMeta();
  }, []);

  const selectedCity = cities.find((c) => c.id === selectedCityId);

  // ── Run Opportunity Engine ──────────────────
  const handleRunAnalysis = async () => {
    if (!selectedCity) return;
    setLoading(true);
    setError(null);
    setOpportunity(null);

    try {
      const result = await calculateOpportunity({
        city_id: selectedCityId,
        category_id: selectedCategoryId,
        latitude: selectedCity.center.latitude,
        longitude: selectedCity.center.longitude,
        radius_meters: 2000,
        population_proxy: selectedCity.observed_population
          ? Math.round(selectedCity.observed_population * 0.04)
          : 100000,
        accessibility_proxy: 75,
      });
      setOpportunity(result);
      setBackendOnline(true);
    } catch (err) {
      console.error(err);
      setBackendOnline(false);
      setError(
        "Backend is currently offline. Start the FastAPI server to see live scores."
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Score Color ─────────────────────────────
  const scoreColor = (score: number) => {
    if (score >= 75) return { bg: "#ecfdf5", text: "#059669" };
    if (score >= 50) return { bg: "#eff6ff", text: "#2563eb" };
    return { bg: "#fef3c7", text: "#d97706" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* PAGE HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#0f172a" }}>
            Urban Opportunity Intelligence
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#64748b" }}>
            Geospatial analytics, service-gap detection, and Fuzzy Logic opportunity scoring.
          </p>
        </div>

        {/* CITY + CATEGORY SELECTORS */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={selectedCityId}
            onChange={(e) => setSelectedCityId(e.target.value)}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}, {c.state}
              </option>
            ))}
          </select>

          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <Button
            variant="primary"
            size="md"
            isLoading={loading}
            onClick={handleRunAnalysis}
            leftIcon={<Sparkles size={15} />}
          >
            Run Opportunity Analysis
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={() => navigate("/map")}
            leftIcon={<MapPin size={15} />}
          >
            Open Map
          </Button>
        </div>
      </div>

      {/* BACKEND OFFLINE NOTICE */}
      {!backendOnline && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            padding: "14px 18px",
            backgroundColor: "#fef3c7",
            borderRadius: "10px",
            border: "1px solid #fde68a",
            alignItems: "center",
          }}
        >
          <AlertTriangle size={18} color="#d97706" />
          <p style={{ margin: 0, fontSize: "13px", color: "#92400e" }}>
            <strong>Backend Server Offline:</strong> Run{" "}
            <code
              style={{
                backgroundColor: "#fde68a",
                padding: "1px 6px",
                borderRadius: "4px",
              }}
            >
              uvicorn backend.app.main:app --reload
            </code>{" "}
            from <code>~/urbanIq</code> to connect the live opportunity engine.
          </p>
        </div>
      )}

      {/* STATIC METRIC KPI CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "18px",
        }}
      >
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
                Observed Population (Proxy)
              </span>
              <h2 style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: 700, color: "#0f172a" }}>
                {selectedCity
                  ? `${(selectedCity.observed_population! / 1_000_000).toFixed(2)}M`
                  : "—"}
              </h2>
              <span style={{ fontSize: "12px", color: "#059669", fontWeight: 600 }}>
                {selectedCity?.data_confidence || "Loading…"}
              </span>
            </div>
            <div style={{ padding: "10px", borderRadius: "10px", backgroundColor: "#eff6ff", color: "#2563eb" }}>
              <Users size={22} />
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
                OpenStreetMap POIs Tracked
              </span>
              <h2 style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: 700, color: "#0f172a" }}>
                Live Feed
              </h2>
              <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600 }}>
                Overpass API Pipeline
              </span>
            </div>
            <div style={{ padding: "10px", borderRadius: "10px", backgroundColor: "#ecfdf5", color: "#059669" }}>
              <Building2 size={22} />
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
                Study Radius
              </span>
              <h2 style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: 700, color: "#0f172a" }}>
                {selectedCity ? `${selectedCity.study_radius_km} KM` : "—"}
              </h2>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>
                Metropolitan Ring Zone
              </span>
            </div>
            <div style={{ padding: "10px", borderRadius: "10px", backgroundColor: "#fef3c7", color: "#d97706" }}>
              <Navigation size={22} />
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
                Opportunity Engine
              </span>
              <h2 style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: 700, color: "#0f172a" }}>
                Fuzzy + GIS
              </h2>
              <span style={{ fontSize: "12px", color: "#7c3aed", fontWeight: 600 }}>
                Explainable Multi-Factor
              </span>
            </div>
            <div style={{ padding: "10px", borderRadius: "10px", backgroundColor: "#f5f3ff", color: "#7c3aed" }}>
              <Sparkles size={22} />
            </div>
          </div>
        </Card>
      </div>

      {/* LOADING SPINNER */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", padding: "24px", color: "#64748b" }}>
          <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
          <span>Running Opportunity Scoring Engine…</span>
        </div>
      )}

      {/* ERROR MESSAGE */}
      {error && !loading && (
        <div
          style={{
            padding: "16px 20px",
            backgroundColor: "#fef3c7",
            borderRadius: "10px",
            border: "1px solid #fde68a",
            fontSize: "14px",
            color: "#92400e",
          }}
        >
          {error}
        </div>
      )}

      {/* OPPORTUNITY ENGINE RESULT CARD */}
      {opportunity && !loading && (
        <Card
          title="Opportunity Analysis Result"
          subtitle={`${selectedCity?.name} · ${categories.find((c) => c.id === selectedCategoryId)?.name} · 2km radius`}
          action={
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                backgroundColor: "#fef3c7",
                color: "#92400e",
                padding: "3px 8px",
                borderRadius: "9999px",
              }}
            >
              Prototype Score
            </span>
          }
        >
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            {/* SCORE GAUGE */}
            <div
              style={{
                textAlign: "center",
                padding: "20px 28px",
                borderRadius: "12px",
                backgroundColor: scoreColor(opportunity.opportunity_score).bg,
                minWidth: "140px",
              }}
            >
              <div style={{ fontSize: "56px", fontWeight: 800, color: scoreColor(opportunity.opportunity_score).text, lineHeight: 1 }}>
                {opportunity.opportunity_score}
              </div>
              <div style={{ fontSize: "18px", color: scoreColor(opportunity.opportunity_score).text, fontWeight: 700 }}>
                / 100
              </div>
              <div
                style={{
                  marginTop: "10px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: scoreColor(opportunity.opportunity_score).text,
                }}
              >
                {opportunity.opportunity_level} Opportunity
              </div>
            </div>

            {/* FACTOR BREAKDOWN */}
            <div style={{ flex: 1, minWidth: "200px" }}>
              <p style={{ margin: "0 0 10px 0", fontWeight: 600, fontSize: "13px", color: "#374151" }}>
                FACTOR BREAKDOWN
              </p>
              {opportunity.factors.map((factor) => (
                <div key={factor.name} style={{ marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "13px", color: "#374151" }}>{factor.name}</span>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                      {factor.value.toFixed(0)}/100
                    </span>
                  </div>
                  <div style={{ height: "6px", backgroundColor: "#f1f5f9", borderRadius: "9999px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${factor.value}%`,
                        backgroundColor: factor.value >= 70 ? "#059669" : factor.value >= 45 ? "#2563eb" : "#d97706",
                        borderRadius: "9999px",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* REASONS & RISKS */}
            <div style={{ flex: 1, minWidth: "200px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <p style={{ margin: "0 0 8px 0", fontWeight: 600, fontSize: "13px", color: "#059669" }}>
                  ✓ WHY PROMISING
                </p>
                {opportunity.reasons.map((r, i) => (
                  <p key={i} style={{ margin: "0 0 5px 0", fontSize: "13px", color: "#374151" }}>
                    • {r}
                  </p>
                ))}
              </div>
              <div>
                <p style={{ margin: "0 0 8px 0", fontWeight: 600, fontSize: "13px", color: "#d97706" }}>
                  ⚠ RISKS & LIMITATIONS
                </p>
                {opportunity.risks.map((r, i) => (
                  <p key={i} style={{ margin: "0 0 5px 0", fontSize: "13px", color: "#64748b" }}>
                    • {r}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* MODULE NAVIGATION CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "18px" }}>
        <Card
          title="Interactive GIS Map"
          subtitle="Explore zones, competitors, and service gaps"
          footer={
            <Link to="/map" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#2563eb", fontWeight: 600, fontSize: "13px", textDecoration: "none" }}>
              Launch Map <ChevronRight size={14} />
            </Link>
          }
        >
          <p style={{ margin: 0, fontSize: "14px", color: "#475569", lineHeight: 1.6 }}>
            Click any location in {selectedCity?.name || "the city"} to get a live Opportunity
            Score from the Fuzzy Logic backend engine. View POI buffers and catchment zones.
          </p>
        </Card>

        <Card
          title="Opportunities Ranking"
          subtitle="Top-ranked zones by composite opportunity score"
          footer={
            <Link to="/opportunities" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#2563eb", fontWeight: 600, fontSize: "13px", textDecoration: "none" }}>
              View Ranking <ChevronRight size={14} />
            </Link>
          }
        >
          <p style={{ margin: 0, fontSize: "14px", color: "#475569", lineHeight: 1.6 }}>
            Pre-evaluated candidate zones displayed by composite demand, gap, and
            accessibility-adjusted Fuzzy score.
          </p>
        </Card>

        <Card
          title="What-If Simulator"
          subtitle="Sensitivity analysis for market changes"
          footer={
            <Link to="/simulator" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#2563eb", fontWeight: 600, fontSize: "13px", textDecoration: "none" }}>
              Open Simulator <ChevronRight size={14} />
            </Link>
          }
        >
          <p style={{ margin: 0, fontSize: "14px", color: "#475569", lineHeight: 1.6 }}>
            Evaluate how adding competitors or improving transit access changes the Fuzzy
            opportunity score dynamically.
          </p>
        </Card>
      </div>

      {/* DATA TRANSPARENCY NOTICE */}
      <div style={{ display: "flex", gap: "12px", padding: "16px 20px", backgroundColor: "#f1f5f9", borderRadius: "10px", border: "1px solid #e2e8f0", alignItems: "center" }}>
        <Info size={20} color="#475569" style={{ flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
          <strong>Academic Capstone & Data Transparency:</strong> All scores are prototype results
          generated by a Fuzzy Logic + Spatial Analysis engine. Demographic data cited from PMC ESR
          2021-22 and Census of India 2011 (Proxy). No commercial revenue guarantee is implied.
          Data mode: <code style={{ backgroundColor: "#e2e8f0", padding: "1px 5px", borderRadius: "4px" }}>prototype</code>
        </p>
      </div>
    </div>
  );
};

export default DashboardPage;
