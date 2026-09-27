import { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMapEvents,
} from "react-leaflet";

import { BUSINESS_TYPES, puneData } from "../data/puneData";
import type { BusinessType } from "../data/puneData";

import { getBusinessData } from "../services/overpass";
import type { Place } from "../services/overpass";

import {
  calculateOpportunityScore,
} from "../utils/opportunityScore";
import { downloadAnalysisReport, saveAnalysisReport, type AnalysisReport } from "../utils/analysisReport";

type AnalysisProps = {
  initialBusinessType?: BusinessType;
  cityName?: string;
  areaName?: string;
  areaNotFound?: boolean;
  initialCenter?: Location;
  studyRadiusKm?: number;
  onBack: () => void;
};

type Location = {
  latitude: number;
  longitude: number;
};

function MapClickHandler({
  onLocationSelect,
}: {
  onLocationSelect: (
    latitude: number,
    longitude: number
  ) => void;
}) {
  useMapEvents({
    click(event) {
      onLocationSelect(
        event.latlng.lat,
        event.latlng.lng
      );
    },
  });

  return null;
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: string;
}) {
  return (
    <div className="ui-stat-card">
      <div className="ui-stat-icon">
        {icon}
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function distanceInMeters(from: Location, to: Location) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);
  const latDistance = lat2 - lat1;
  const lonDistance = radians(to.longitude - from.longitude);
  const haversine = Math.sin(latDistance / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDistance / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

export default function Analysis({
  initialBusinessType = "Education Institute",
  cityName = "Pune",
  areaName = "",
  areaNotFound = false,
  initialCenter = puneData.center,
  studyRadiusKm = puneData.studyRadiusKm,
  onBack,
}: AnalysisProps) {
  const [businessType, setBusinessType] =
    useState<BusinessType>(
      initialBusinessType
    );

  const [selectedLocation, setSelectedLocation] =
    useState<Location>({
      latitude: initialCenter.latitude,
      longitude: initialCenter.longitude,
    });

  const [businesses, setBusinesses] =
    useState<Place[]>([]);

  const [hospitals, setHospitals] =
    useState<Place[]>([]);

  const [schools, setSchools] =
    useState<Place[]>([]);

  const [colleges, setColleges] =
    useState<Place[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [hasCompletedAnalysis, setHasCompletedAnalysis] =
    useState(false);

  const [liveDataAvailable, setLiveDataAvailable] = useState(false);

  const [error, setError] =
    useState("");

  const [populationDemand] =
    useState(82);

  const [studentDemand, setStudentDemand] =
    useState(88);

  const [accessibility] =
    useState(84);

  const [competition, setCompetition] =
    useState(65);

  const [
    supportingEcosystem,
    setSupportingEcosystem,
  ] = useState(80);

  async function analyzeLocation(
    latitude: number,
    longitude: number
  ) {
    setSelectedLocation({
      latitude,
      longitude,
    });

    setLoading(true);
    setHasCompletedAnalysis(false);
    setLiveDataAvailable(false);
    setError("");
    setBusinesses([]);
    setHospitals([]);
    setSchools([]);
    setColleges([]);
    setCompetition(65);
    setSupportingEcosystem(80);
    setStudentDemand(88);

    try {
      const data = await getBusinessData(
        businessType,
        latitude,
        longitude,
        2000
      );

      setLiveDataAvailable(true);

      setBusinesses(data.businesses);
      setHospitals(data.hospitals);
      setSchools(data.schools);
      setColleges(data.colleges);

      const competitorCount = data.businesses.length + (
        businessType === "Education Institute" ? data.schools.length + data.colleges.length : 0
      );
      const competitionScore =
        Math.max(
          20,
          Math.min(
            95,
            100 - competitorCount * 4
          )
        );

      setCompetition(
        competitionScore
      );

      if (
        businessType ===
        "Education Institute"
      ) {
        const ecosystemScore =
          Math.min(
            100,
            40 +
              data.schools.length * 4 +
              data.colleges.length * 7
          );

        setSupportingEcosystem(
          ecosystemScore
        );

        const demandScore =
          Math.min(
            95,
            60 +
              data.schools.length * 3 +
              data.colleges.length * 5
          );

        setStudentDemand(
          demandScore
        );
      }

      if (
        businessType === "Pharmacy"
      ) {
        const healthcareScore =
          Math.min(
            100,
            50 +
              data.hospitals.length * 8
          );

        setSupportingEcosystem(
          healthcareScore
        );
      }
    } catch (err) {
      console.error(err);
      setLiveDataAvailable(false);

      setError(
        "Live location data is temporarily unavailable. Showing prototype analysis."
      );
    } finally {
      setLoading(false);
      setHasCompletedAnalysis(true);
    }
  }

  useEffect(() => {
    analyzeLocation(
      initialCenter.latitude,
      initialCenter.longitude
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessType, initialCenter.latitude, initialCenter.longitude]);

  const result =
    calculateOpportunityScore(
      businessType,
      {
        populationDemand,
        competition,
        accessibility,
        supportingEcosystem,
        studentDemand,
      }
    );

  const competitorPlaces = businessType === "Education Institute"
    ? [...businesses, ...schools, ...colleges]
    : businesses;
  const report: AnalysisReport = {
    generatedAt: new Date().toISOString(),
    city: cityName,
    areaName,
    businessType,
    latitude: selectedLocation.latitude,
    longitude: selectedLocation.longitude,
    radiusMeters: 2000,
    dataStatus: liveDataAvailable ? "live" : "unavailable",
    score: result.score,
    level: result.level,
    factors: result.factors,
    explanations: result.explanation,
    competitors: competitorPlaces.map((place) => ({
      name: place.name,
      category: place.category || businessType,
      latitude: place.lat,
      longitude: place.lon,
    })),
  };

  useEffect(() => {
    if (!hasCompletedAnalysis) return;
    saveAnalysisReport(report);
    // Save the latest completed POI list and current score for the Reports page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businesses, businessType, cityName, hasCompletedAnalysis, selectedLocation, result.score, result.level, competition, supportingEcosystem, studentDemand, liveDataAvailable, areaName]);

  const handleDownloadReport = () => downloadAnalysisReport(report);

  return (
    <div className="urban-analysis">

      {/* =====================================
          TOP NAVIGATION
      ===================================== */}

      <header className="urban-topbar">

        <div className="urban-brand">

          <button
            className="urban-back"
            onClick={onBack}
          >
            ←
          </button>

          <div>
            <div className="urban-logo">
              Urban<span>IQ</span>
            </div>

            <div className="urban-subtitle">
              Location Intelligence
            </div>
          </div>

        </div>


        <div className="urban-top-center">

          <div className="urban-location-status">
            <span></span>
            LIVE ANALYSIS
          </div>

          <div className="urban-location-name">
            Pune, Maharashtra
          </div>

        </div>


        <div className="urban-top-actions">

          <button className="urban-icon-button">
            ?
          </button>

          <button className="urban-profile">
            B
          </button>

        </div>

      </header>


      {/* =====================================
          MAIN LAYOUT
      ===================================== */}

      <main className="urban-layout">


        {/* =====================================
            LEFT SIDEBAR
        ===================================== */}

        <aside className="urban-sidebar">

          <div className="sidebar-heading">

            <span>
              LOCATION ANALYSIS
            </span>

            <h1>
              Find your
              <br />
              opportunity.
            </h1>

            <p>
              Select a business and
              explore its potential
              across Pune.
            </p>

          </div>


          {/* BUSINESS SELECTOR */}

          <div className="urban-form">

            <label>
              BUSINESS TYPE
            </label>

            <select
              value={businessType}
              onChange={(event) =>
                setBusinessType(
                  event.target
                    .value as BusinessType
                )
              }
            >
              {BUSINESS_TYPES.map(
                (business) => (
                  <option
                    key={business}
                    value={business}
                  >
                    {business}
                  </option>
                )
              )}
            </select>

          </div>


          {/* LOCATION */}

          <div className="urban-location-card">

            <div className="urban-location-pin">
              ⌖
            </div>

            <div>

              <span>
                STUDY AREA
              </span>

              <strong>
                {cityName}{areaName ? ` · ${areaName}` : ""}
              </strong>

              <small>
                20 km study radius
              </small>

            </div>

          </div>


          {/* SCORE */}

          <div className="urban-score-card">

            <div className="score-header">

              <span>
                OPPORTUNITY SCORE
              </span>

              <span className="score-live">
                LIVE
              </span>

            </div>

            <div className="score-main">

              <strong>
                {result.score}
              </strong>

              <span>
                /100
              </span>

            </div>

            <div className="score-level">
              <span></span>
              {result.level} opportunity
            </div>

          </div>


          {/* QUICK STATS */}

          <div className="urban-sidebar-section">

            <div className="urban-section-title">
              LOCAL INTELLIGENCE
            </div>

            <div className="urban-mini-stats">

              <StatCard
                label="Businesses"
                value={competitorPlaces.length}
                icon="⌂"
              />

              <StatCard
                label="Schools"
                value={schools.length}
                icon="▣"
              />

              <StatCard
                label="Colleges"
                value={colleges.length}
                icon="◆"
              />

              <StatCard
                label="Hospitals"
                value={hospitals.length}
                icon="+"
              />

            </div>

          </div>


          {/* INSTRUCTION */}

          <div className="urban-sidebar-tip">

            <div>
              <span>●</span>
              MAP INTERACTION
            </div>

            <p>
              Click anywhere on the map
              to analyze that location.
            </p>

          </div>

        </aside>


        {/* =====================================
            MAP AREA
        ===================================== */}

        <section className="urban-map-area">

          <MapContainer
            center={[
              initialCenter.latitude,
              initialCenter.longitude,
            ]}
            zoom={11}
            zoomControl={false}
            style={{
              height: "100%",
              width: "100%",
            }}
          >

            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />


            {/* 20 KM CITY STUDY AREA */}

            <Circle
              center={[
                initialCenter.latitude,
                initialCenter.longitude,
              ]}
              radius={
                studyRadiusKm *
                1000
              }
              pathOptions={{
                color: "#087f79",
                fillColor: "#087f79",
                fillOpacity: 0.035,
                weight: 2,
              }}
            />


            {/* 2 KM ANALYSIS AREA */}

            <Circle
              center={[
                selectedLocation.latitude,
                selectedLocation.longitude,
              ]}
              radius={2000}
              pathOptions={{
                color: "#0b7f78",
                fillColor: "#0b7f78",
                fillOpacity: 0.08,
                weight: 2,
              }}
            />


            {/* SELECTED LOCATION */}

            <Marker
              position={[
                selectedLocation.latitude,
                selectedLocation.longitude,
              ]}
            >

              <Popup>

                <strong>
                  UrbanIQ Selected Location
                </strong>

                <br />

                {businessType}

                <br />

                Score:{" "}
                {result.score}/100

              </Popup>

            </Marker>


            {/* BUSINESSES */}

            {businesses.map(
              (place) => (
                <Marker
                  key={`business-${place.id}`}
                  position={[
                    place.lat,
                    place.lon,
                  ]}
                >

                  <Popup>

                    <strong>
                      {place.name}
                    </strong>

                    <br />

                    {businessType}

                  </Popup>

                </Marker>
              )
            )}


            {/* HOSPITALS */}

            {hospitals.map(
              (place) => (
                <Marker
                  key={`hospital-${place.id}`}
                  position={[
                    place.lat,
                    place.lon,
                  ]}
                >

                  <Popup>

                    <strong>
                      {place.name}
                    </strong>

                    <br />

                    Hospital

                  </Popup>

                </Marker>
              )
            )}


            {/* SCHOOLS */}

            {schools.map(
              (place) => (
                <Marker
                  key={`school-${place.id}`}
                  position={[
                    place.lat,
                    place.lon,
                  ]}
                >

                  <Popup>

                    <strong>
                      {place.name}
                    </strong>

                    <br />

                    School

                  </Popup>

                </Marker>
              )
            )}


            {/* COLLEGES */}

            {colleges.map(
              (place) => (
                <Marker
                  key={`college-${place.id}`}
                  position={[
                    place.lat,
                    place.lon,
                  ]}
                >

                  <Popup>

                    <strong>
                      {place.name}
                    </strong>

                    <br />

                    College

                  </Popup>

                </Marker>
              )
            )}


            <MapClickHandler
              onLocationSelect={
                analyzeLocation
              }
            />

          </MapContainer>


          {/* =====================================
              MAP OVERLAY - SEARCH
          ===================================== */}

          <div className="urban-map-search">

            <div className="urban-search-icon">
              ⌕
            </div>

            <div>
              <span>
                SELECTED AREA
              </span>

              <strong>
                {selectedLocation.latitude.toFixed(
                  4
                )}
                {" , "}
                {selectedLocation.longitude.toFixed(
                  4
                )}
              </strong>
            </div>

          </div>


          {/* =====================================
              MAP OVERLAY - SCORE
          ===================================== */}

          <div className="urban-floating-score">

            <div className="floating-score-top">

              <span>
                {businessType}
              </span>

              <div className="floating-status">
                ● ANALYZED
              </div>

            </div>

            <div className="floating-score-number">
              {result.score}
              <small>/100</small>
            </div>

            <div className="floating-score-label">
              {result.level} Opportunity
            </div>

            <div className="floating-score-line">
              <div
                style={{
                  width: `${result.score}%`,
                }}
              ></div>
            </div>

          </div>


          {/* =====================================
              MAP CONTROLS
          ===================================== */}

          <div className="urban-map-controls">

            <button>
              +
            </button>

            <button>
              −
            </button>

          </div>


          {/* =====================================
              MAP LEGEND
          ===================================== */}

          <div className="urban-map-legend">

            <div className="legend-title">
              MAP LEGEND
            </div>

            <div>
              <span className="legend-selected"></span>
              Selected area
            </div>

            <div>
              <span className="legend-study"></span>
              20 km study radius
            </div>

            <div>
              <span className="legend-business"></span>
              Nearby locations
            </div>

          </div>


          {/* LOADING */}

          {loading && (
            <div className="urban-map-loading">

              <div className="urban-spinner"></div>

              <div>
                <strong>
                  Analyzing location
                </strong>

                <span>
                  Collecting urban data...
                </span>
              </div>

            </div>
          )}

        </section>


        {/* =====================================
            RIGHT INTELLIGENCE PANEL
        ===================================== */}

        <aside className="urban-intelligence">

          <div className="intelligence-header">

            <div>

              <span>
                URBANIQ INTELLIGENCE
              </span>

              <h2>
                Location Report
              </h2>

            </div>

            <button onClick={handleDownloadReport} disabled={!hasCompletedAnalysis || loading} aria-label="Download analysis report" title="Download report">
              <Download size={17} />
            </button>

          </div>


          {error && (
            <div className="urban-warning">
              <strong>
                Prototype data
              </strong>

              <p>
                {error}
              </p>
            </div>
          )}

          {areaNotFound && !error && (
            <div className="urban-warning">
              <strong>Area not found</strong>
              <p>Showing the {cityName} city center. Click your intended point on the map to run a precise local analysis.</p>
            </div>
          )}


          {/* FACTORS */}

          <div className="intelligence-section">

            <div className="intelligence-section-heading">

              <span>
                OPPORTUNITY FACTORS
              </span>

              <small>
                WEIGHTED
              </small>

            </div>


            <div className="urban-factors">

              {result.factors.map(
                (factor) => (
                  <div
                    className="urban-factor"
                    key={factor.name}
                  >

                    <div className="factor-info">

                      <span>
                        {factor.name}
                      </span>

                      <strong>
                        {factor.value}
                      </strong>

                    </div>

                    <div className="urban-factor-bar">

                      <div
                        style={{
                          width: `${factor.value}%`,
                        }}
                      ></div>

                    </div>

                    <small>
                      Weight {factor.weight}%
                    </small>

                  </div>
                )
              )}

            </div>

          </div>


          {/* WHY SCORE */}

          <div className="intelligence-section">

            <div className="intelligence-section-heading">

              <span>
                WHY THIS LOCATION
              </span>

            </div>


            <div className="urban-reasons">

              {result.explanation.map(
                (reason) => (
                  <div
                    className="urban-reason"
                    key={reason}
                  >

                    <div className="reason-check">
                      ✓
                    </div>

                    <span>
                      {reason}
                    </span>

                  </div>
                )
              )}

            </div>

          </div>


          {/* LOCATION DATA */}

          <div className="intelligence-section">

            <div className="intelligence-section-heading">

              <span>
                LOCATION DATA
              </span>

              <small>
                2 KM RADIUS
              </small>

            </div>


            <div className="urban-data-table">

              <div>
                <span>
                  Nearby businesses
                </span>

                <strong>
                  {competitorPlaces.length}
                </strong>
              </div>

              <div>
                <span>
                  Schools
                </span>

                <strong>
                  {schools.length}
                </strong>
              </div>

              <div>
                <span>
                  Colleges
                </span>

                <strong>
                  {colleges.length}
                </strong>
              </div>

              <div>
                <span>
                  Hospitals
                </span>

                <strong>
                  {hospitals.length}
                </strong>
              </div>

            </div>

          </div>


          {/* NEARBY COMPETITORS */}

          <div className="intelligence-section">
            <div className="intelligence-section-heading">
              <span>NEARBY COMPETITORS</span>
              <small>{competitorPlaces.length} WITHIN 2 KM</small>
            </div>
            {competitorPlaces.length > 0 ? (
              <div className="urban-competitor-list">
                {competitorPlaces.slice(0, 8).map((place) => (
                  <a
                    className="urban-competitor-row"
                    href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=17/${place.lat}/${place.lon}`}
                    target="_blank"
                    rel="noreferrer"
                    key={`competitor-${place.id}`}
                  >
                    <span className="competitor-marker"><ExternalLink size={13} /></span>
                    <span className="competitor-name"><strong>{place.name}</strong><small>{place.category || businessType}</small></span>
                    <span className="competitor-distance">{(distanceInMeters(selectedLocation, { latitude: place.lat, longitude: place.lon }) / 1000).toFixed(1)} km</span>
                  </a>
                ))}
                {competitorPlaces.length > 8 && <p className="urban-competitor-more">+ {competitorPlaces.length - 8} more shown on the map</p>}
              </div>
            ) : (
              <p className="urban-competitor-empty">No matching places found in this search area. Try another point on the map.</p>
            )}
          </div>


          {/* RECOMMENDATION STYLE SUMMARY */}

          <div className="urban-summary">

            <div className="summary-icon">
              ✦
            </div>

            <div>

              <strong>
                Opportunity signal
              </strong>

              <p>
                The selected location
                currently shows a{" "}
                <b>
                  {result.level.toLowerCase()}
                </b>{" "}
                opportunity signal for{" "}
                {businessType.toLowerCase()}.
              </p>

            </div>

          </div>


          {/* DATA DISCLAIMER */}

          <div className="urban-data-note">

            <span>
              DATA NOTE
            </span>

            <p>
              Live POI information is
              collected from OpenStreetMap.
              Population and accessibility
              indicators are prototype
              inputs and will be replaced
              with validated datasets in
              the production model.
            </p>

          </div>

        </aside>

      </main>

    </div>
  );
}
