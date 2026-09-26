import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BusinessType } from "../data/puneData";

const businessTypes: BusinessType[] = [
  "Education Institute",
  "Pharmacy",
  "Restaurant",
  "Gym",
  "Clothing Store",
  "Cafe",
  "Clinic",
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [businessType, setBusinessType] = useState<BusinessType>("Education Institute");
  const [city, setCity] = useState("Pune");

  const handleAnalyze = () => {
    navigate(`/map?business=${encodeURIComponent(businessType)}&city=${encodeURIComponent(city)}`);
  };

  return (
    <div className="app">
      {/* NAVBAR */}
      <header className="navbar">
        <div className="logo">
          Urban<span>IQ</span>
        </div>

        <nav className="nav-links">
          <a href="#home">Home</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#features">Features</a>
          <a href="#data">Data</a>
          <a href="#about">About</a>
        </nav>

        <div className="nav-actions">
          <button className="login-btn" onClick={() => navigate("/dashboard")}>
            Dashboard
          </button>
          <button className="signup-btn" onClick={() => navigate("/map")}>
            Explore Map
          </button>
        </div>
      </header>

      {/* HERO */}
      <main id="home">
        <section className="hero">
          <div className="hero-left">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              AI-POWERED URBAN INTELLIGENCE
            </div>

            <h1>
              Find the
              <span> Right Location </span>
              for Your Business.
            </h1>

            <p className="hero-description">
              UrbanIQ analyzes population, competition, accessibility,
              demographics and local business ecosystems to help identify
              potential opportunities across urban areas.
            </p>

            {/* ANALYSIS CARD */}
            <div className="analysis-card">
              <div className="input-group">
                <label>BUSINESS TYPE</label>
                <select
                  value={businessType}
                  onChange={(event) => setBusinessType(event.target.value as BusinessType)}
                >
                  {businessTypes.map((business) => (
                    <option key={business} value={business}>
                      {business}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>CITY</label>
                <select value={city} onChange={(event) => setCity(event.target.value)}>
                  <option value="Pune">Pune, Maharashtra</option>
                  <option value="Mumbai">Mumbai, Maharashtra</option>
                  <option value="Nashik">Nashik, Maharashtra</option>
                </select>
              </div>

              <button className="analyze-btn" onClick={handleAnalyze}>
                Analyze Location
                <span>→</span>
              </button>
            </div>

            {/* TRUST */}
            <div className="hero-trust">
              <div className="trust-item">
                <strong>GIS</strong>
                <span>Location Intelligence</span>
              </div>

              <div className="trust-line"></div>

              <div className="trust-item">
                <strong>AI</strong>
                <span>Opportunity Analysis</span>
              </div>

              <div className="trust-line"></div>

              <div className="trust-item">
                <strong>DATA</strong>
                <span>Evidence Based</span>
              </div>
            </div>
          </div>

          {/* HERO MAP PREVIEW */}
          <div className="hero-right">
            <div className="map-container">
              <div className="map-top-label">
                <span className="live-dot"></span>
                PUNE OPPORTUNITY MAP (DEMO)
              </div>

              <div className="map-grid">
                <div className="road road-1"></div>
                <div className="road road-2"></div>
                <div className="road road-3"></div>
                <div className="road road-4"></div>

                <div className="road road-horizontal-1"></div>
                <div className="road road-horizontal-2"></div>
                <div className="road road-horizontal-3"></div>

                <div className="zone zone-green"></div>
                <div className="zone zone-yellow"></div>
                <div className="zone zone-red"></div>

                <div className="location-marker marker-one">
                  <span>92</span>
                </div>

                <div className="location-marker marker-two">
                  <span>84</span>
                </div>

                <div className="location-marker marker-three">
                  <span>68</span>
                </div>
              </div>

              <div className="map-legend">
                <div>
                  <span className="legend-dot green"></span>
                  High Opportunity
                </div>
                <div>
                  <span className="legend-dot yellow"></span>
                  Medium
                </div>
                <div>
                  <span className="legend-dot red"></span>
                  Low
                </div>
              </div>

              <div className="map-score-card">
                <small>PROTOTYPE DEMO</small>
                <strong>92</strong>
                <span>Education Institute</span>
                <p>High student demand proxy</p>
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="stats-section">
          <div className="stat">
            <strong>20 KM</strong>
            <span>Study Radius</span>
          </div>

          <div className="stat-divider"></div>

          <div className="stat">
            <strong>7+</strong>
            <span>Business Categories</span>
          </div>

          <div className="stat-divider"></div>

          <div className="stat">
            <strong>GIS</strong>
            <span>Spatial Intelligence</span>
          </div>

          <div className="stat-divider"></div>

          <div className="stat">
            <strong>AI</strong>
            <span>Opportunity Model</span>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="section">
          <div className="section-heading">
            <span>HOW IT WORKS</span>
            <h2>
              From location data to
              <br />
              business opportunity.
            </h2>
            <p>
              UrbanIQ combines multiple urban indicators to create a structured
              location analysis.
            </p>
          </div>

          <div className="steps">
            <div className="step-card">
              <div className="step-number">01</div>
              <h3>Choose Business</h3>
              <p>Select the business or service you are planning to establish.</p>
            </div>

            <div className="step-card">
              <div className="step-number">02</div>
              <h3>Analyze Location</h3>
              <p>Select an area and analyze its surrounding urban characteristics.</p>
            </div>

            <div className="step-card">
              <div className="step-number">03</div>
              <h3>Process Data</h3>
              <p>UrbanIQ combines demographic, geographic and business data.</p>
            </div>

            <div className="step-card">
              <div className="step-number">04</div>
              <h3>Get Opportunity</h3>
              <p>Receive an opportunity score, map visualization and explanation.</p>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="features-section">
          <div className="section-heading">
            <span>URBANIQ INTELLIGENCE</span>
            <h2>More than just a map.</h2>
            <p>The platform evaluates multiple factors that influence location opportunities.</p>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">◉</div>
              <h3>Population Intelligence</h3>
              <p>Understand population concentration and potential demand around a location.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">◇</div>
              <h3>Competition Analysis</h3>
              <p>Identify nearby businesses and understand the competitive environment.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⌖</div>
              <h3>Accessibility</h3>
              <p>Consider roads, transport and accessibility indicators.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">◎</div>
              <h3>Business Ecosystem</h3>
              <p>Analyze supporting services and surrounding businesses.</p>
            </div>
          </div>
        </section>

        {/* DATA */}
        <section id="data" className="data-section">
          <div>
            <span className="section-label">DATA & INTELLIGENCE</span>
            <h2>
              Decisions backed by
              <br />
              location data.
            </h2>
            <p>
              UrbanIQ combines geographic information, points of interest, demographic
              indicators and business-specific factors to create a structured opportunity
              analysis.
            </p>
          </div>

          <div className="data-list">
            <div>
              <strong>01</strong>
              <span>Geographic Data</span>
            </div>
            <div>
              <strong>02</strong>
              <span>Demographic Data</span>
            </div>
            <div>
              <strong>03</strong>
              <span>Business & POI Data</span>
            </div>
            <div>
              <strong>04</strong>
              <span>Accessibility Indicators</span>
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="about-section">
          <div className="about-box">
            <span className="section-label">ABOUT URBANIQ</span>
            <h2>
              Turning urban data
              <br />
              into opportunity intelligence.
            </h2>
            <p>
              UrbanIQ is designed as a location intelligence platform for entrepreneurs,
              businesses and organizations that need to evaluate where a service or business
              could have an opportunity.
            </p>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer>
        <div className="footer-logo">
          Urban<span>IQ</span>
        </div>
        <p>Urban Opportunity Intelligence Platform</p>
        <div className="footer-links">
          <a href="#home">Privacy</a>
          <a href="#home">Terms</a>
          <a href="#home">Contact</a>
        </div>
        <div className="copyright">© 2026 UrbanIQ</div>
      </footer>
    </div>
  );
}
