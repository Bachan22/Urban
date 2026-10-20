/**
 * GoogleMapView — Drop-in Google Maps component for UrbanIQ Analysis page.
 * Loads the Google Maps JavaScript API dynamically from a single <script> tag.
 * Renders: location marker, radius circle, competitor/POI markers with popups.
 *
 * Props mirror what the old Leaflet map used:
 *   center, selectedLocation, radiusKm, businesses, hospitals, schools, colleges,
 *   transitStops, layers, businessType, score, onLocationSelect
 */

import { useEffect, useRef, useCallback, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────
interface Location {
  latitude: number;
  longitude: number;
}

export interface Place {
  id: number;
  lat: number;
  lon: number;
  name: string;
  category?: string;
  address?: string;
  distance_meters?: number;
  source?: string;
}

import type { CandidateArea } from "../../services/api";

interface Layers {
  competitors: boolean;
  schools: boolean;
  colleges: boolean;
  hospitals: boolean;
  transit: boolean;
  recommendedAreas?: boolean;
}

interface GoogleMapViewProps {
  initialCenter: Location;
  selectedLocation: Location;
  radiusKm: number;
  businesses: Place[];
  hospitals: Place[];
  schools: Place[];
  colleges: Place[];
  transitStops: Place[];
  layers: Layers;
  businessType: string;
  score: number;
  scoreLevel: string;
  recommendedAreas?: CandidateArea[];
  onLocationSelect: (lat: number, lng: number, landmark?: string) => void;
}

// ── Global API loader (singleton) ──────────────────────────────────────
let _apiLoadPromise: Promise<void> | null = null;

function loadGoogleMapsApi(apiKey: string): Promise<void> {
  if (_apiLoadPromise) return _apiLoadPromise;

  _apiLoadPromise = new Promise<void>((resolve, reject) => {
    if (typeof google !== "undefined" && google.maps) {
      resolve();
      return;
    }

    // Capture auth / API target failures from Google Maps script
    (window as any).gm_authFailure = () => {
      console.warn("Google Maps JavaScript API authentication error: Key restrictions or Maps JavaScript API not enabled.");
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      _apiLoadPromise = null;
      reject(new Error("Failed to load Google Maps JavaScript API"));
    };
    document.head.appendChild(script);
  });

  return _apiLoadPromise;
}

// ── Marker colors ──────────────────────────────────────────────────────
const MARKER_COLORS: Record<string, string> = {
  competitor: "#e11d48",
  hospital: "#0284c7",
  school: "#16a34a",
  college: "#9333ea",
  transit: "#ea580c",
  selected: "#0b7f78",
};

function createMarkerIcon(color: string, size = 12, isCompetitor = false): google.maps.Icon | google.maps.Symbol {
  if (isCompetitor) {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2.5,
      scale: 10,
    };
  }
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    scale: size / 2 + 2,
  };
}

// ── Component ──────────────────────────────────────────────────────────
export default function GoogleMapView({
  initialCenter,
  selectedLocation,
  radiusKm,
  businesses,
  hospitals,
  schools,
  colleges,
  transitStops,
  layers,
  businessType,
  score,
  scoreLevel,
  recommendedAreas = [],
  onLocationSelect,
}: GoogleMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const selectedMarkerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const poiMarkersRef = useRef<google.maps.Marker[]>([]);
  const candidateOverlaysRef = useRef<{ markers: google.maps.Marker[]; circles: google.maps.Circle[] }>({
    markers: [],
    circles: [],
  });
  const [apiLoaded, setApiLoaded] = useState(false);
  const [apiError, setApiError] = useState<string>("");

  const clearCandidateOverlays = useCallback(() => {
    for (const m of candidateOverlaysRef.current.markers) {
      m.setMap(null);
    }
    for (const c of candidateOverlaysRef.current.circles) {
      c.setMap(null);
    }
    candidateOverlaysRef.current = { markers: [], circles: [] };
  }, []);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  // ── Load Google Maps API ────────────────────────────────────────────
  useEffect(() => {
    if (!apiKey) {
      setApiError("VITE_GOOGLE_MAPS_API_KEY is not configured. Add it to frontend/.env and restart the dev server.");
      return;
    }

    loadGoogleMapsApi(apiKey)
      .then(() => setApiLoaded(true))
      .catch((err) => setApiError(err.message));
  }, [apiKey]);

  // ── Initialize map ──────────────────────────────────────────────────
  useEffect(() => {
    if (!apiLoaded || !mapContainerRef.current || mapRef.current) return;

    const map = new google.maps.Map(mapContainerRef.current, {
      center: { lat: initialCenter.latitude, lng: initialCenter.longitude },
      zoom: 13,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
        { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
        { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
      ],
    });

    mapRef.current = map;
    infoWindowRef.current = new google.maps.InfoWindow();

    // Click handler for location selection
    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        onLocationSelect(e.latLng.lat(), e.latLng.lng());
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiLoaded]);

  // ── Update selected marker + circle ─────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !apiLoaded) return;

    const latLng = { lat: selectedLocation.latitude, lng: selectedLocation.longitude };

    // Pan to selected location
    mapRef.current.panTo(latLng);

    // Adjust zoom based on radius
    if (radiusKm <= 1) mapRef.current.setZoom(15);
    else if (radiusKm <= 2) mapRef.current.setZoom(14);
    else mapRef.current.setZoom(12);

    // Update or create selected marker
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.setPosition(latLng);
    } else {
      selectedMarkerRef.current = new google.maps.Marker({
        position: latLng,
        map: mapRef.current,
        zIndex: 1000,
        title: "Selected Location",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: MARKER_COLORS.selected,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
          scale: 10,
        },
      });

      selectedMarkerRef.current.addListener("click", () => {
        if (infoWindowRef.current && mapRef.current) {
          infoWindowRef.current.setContent(`
            <div style="font-family: system-ui, sans-serif; padding: 4px;">
              <strong>UrbanIQ Selected Location</strong><br/>
              ${businessType}<br/>
              Score: ${score}/100 ${scoreLevel ? `(${scoreLevel})` : ""}
            </div>
          `);
          infoWindowRef.current.open(mapRef.current, selectedMarkerRef.current);
        }
      });
    }

    // Update or create circle
    if (circleRef.current) {
      circleRef.current.setCenter(latLng);
      circleRef.current.setRadius(radiusKm * 1000);
    } else {
      circleRef.current = new google.maps.Circle({
        center: latLng,
        radius: radiusKm * 1000,
        map: mapRef.current,
        strokeColor: "#0b7f78",
        strokeWeight: 2,
        fillColor: "#0b7f78",
        fillOpacity: 0.08,
        clickable: false,
      });
    }
  }, [apiLoaded, selectedLocation, radiusKm, businessType, score]);

  // ── Clear all POI markers ───────────────────────────────────────────
  const clearPoiMarkers = useCallback(() => {
    for (const m of poiMarkersRef.current) {
      m.setMap(null);
    }
    poiMarkersRef.current = [];
  }, []);

  // ── Render POI markers ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !apiLoaded) return;
    clearPoiMarkers();

    const addMarkers = (
      places: Place[],
      color: string,
      label: string,
      isCompetitor = false
    ) => {
      for (const place of places) {
        const marker = new google.maps.Marker({
          position: { lat: place.lat, lng: place.lon },
          map: mapRef.current!,
          icon: createMarkerIcon(color, isCompetitor ? 20 : 13, isCompetitor),
          zIndex: isCompetitor ? 900 : 500,
          title: place.name,
        });

        marker.addListener("click", () => {
          if (infoWindowRef.current && mapRef.current) {
            const distHtml = place.distance_meters !== undefined
              ? `<div style="font-size:11px;color:#64748b;margin-top:2px">Distance: ${place.distance_meters} m</div>`
              : "";
            const addrHtml = place.address
              ? `<div style="font-size:11px;color:#475569;margin-top:2px">${place.address}</div>`
              : "";

            infoWindowRef.current.setContent(`
              <div style="font-family: system-ui, sans-serif; padding: 4px;">
                <strong>${place.name}</strong><br/>
                <span style="color:${color};font-weight:600">${label}</span>
                ${distHtml}${addrHtml}
              </div>
            `);
            infoWindowRef.current.open(mapRef.current, marker);
          }
        });

        poiMarkersRef.current.push(marker);
      }
    };

    if (layers.competitors) {
      addMarkers(businesses, MARKER_COLORS.competitor, `Competitor (${businessType})`, true);
    }
    if (layers.hospitals) {
      addMarkers(hospitals, MARKER_COLORS.hospital, "Hospital / Clinic");
    }
    if (layers.schools) {
      addMarkers(schools, MARKER_COLORS.school, "School");
    }
    if (layers.colleges) {
      addMarkers(colleges, MARKER_COLORS.college, "College / University");
    }
    if (layers.transit) {
      addMarkers(transitStops, MARKER_COLORS.transit, "Transit / Station");
    }
  }, [apiLoaded, businesses, hospitals, schools, colleges, transitStops, layers, businessType, clearPoiMarkers]);

  // ── Render Recommended Candidate Area overlays ─────────────────────
  useEffect(() => {
    if (!mapRef.current || !apiLoaded) return;
    clearCandidateOverlays();

    // Attach global click handlers for candidate actions
    (window as any).__urbaniq_set_center = (lat: number, lng: number, landmark?: string) => {
      onLocationSelect(lat, lng, landmark ? decodeURIComponent(landmark) : undefined);
    };
    (window as any).__urbaniq_compare_candidate = (rank: number) => {
      window.dispatchEvent(new CustomEvent("urbaniq:compare-candidate-event", { detail: { rank } }));
    };

    if (layers.recommendedAreas === false || !recommendedAreas || recommendedAreas.length === 0) {
      return;
    }

    for (const cand of recommendedAreas) {
      const isTop = cand.rank === 1;
      const isQualifying = cand.score >= 70;
      const isModerate = cand.score >= 50 && cand.score < 70;

      // Color scheme: Emerald/Royal Blue for >=70, Amber for 50-69, Muted Slate for <50
      const strokeColor = isQualifying
        ? "#059669"
        : (isModerate ? "#d97706" : "#64748b");
      const fillColor = isQualifying
        ? "#10b981"
        : (isModerate ? "#f59e0b" : "#94a3b8");
      const fillOpacity = isQualifying ? 0.16 : (isModerate ? 0.12 : 0.07);

      // Draw Candidate Zone Circle (approx 200m catchment)
      const candCircle = new google.maps.Circle({
        center: { lat: cand.latitude, lng: cand.longitude },
        radius: 200,
        map: mapRef.current,
        strokeColor: strokeColor,
        strokeOpacity: isTop ? 1.0 : 0.75,
        strokeWeight: isTop ? 2.5 : 1.5,
        fillColor: fillColor,
        fillOpacity: fillOpacity,
        zIndex: 600 - cand.rank,
      });

      // SVG Badge Icon with Rank
      const svgIcon = {
        url:
          "data:image/svg+xml;charset=UTF-8," +
          encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
              <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
                </filter>
              </defs>
              <path d="M18 1C8.6 1 1 8.6 1 18c0 12.5 17 25 17 25s17-12.5 17-25C35 8.6 27.4 1 18 1z" fill="${strokeColor}" stroke="#ffffff" stroke-width="2" filter="url(#shadow)"/>
              <circle cx="18" cy="17" r="11" fill="#ffffff"/>
              <text x="18" y="21.5" font-size="11" font-weight="800" font-family="system-ui, sans-serif" text-anchor="middle" fill="${strokeColor}">#${cand.rank}</text>
            </svg>
          `),
        scaledSize: new google.maps.Size(36, 44),
        anchor: new google.maps.Point(18, 44),
      };

      const candMarker = new google.maps.Marker({
        position: { lat: cand.latitude, lng: cand.longitude },
        map: mapRef.current,
        icon: svgIcon,
        zIndex: 800 - cand.rank,
        title: `#${cand.rank} ${cand.landmark} (${cand.score}/100)`,
      });

      const openCandInfoWindow = () => {
        if (!infoWindowRef.current || !mapRef.current) return;
        const streetHtml = cand.has_verified_street
          ? `<span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0">Verified Street</span>`
          : `<span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;background:#fefce8;color:#a16207;border:1px solid #fef08a">Street Unverified (Approximate Zone)</span>`;

        const badgeBg = cand.score >= 70 ? "#16a34a" : (cand.score >= 50 ? "#d97706" : "#64748b");
        const whyText = cand.why_here?.[0] || "Active urban catchment";
        const riskText = cand.risks?.[0] || "Ground validation required";

        infoWindowRef.current.setContent(`
          <div style="font-family: system-ui, sans-serif; padding: 6px; max-width: 260px; line-height: 1.4;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px; gap:8px;">
              <span style="font-size:10px; font-weight:700; color:white; background:${badgeBg}; padding:2px 6px; border-radius:10px;">
                #${cand.rank} ${cand.badge}
              </span>
              <strong style="font-size:16px; color:${cand.score >= 70 ? "#15803d" : (cand.score >= 50 ? "#d97706" : "#dc2626")}">
                ${cand.score}<small style="font-size:11px; color:#64748b">/100</small>
              </strong>
            </div>

            <div style="font-weight:700; font-size:13px; color:#0f172a; margin-bottom:2px;">
              ${cand.landmark}
            </div>

            <div style="margin-bottom:6px;">
              ${streetHtml}
            </div>

            <div style="font-size:11px; color:#475569; margin-bottom:6px; background:#f8fafc; padding:6px; border-radius:6px; border:1px solid #e2e8f0;">
              <div>• <strong>Competitors:</strong> ${cand.competitors_500m} within 500m</div>
              <div>• <strong>Key Driver:</strong> ${whyText}</div>
              <div>• <strong>Risk:</strong> ${riskText}</div>
            </div>

            <div style="display:flex; gap:6px; margin-top:6px;">
              <button
                onclick="window.__urbaniq_set_center(${cand.latitude}, ${cand.longitude}, '${encodeURIComponent(cand.landmark)}')"
                style="flex:1; padding:6px 8px; border-radius:6px; border:none; background:#2563eb; color:white; font-size:11px; font-weight:600; cursor:pointer;"
                title="Re-run analysis with this candidate as the new center"
              >
                Set As Centre ➔
              </button>
              <button
                onclick="window.__urbaniq_compare_candidate(${cand.rank})"
                style="padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1; background:#f8fafc; color:#334155; font-size:11px; font-weight:600; cursor:pointer;"
                title="Add candidate zone to comparison engine"
              >
                ⇄ Compare
              </button>
            </div>
          </div>
        `);
        infoWindowRef.current.open(mapRef.current, candMarker);
      };

      candMarker.addListener("click", openCandInfoWindow);
      candCircle.addListener("click", openCandInfoWindow);

      candidateOverlaysRef.current.markers.push(candMarker);
      candidateOverlaysRef.current.circles.push(candCircle);
    }
  }, [apiLoaded, recommendedAreas, layers.recommendedAreas, clearCandidateOverlays, onLocationSelect]);

  // ── Render ──────────────────────────────────────────────────────────
  if (apiError) {
    return (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1a2e",
          color: "#f87171",
          fontFamily: "system-ui, sans-serif",
          flexDirection: "column",
          gap: "12px",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "32px" }}>⚠</div>
        <strong style={{ fontSize: "16px" }}>Google Maps Configuration Error</strong>
        <p style={{ fontSize: "13px", color: "#94a3b8", maxWidth: "400px" }}>
          {apiError}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      style={{ height: "100%", width: "100%", borderRadius: "inherit" }}
    />
  );
}
