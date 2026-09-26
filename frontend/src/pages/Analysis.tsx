import { useEffect, useState } from "react";
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

type AnalysisProps = {
  initialBusinessType?: BusinessType;
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

export default function Analysis({
  initialBusinessType = "Education Institute",
  onBack,
}: AnalysisProps) {
  const [businessType, setBusinessType] =
    useState<BusinessType>(
      initialBusinessType
    );

  const [selectedLocation, setSelectedLocation] =
    useState<Location>({
      latitude: puneData.center.latitude,
      longitude: puneData.center.longitude,
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
    setError("");

    try {
      const data = await getBusinessData(
        businessType,
        latitude,
        longitude,
        2000
      );

      setBusinesses(data.businesses);
      setHospitals(data.hospitals);
      setSchools(data.schools);
      setColleges(data.colleges);

      const competitionScore =
        Math.max(
          20,
          Math.min(
            95,
            100 -
              data.businesses.length * 4
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

      setError(
        "Live location data is temporarily unavailable. Showing prototype analysis."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    analyzeLocation(
      puneData.center.latitude,
      puneData.center.longitude
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessType]);

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
                Pune
              </strong>

              <small>
                20 km urban radius
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
                value={businesses.length}
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
              puneData.center.latitude,
              puneData.center.longitude,
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
                puneData.center.latitude,
                puneData.center.longitude,
              ]}
              radius={
                puneData.studyRadiusKm *
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

            <button>
              ↗
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
                  {businesses.length}
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