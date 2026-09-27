import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Button from "../components/Button";
import { ArrowRight, MapPin, Search, Store, UsersRound } from "lucide-react";
import { BUSINESS_TYPES, type BusinessType } from "../data/puneData";

export const OpportunitiesPage = () => {
  const navigate = useNavigate();
  const [businessType, setBusinessType] = useState<BusinessType>("Pharmacy");
  const [city, setCity] = useState("Pune");

  const startAnalysis = () => {
    const query = new URLSearchParams({ business: businessType, city });
    navigate(`/map?${query.toString()}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1000 }}>
      <header>
        <h1 style={{ margin: 0, color: "#101d3e", fontSize: 27 }}>Check a business opportunity</h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>Choose a business and city to inspect demand signals, nearby competitors and the local service gap.</p>
      </header>

      <Card title="Start a location analysis" subtitle="Set the business and city first. Then choose any point on the map to compare the surrounding area.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 15, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 7, color: "#334155", fontSize: 13, fontWeight: 600 }}>Business type
            <select value={businessType} onChange={(event) => setBusinessType(event.target.value as BusinessType)} style={{ height: 44, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "white", color: "#17223e", font: "inherit" }}>
              {BUSINESS_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 7, color: "#334155", fontSize: 13, fontWeight: 600 }}>City
            <select value={city} onChange={(event) => setCity(event.target.value)} style={{ height: 44, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "white", color: "#17223e", font: "inherit" }}>
              <option>Pune</option><option>Mumbai</option><option>Nashik</option>
            </select>
          </label>
          <Button onClick={startAnalysis} rightIcon={<ArrowRight size={16} />}>Open live analysis</Button>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <Card title="Demand and opportunity signal"><div style={{ display: "flex", gap: 10, color: "#536179", fontSize: 13, lineHeight: 1.55 }}><Search size={18} color="#2868ad" /><span>Review a weighted screening score and see which demand and access factors raise or lower it.</span></div></Card>
        <Card title="Competitor landscape"><div style={{ display: "flex", gap: 10, color: "#536179", fontSize: 13, lineHeight: 1.55 }}><Store size={18} color="#11856e" /><span>Inspect nearby businesses on the map, see their names and distance, and open each place in OpenStreetMap.</span></div></Card>
        <Card title="Local context"><div style={{ display: "flex", gap: 10, color: "#536179", fontSize: 13, lineHeight: 1.55 }}><UsersRound size={18} color="#7952b5" /><span>Compare nearby schools, colleges and hospitals where relevant to the selected business type.</span></div></Card>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: 13, border: "1px solid #f4dfb5", borderRadius: 9, background: "#fffaf0", color: "#79551b", fontSize: 12, lineHeight: 1.55 }}><MapPin size={16} />Scores are early screening estimates. Population and access values use prototype assumptions, and OpenStreetMap listings may be incomplete. Validate local conditions before committing capital.</div>
    </div>
  );
};

export default OpportunitiesPage;
