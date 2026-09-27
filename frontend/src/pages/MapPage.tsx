import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Analysis from "./Analysis";
import type { BusinessType } from "../data/puneData";
import { puneData } from "../data/puneData";

const cityCenters: Record<string, { name: string; latitude: number; longitude: number; radiusKm: number }> = {
  pune: { name: "Pune", latitude: puneData.center.latitude, longitude: puneData.center.longitude, radiusKm: 20 },
  mumbai: { name: "Mumbai", latitude: 19.076, longitude: 72.8777, radiusKm: 25 },
  nashik: { name: "Nashik", latitude: 19.9975, longitude: 73.7898, radiusKm: 15 },
};

export const MapPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const businessParam = (searchParams.get("business") || searchParams.get("category") || "Education Institute") as BusinessType;
  const cityKey = (searchParams.get("city") || "pune").toLowerCase();
  const selectedCity = cityCenters[cityKey] ?? cityCenters.pune;
  const areaQuery = searchParams.get("location")?.trim() || "";
  const [initialCenter, setInitialCenter] = useState({ latitude: selectedCity.latitude, longitude: selectedCity.longitude });
  const [isFindingArea, setIsFindingArea] = useState(Boolean(areaQuery));
  const [resolvedArea, setResolvedArea] = useState("");
  const [areaNotFound, setAreaNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cityCenter = { latitude: selectedCity.latitude, longitude: selectedCity.longitude };
    setInitialCenter(cityCenter);
    setResolvedArea("");
    setAreaNotFound(false);

    if (!areaQuery) {
      setIsFindingArea(false);
      return;
    }
    setIsFindingArea(true);
    const search = new URLSearchParams({
      q: `${areaQuery}, ${selectedCity.name}, Maharashtra, India`,
      format: "jsonv2",
      limit: "1",
    });

    fetch(`https://nominatim.openstreetmap.org/search?${search.toString()}`)
      .then((response) => response.ok ? response.json() : [])
      .then((results: { lat: string; lon: string; name?: string }[]) => {
        if (!cancelled && results[0]) {
          setInitialCenter({ latitude: Number(results[0].lat), longitude: Number(results[0].lon) });
          setResolvedArea(results[0].name || areaQuery);
        } else if (!cancelled) {
          setAreaNotFound(true);
        }
      })
      .catch(() => { if (!cancelled) setAreaNotFound(true); })
      .finally(() => { if (!cancelled) setIsFindingArea(false); });

    return () => { cancelled = true; };
  }, [areaQuery, selectedCity.latitude, selectedCity.longitude, selectedCity.name]);

  if (isFindingArea) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#34435c", background: "#f6f8fb" }}>Finding {areaQuery} on the map…</div>;
  }

  return (
    <Analysis
      key={`${cityKey}-${areaQuery}`}
      initialBusinessType={businessParam}
      cityName={selectedCity.name}
      areaName={resolvedArea}
      areaNotFound={areaNotFound}
      initialCenter={initialCenter}
      studyRadiusKm={selectedCity.radiusKm}
      onBack={() => navigate("/dashboard")}
    />
  );
};

export default MapPage;
