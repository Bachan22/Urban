import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Analysis from "./Analysis";
import type { BusinessType } from "../data/puneData";
import { puneData } from "../data/puneData";
import { geocodeLocation } from "../services/api";

const cityCenters: Record<string, { name: string; latitude: number; longitude: number; radiusKm: number }> = {
  pune: { name: "Pune", latitude: puneData.center.latitude, longitude: puneData.center.longitude, radiusKm: 2 },
  mumbai: { name: "Mumbai", latitude: 19.076, longitude: 72.8777, radiusKm: 2 },
  nashik: { name: "Nashik", latitude: 19.9975, longitude: 73.7898, radiusKm: 2 },
};

export const MapPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const businessParam = (searchParams.get("business") || searchParams.get("category") || "Education Institute") as BusinessType;
  const cityKey = (searchParams.get("city") || "pune").toLowerCase();
  const selectedCity = cityCenters[cityKey] ?? cityCenters.pune;
  const areaQuery = (searchParams.get("location") || searchParams.get("address") || "").trim();
  const radiusParam = Number(searchParams.get("radius")) || 2;
  const latParam = searchParams.get("lat") ? Number(searchParams.get("lat")) : null;
  const lonParam = (searchParams.get("lon") || searchParams.get("lng")) ? Number(searchParams.get("lon") || searchParams.get("lng")) : null;
  const hasExactCoords = latParam !== null && lonParam !== null && !isNaN(latParam) && !isNaN(lonParam);

  const [initialCenter, setInitialCenter] = useState({
    latitude: hasExactCoords ? latParam : selectedCity.latitude,
    longitude: hasExactCoords ? lonParam : selectedCity.longitude,
  });
  const [isFindingArea, setIsFindingArea] = useState(Boolean(areaQuery && !hasExactCoords));
  const [resolvedArea, setResolvedArea] = useState(areaQuery);
  const [resolvedCityName, setResolvedCityName] = useState("");
  const [areaNotFound, setAreaNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (hasExactCoords) {
      setInitialCenter({ latitude: latParam, longitude: lonParam });
      setIsFindingArea(false);
      setResolvedArea(areaQuery);
      return;
    }

    const cityCenter = { latitude: selectedCity.latitude, longitude: selectedCity.longitude };
    setInitialCenter(cityCenter);
    setResolvedArea("");
    setAreaNotFound(false);

    if (!areaQuery) {
      setIsFindingArea(false);
      return;
    }
    setIsFindingArea(true);

    geocodeLocation(areaQuery, cityKey)
      .then((res) => {
        if (!cancelled && res && res.latitude && res.longitude) {
          setInitialCenter({ latitude: res.latitude, longitude: res.longitude });
          setResolvedArea(res.display_name || areaQuery);
          if (res.is_outside_city && res.locality) {
            setResolvedCityName(res.locality);
          }
        } else if (!cancelled) {
          setAreaNotFound(true);
        }
      })
      .catch((err) => {
        console.warn("Backend geocoding failed, trying fallback:", err);
        if (!cancelled) setAreaNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setIsFindingArea(false);
      });

    return () => { cancelled = true; };
  }, [areaQuery, cityKey, selectedCity.latitude, selectedCity.longitude, selectedCity.name, hasExactCoords, latParam, lonParam]);

  if (isFindingArea) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#34435c", background: "#f6f8fb", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>Locating &ldquo;{areaQuery}&rdquo; in {selectedCity.name}&hellip;</div>
          <div style={{ fontSize: "13px", color: "#64748b" }}>Querying Google Geocoding API with city bias</div>
        </div>
      </div>
    );
  }

  return (
    <Analysis
      key={`${cityKey}-${areaQuery}-${initialCenter.latitude}-${initialCenter.longitude}`}
      initialBusinessType={businessParam}
      cityName={resolvedCityName || selectedCity.name}
      areaName={resolvedArea}
      areaNotFound={areaNotFound}
      initialCenter={initialCenter}
      studyRadiusKm={radiusParam}
      onBack={() => navigate("/dashboard")}
    />
  );
};

export default MapPage;
