import React, { useState } from "react";
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
} from "lucide-react";

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCity, setSelectedCity] = useState("Pune");
  const [selectedCategory, setSelectedCategory] = useState("Healthcare");

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
            Real-time geospatial analytics, service-gap detection, and opportunity scoring.
          </p>
        </div>

        {/* SELECTORS */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            <option value="Pune">Pune, Maharashtra</option>
            <option value="Mumbai">Mumbai, Maharashtra</option>
            <option value="Nashik">Nashik, Maharashtra</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            <option value="Healthcare">Healthcare</option>
            <option value="Food & Restaurant">Food & Restaurant</option>
            <option value="Education">Education</option>
          </select>

          <Button
            variant="primary"
            size="md"
            onClick={() => navigate(`/map?city=${selectedCity}&category=${selectedCategory}`)}
            leftIcon={<MapPin size={16} />}
          >
            Open Map View
          </Button>
        </div>
      </div>

      {/* METRIC KPI CARDS */}
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
                3.55M
              </h2>
              <span style={{ fontSize: "12px", color: "#059669", fontWeight: 600 }}>
                PMC ESR 2021-22 Source
              </span>
            </div>
            <div
              style={{
                padding: "10px",
                borderRadius: "10px",
                backgroundColor: "#eff6ff",
                color: "#2563eb",
              }}
            >
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
                2,480+
              </h2>
              <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600 }}>
                Live Overpass Pipeline
              </span>
            </div>
            <div
              style={{
                padding: "10px",
                borderRadius: "10px",
                backgroundColor: "#ecfdf5",
                color: "#059669",
              }}
            >
              <Building2 size={22} />
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
                Primary Study Radius
              </span>
              <h2 style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: 700, color: "#0f172a" }}>
                20 KM
              </h2>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>
                Metropolitan Ring Zone
              </span>
            </div>
            <div
              style={{
                padding: "10px",
                borderRadius: "10px",
                backgroundColor: "#fef3c7",
                color: "#d97706",
              }}
            >
              <Navigation size={22} />
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
                Opportunity Engine Mode
              </span>
              <h2 style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: 700, color: "#0f172a" }}>
                Fuzzy + GIS
              </h2>
              <span style={{ fontSize: "12px", color: "#7c3aed", fontWeight: 600 }}>
                Explainable Multi-Factor
              </span>
            </div>
            <div
              style={{
                padding: "10px",
                borderRadius: "10px",
                backgroundColor: "#f5f3ff",
                color: "#7c3aed",
              }}
            >
              <Sparkles size={22} />
            </div>
          </div>
        </Card>
      </div>

      {/* QUICK ACTIONS & MODULE CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
        <Card
          title="Interactive GIS Map"
          subtitle="Explore zones, competitors, service gaps, and opportunity heatmaps"
          footer={
            <Link
              to="/map"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                color: "#2563eb",
                fontWeight: 600,
                fontSize: "13px",
                textDecoration: "none",
              }}
            >
              Launch Interactive Map <ChevronRight size={14} />
            </Link>
          }
        >
          <p style={{ margin: 0, fontSize: "14px", color: "#475569", lineHeight: 1.6 }}>
            Pinpoint candidate locations anywhere across {selectedCity}. View live Overpass POIs,
            catchment buffers, nearest competitor distances, and fuzzy scoring breakdown.
          </p>
        </Card>

        <Card
          title="What-If Opportunity Simulator"
          subtitle="Simulate market shocks, population growth, and infrastructure additions"
          footer={
            <Link
              to="/simulator"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                color: "#2563eb",
                fontWeight: 600,
                fontSize: "13px",
                textDecoration: "none",
              }}
            >
              Open Simulator <ChevronRight size={14} />
            </Link>
          }
        >
          <p style={{ margin: 0, fontSize: "14px", color: "#475569", lineHeight: 1.6 }}>
            Adjust parameters like competition density, expected footfall proxy, and transit
            proximity with interactive sliders to evaluate score sensitivity dynamically.
          </p>
        </Card>

        <Card
          title="Multi-Location Comparison"
          subtitle="Side-by-side benchmark of Candidate A, B, and C"
          footer={
            <Link
              to="/compare"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                color: "#2563eb",
                fontWeight: 600,
                fontSize: "13px",
                textDecoration: "none",
              }}
            >
              Compare Locations <ChevronRight size={14} />
            </Link>
          }
        >
          <p style={{ margin: 0, fontSize: "14px", color: "#475569", lineHeight: 1.6 }}>
            Compare multiple zones across accessibility, service gap index, competitor presence, and
            model confidence without arbitrary assumptions.
          </p>
        </Card>
      </div>

      {/* DATA TRANSPARENCY NOTICE */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          padding: "16px 20px",
          backgroundColor: "#f1f5f9",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          alignItems: "center",
        }}
      >
        <Info size={20} color="#475569" style={{ flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
          <strong>Academic Capstone Notice & Data Transparency:</strong> All opportunity scores,
          demographic proxies, and footfall indexes are computed for research and prototyping
          purposes. Data sources include OpenStreetMap (OSM) via Overpass API and municipal census
          reports. No commercial revenue guarantee is implied.
        </p>
      </div>
    </div>
  );
};

export default DashboardPage;
