import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  Cross,
  FileText,
  MapPin,
  Road,
  Store,
  UsersRound,
} from "lucide-react";
import type { BusinessType } from "../data/puneData";
import "../styles/LandingPage.css";

const businessTypes: BusinessType[] = [
  "Education Institute",
  "Pharmacy",
  "Restaurant",
  "Gym",
  "Clothing Store",
  "Cafe",
  "Clinic",
];

const features = [
  { title: "Demographic Analysis", text: "Population density, age groups, sex ratio and more.", icon: UsersRound, tone: "blue" },
  { title: "Competition Insights", text: "See existing businesses and market saturation.", icon: Store, tone: "green" },
  { title: "Accessibility Analysis", text: "Roads, public transport and connectivity.", icon: MapPin, tone: "red" },
  { title: "Explainable Scoring", text: "Get a weighted opportunity signal with detailed factors.", icon: ChartNoAxesColumnIncreasing, tone: "purple" },
  { title: "Business Recommendations", text: "Clear suggestions with strengths and risks.", icon: FileText, tone: "yellow" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [businessType, setBusinessType] = useState<BusinessType>("Pharmacy");
  const [city, setCity] = useState("Pune");
  const [location, setLocation] = useState("");

  const handleAnalyze = () => {
    const query = new URLSearchParams({ business: businessType, city });
    if (location.trim()) query.set("location", location.trim());
    navigate(`/map?${query.toString()}`);
  };

  return (
    <div className="landing-page" id="home">
      <header className="landing-nav">
        <a className="landing-brand" href="#home" aria-label="UrbanIQ home">
          <span className="brand-pin"><MapPin size={29} fill="currentColor" /></span>
          <span>Urban<span className="brand-iq">IQ</span></span>
        </a>
        <nav className="landing-links" aria-label="Main navigation">
          <a className="is-active" href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#data">City Data</a>
          <a href="#features">Business Types</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="landing-actions">
          <button className="landing-cta" onClick={() => navigate("/map?business=Pharmacy&city=Pune")}>Start Free Analysis <ArrowRight size={16} /></button>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-shade" />
          <div className="hero-layout">
            <div className="hero-copy">
              <div className="hero-kicker"><Activity size={15} /> LOCATION INTELLIGENCE FOR BUSINESS</div>
              <h1>Find the Best Location for Your <span>Business</span></h1>
              <p>Make data-driven decisions with AI-powered insights on population, competition, accessibility and more.</p>
              <div className="location-form">
                <div className="location-fields">
                  <label className="location-field">
                    <span>Select City</span>
                    <span className="select-wrap"><select value={city} onChange={(event) => setCity(event.target.value)}><option value="Pune">Pune, Maharashtra</option><option value="Mumbai">Mumbai, Maharashtra</option><option value="Nashik">Nashik, Maharashtra</option></select><ChevronDown size={16} /></span>
                  </label>
                  <label className="location-field">
                    <span>Select Business Type</span>
                    <span className="select-wrap"><select value={businessType} onChange={(event) => setBusinessType(event.target.value as BusinessType)}>{businessTypes.map((business) => <option key={business} value={business}>{business}</option>)}</select><ChevronDown size={16} /></span>
                  </label>
                  <label className="location-field location-search">
                    <span>Choose Location</span>
                    <span className="search-wrap"><MapPin size={19} /><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Search area or click on map" /></span>
                  </label>
                </div>
                <button className="analyze-location" onClick={handleAnalyze}><span>✦</span> Analyze Location <ArrowRight size={18} /></button>
              </div>
            </div>

            <div className="hero-map-art" aria-label="Illustration of location opportunity data">
              <div className="heatmap-outline">
                <div className="heatmap-glow glow-one" /><div className="heatmap-glow glow-two" /><div className="heatmap-glow glow-three" />
                <div className="heatmap-grid" />
                <div className="map-pin main-pin"><MapPin size={31} fill="currentColor" /></div>
                <span className="map-pin mini-pin pin-a"><MapPin size={16} fill="currentColor" /></span>
                <span className="map-pin mini-pin pin-b"><MapPin size={14} fill="currentColor" /></span>
                <span className="map-pin mini-pin pin-c"><MapPin size={14} fill="currentColor" /></span>
              </div>
              <div className="insight-chip chip-pop"><UsersRound /><span><strong>High Population</strong>Density</span></div>
              <div className="insight-chip chip-store"><Store /><span><strong>7 Pharmacies</strong>Nearby</span></div>
              <div className="insight-chip chip-road"><Road /><span><strong>Good</strong>Accessibility</span></div>
              <div className="insight-chip chip-hospital"><Cross /><span><strong>3 Hospitals</strong>Nearby</span></div>
            </div>
          </div>

          <div className="landing-stats" id="data">
            <div className="landing-stat"><UsersRound className="stat-blue" /><div><strong>35.56 Lakh</strong><span>Pune Population (PMC 2021–22)</span></div></div>
            <div className="landing-stat"><ChartNoAxesColumnIncreasing className="stat-green" /><div><strong>7 Types</strong><span>Businesses to Analyze</span></div></div>
            <div className="landing-stat"><Store className="stat-orange" /><div><strong>3 Cities</strong><span>Pune, Mumbai &amp; Nashik</span></div></div>
            <div className="landing-stat"><Cross className="stat-blue" /><div><strong>2 km</strong><span>Competitor Search Radius</span></div></div>
            <div className="landing-stat"><Road className="stat-slate" /><div><strong>OpenStreetMap</strong><span>Nearby Places Data</span></div></div>
          </div>
        </section>

        <section className="landing-features" id="features">
          <div className="landing-section-title"><h2>Why Choose <span>UrbanIQ?</span></h2><p>Comprehensive location analysis to help your business succeed.</p></div>
          <div className="landing-feature-grid">{features.map(({ title, text, icon: Icon, tone }) => <article className="landing-feature-card" key={title}><div className={`feature-icon ${tone}`}><Icon size={28} /></div><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>
        <section className="landing-about" id="about"><span id="how-it-works" className="landing-anchor" /><span className="about-eyebrow">BUILT FOR BETTER BUSINESS DECISIONS</span><h2>Know the neighborhood before you invest.</h2><p>UrbanIQ brings city data, nearby businesses and accessibility signals together to help you compare locations with confidence.</p><a href="#features">Explore business insights <ArrowRight size={16} /></a></section>
      </main>
      <footer className="landing-footer" id="contact"><a className="landing-brand" href="#home"><span className="brand-pin"><MapPin size={24} fill="currentColor" /></span><span>Urban<span className="brand-iq">IQ</span></span></a><span>Location intelligence for growing businesses</span><span>© 2026 UrbanIQ</span></footer>
    </div>
  );
}
