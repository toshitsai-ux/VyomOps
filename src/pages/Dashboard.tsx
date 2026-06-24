import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { query, collection, orderBy, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import L from "leaflet";
import { 
  Clock, MapPin, Sliders, ChevronRight, Activity, Globe, Send, AlertCircle, 
  Radio, Calendar, ExternalLink, ShieldAlert, CloudSun, RefreshCcw, Orbit, 
  Compass, Layers, Server, AlertTriangle, Eye, Search 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ScrambleText from "@/components/ui/scramble-text";
import { calculateNextOverpass, calculateUpcomingPasses, OverpassDetails } from "../utils/orbital";
import { AdvancedMap } from "../components/ui/interactive-map";

// Interfacing
interface LiveAlertItem {
  id: string;
  type: string;
  source: string;
  title: string;
  description: string;
  link: string;
  severity: "Critical" | "Active" | "Cleared";
  severityScore?: string;
  detectedAt: string;
  lat: number;
  lng: number;
}

interface HistoricalEventItem {
  id: string;
  type: string;
  title: string;
  description: string;
  source: string;
  severity: "Critical" | "Active" | "Cleared";
  date: string;
  lat: number;
  lng: number;
  distanceKm: number;
  reliefWebReport?: {
    title: string;
    link: string;
    image: string | null;
  } | null;
}

interface WeatherData {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    precipitation?: number;
    rain?: number;
    showers?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  // Window dimensions state for perfect responsive adaptations
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [windowHeight, setWindowHeight] = useState(typeof window !== "undefined" ? window.innerHeight : 800);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 768;
  const isStacked = isMobile || (windowWidth < 1024 && windowHeight > windowWidth);

  // Mobile active view toggle: "map" | "feed"
  const [mobileActiveView, setMobileActiveView] = useState<"map" | "feed">("map");

  // Active Tab: "live" | "historical" | "overpass"
  const [activeTab, setActiveTab] = useState<"live" | "historical" | "overpass">("live");

  // Filter for live alerts
  const [filter, setFilter] = useState("ALL");

  // Ref references
  const mapRef = useRef<L.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);
  const countryBordersLayerRef = useRef<L.GeoJSON | null>(null);

  // GeoJSON state for country borders
  const [bordersGeoJson, setBordersGeoJson] = useState<any>(null);

  // 1. LIVE MONITOR STATES
  const [liveAlerts, setLiveAlerts] = useState<LiveAlertItem[]>([]);
  const [liveErrors, setLiveErrors] = useState<string[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState<number>(180); // 3 minutes
  const [selectedLiveAlertId, setSelectedLiveAlertId] = useState<string | null>(null);
  const [impactDataMap, setImpactDataMap] = useState<Record<string, any>>({});
  const [expandedImpactIds, setExpandedImpactIds] = useState<Record<string, boolean>>({});
  const circlesRef = useRef<L.Circle[]>([]);

  // Core weather lookup for selected active/live coordinate perimeters
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // 2. LOOK BACK (HISTORICAL LOOKUP) STATES
  const [searchQuery, setSearchQuery] = useState("");
  const [histEvents, setHistEvents] = useState<HistoricalEventItem[]>([]);
  const [histErrors, setHistErrors] = useState<string[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [resolvedLocation, setResolvedLocation] = useState<{
    lat: number;
    lng: number;
    displayName: string;
  } | null>(null);
  const [selectedHistEventId, setSelectedHistEventId] = useState<string | null>(null);

  // 4. OVERPASS TRACKING STATE
  const [selectedSatelliteId, setSelectedSatelliteId] = useState<number>(40053); // Sentinel-2A = 40053, Landsat 8 = 39084
  const [overpassPredict, setOverpassPredict] = useState<OverpassDetails | null>(null);
  const [upcomingPasses, setUpcomingPasses] = useState<OverpassDetails[]>([]);
  const [passesLoading, setPassesLoading] = useState(false);
  const [passesError, setPassesError] = useState<string | null>(null);
  const [overpassCountdown, setOverpassCountdown] = useState<string>("00:00:00");
  const [lastTrackedCoords, setLastTrackedCoords] = useState<{lat: number, lng: number, name: string}>({
    lat: 20.5937,
    lng: 78.9629,
    name: "Indian Subcontinent Centroid"
  });

  // Fetch Country Borders GeoJSON on load
  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries.geo.json")
      .then(res => res.ok ? res.json() : null)
      .then((data: any) => {
        if (data && Array.isArray(data.features)) {
          // Filter to expanded South Asian and surrounding region coverage area
          const allowedIds = new Set(["IND", "BGD", "BTN", "PAK", "NPL", "MMR", "LKA", "CHN", "AFG", "MDV"]);
          const filtered = {
            type: "FeatureCollection",
            features: data.features.filter((f: any) => allowedIds.has(f.id))
          };
          setBordersGeoJson(filtered);
        }
      })
      .catch(err => console.warn("[VyomOps Map Engine] Border assets fetch failed:", err));
  }, []);

  // Fetch Impact Estimator data for all active live alerts automatically
  useEffect(() => {
    if (liveAlerts.length === 0) return;

    liveAlerts.forEach(async (alert) => {
      if (impactDataMap[alert.id]) return;

      try {
        let magnitude: number | undefined;
        if (alert.severityScore && !isNaN(parseFloat(alert.severityScore))) {
          magnitude = parseFloat(alert.severityScore);
        }

        const params = new URLSearchParams({
          lat: alert.lat.toString(),
          lng: alert.lng.toString(),
          disaster_type: alert.type,
        });
        if (magnitude !== undefined) {
          params.append("magnitude", magnitude.toString());
        }

        const res = await fetch(`/api/impact/${alert.id}?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setImpactDataMap((prev) => ({
            ...prev,
            [alert.id]: data,
          }));
        }
      } catch (err) {
        console.error(`[VyomOps Impact Estimator] Failed fetching impact map for ${alert.id}:`, err);
      }
    });
  }, [liveAlerts]);

  // Update Last Tracked Coordinates whenever map selection shifts
  useEffect(() => {
    if (activeTab === "live" && liveAlerts.length > 0) {
      const activeAlert = liveAlerts.find(a => a.id === selectedLiveAlertId) || liveAlerts[0];
      if (activeAlert) {
        setLastTrackedCoords({
          lat: activeAlert.lat,
          lng: activeAlert.lng,
          name: activeAlert.title
        });
      }
    } else if (activeTab === "historical" && resolvedLocation) {
      setLastTrackedCoords({
        lat: resolvedLocation.lat,
        lng: resolvedLocation.lng,
        name: resolvedLocation.displayName
      });
    }
  }, [selectedLiveAlertId, resolvedLocation, activeTab, liveAlerts]);

  // Log Out Sequence
  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.clear();
      navigate("/login");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  // FETCH WEATHER AT ACTIVE COORDINATES
  const fetchWeather = async (lat: number, lng: number) => {
    setWeatherLoading(true);
    setWeatherData(null);
    try {
      const res = await fetch(`/api/weather-at-coords?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        setWeatherData(data);
      }
    } catch (err) {
      console.warn("Weather extraction failed:", err);
    } finally {
      setWeatherLoading(false);
    }
  };

  // FETCH LIVE ALERTS
  const fetchLiveAlerts = async () => {
    setLiveLoading(true);
    setLiveErrors([]);
    try {
      const res = await fetch("/api/live-alerts");
      if (!res.ok) throw new Error(`Server returned HTTP code ${res.status}`);
      const data = await res.json();
      setLiveAlerts(data.alerts || []);
      setLiveErrors(data.errors || []);
      setLastRefreshedAt(new Date());
      setRefreshCountdown(180); // Reset timer to 3 minutes
      
      if (data.alerts && data.alerts.length > 0) {
        setSelectedLiveAlertId((prev) => prev || data.alerts[0].id);
        fetchWeather(data.alerts[0].lat, data.alerts[0].lng);
      }
    } catch (err: any) {
      console.error("Live monitoring fetch failed:", err);
      setLiveErrors([`Communication fail: ${err?.message || "Internal Bridge Unreachable"}`]);
    } finally {
      setLiveLoading(false);
    }
  };

  // HISTORICAL LOOK BACK ACTION
  const handleHistoricalSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setHistLoading(true);
    setHistErrors([]);
    setHistEvents([]);
    setResolvedLocation(null);
    setSelectedHistEventId(null);

    try {
      const res = await fetch(`/api/historical-lookup?query=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error(`Historical search returned code ${res.status}`);
      const data = await res.json();
      
      if (data.errors && data.errors.length > 0 && (!data.location || data.events.length === 0)) {
        setHistErrors(data.errors);
      } else {
        setResolvedLocation(data.location);
        setHistEvents(data.events || []);
        if (data.errors && data.errors.length > 0) {
          setHistErrors(data.errors);
        }
        if (data.events && data.events.length > 0) {
          setSelectedHistEventId(data.events[0].id);
        }
      }
    } catch (err: any) {
      console.error("Historical trace query failed:", err);
      setHistErrors([`Trace Pipeline down: ${err?.message || "Operation Timeout"}`]);
    } finally {
      setHistLoading(false);
    }
  };

  // Initial and Ticking Automations
  useEffect(() => {
    fetchLiveAlerts();

    // 3-minute auto refresh countdown
    const countdownInterval = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          fetchLiveAlerts();
          return 180;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, []);

  // SATELLITE OVERPASS TRACKING CALCULATIONS & REFRESH STREAM (10s cycle)
  const fetchOverpassData = async () => {
    setPassesLoading(true);
    setPassesError(null);
    try {
      // Calculate soonest pass for active satellite
      const singlePredict = await calculateNextOverpass(lastTrackedCoords.lat, lastTrackedCoords.lng, selectedSatelliteId);
      setOverpassPredict(singlePredict);

      // Fetch upcoming passes (consolidated next 5)
      const list = await calculateUpcomingPasses(lastTrackedCoords.lat, lastTrackedCoords.lng);
      setUpcomingPasses(list);
    } catch (err: any) {
      console.warn("Satellite pass prediction failed:", err);
      setPassesError("Tracking details currently unavailable.");
      setOverpassPredict(null);
      setUpcomingPasses([]);
    } finally {
      setPassesLoading(false);
    }
  };

  useEffect(() => {
    fetchOverpassData();
    const interval = setInterval(fetchOverpassData, 10000); // pull fresh TLE data every 10 seconds
    return () => clearInterval(interval);
  }, [lastTrackedCoords, selectedSatelliteId]);

  // Handle countdown calculation ticking every second for the active overpass
  useEffect(() => {
    if (!overpassPredict) {
      setOverpassCountdown("00:00:00");
      return;
    }

    const nextPassTimeMs = new Date(overpassPredict.nextPassTime).getTime();

    const tick = () => {
      const diffMs = nextPassTimeMs - Date.now();
      if (diffMs <= 0) {
        setOverpassCountdown("OVERPASS ACTIVE");
        return;
      }

      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);

      const hStr = hours.toString().padStart(2, "0");
      const mStr = minutes.toString().padStart(2, "0");
      const sStr = seconds.toString().padStart(2, "0");

      setOverpassCountdown(`${hStr}:${mStr}:${sStr}`);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [overpassPredict]);

  // Leaflet Map Invalidation Hook
  useEffect(() => {
    if (!mapInstance) return;
    setTimeout(() => {
      mapInstance.invalidateSize();
    }, 200);
  }, [mapInstance]);

  // Update Country Borders GeoJSON layers when fetched
  useEffect(() => {
    if (!mapInstance || !bordersGeoJson) return;

    // Create styled GeoJSON boundary layer (light gray, 60% opacity)
    const boundaryLayer = L.geoJSON(bordersGeoJson, {
      style: {
        color: "#6B7280",
        opacity: 0.6,
        weight: 1.2,
        fillOpacity: 0,
        interactive: false
      }
    });

    countryBordersLayerRef.current = boundaryLayer;

    // GeoJSON borders visible at all zoom levels (zoom >= 2)
    const toggleBorders = () => {
      if (!mapInstance) return;
      const zoom = mapInstance.getZoom();
      if (zoom >= 2) {
        if (!mapInstance.hasLayer(boundaryLayer)) {
          boundaryLayer.addTo(mapInstance);
        }
      } else {
        if (mapInstance.hasLayer(boundaryLayer)) {
          boundaryLayer.remove();
        }
      }
    };

    mapInstance.on("zoomend", toggleBorders);
    toggleBorders();

    return () => {
      if (mapInstance) {
        mapInstance.off("zoomend", toggleBorders);
        boundaryLayer.remove();
      }
    };
  }, [bordersGeoJson, mapInstance]);

  // Filter listings based on severity
  const filteredLiveAlerts = liveAlerts.filter((item) => {
    if (filter === "ALL") return true;
    if (filter === "CRITICAL") return item.severity === "Critical";
    if (filter === "ACTIVE") return item.severity === "Active";
    if (filter === "CLEARED") return item.severity === "Cleared";
    return true;
  });

  const currentLiveAlert = liveAlerts.find((a) => a.id === selectedLiveAlertId) || filteredLiveAlerts[0];
  const currentHistEvent = histEvents.find((a) => a.id === selectedHistEventId) || histEvents[0];

  // Map focus flyTo effect
  useEffect(() => {
    if (!mapInstance) return;
    if (activeTab === "live" && selectedLiveAlertId && currentLiveAlert) {
      mapInstance.setView([currentLiveAlert.lat, currentLiveAlert.lng], 13, { animate: true, duration: 1.5 });
    } else if (activeTab === "historical" && selectedHistEventId && currentHistEvent) {
      mapInstance.setView([currentHistEvent.lat, currentHistEvent.lng], 12, { animate: true, duration: 1.5 });
    } else if (activeTab === "overpass") {
      mapInstance.setView([lastTrackedCoords.lat, lastTrackedCoords.lng], 12, { animate: true, duration: 1.5 });
    }
  }, [selectedLiveAlertId, selectedHistEventId, activeTab, mapInstance]);

  // Auto-switch mobile view to map when an alert or event is selected
  useEffect(() => {
    if (selectedLiveAlertId || selectedHistEventId) {
      setMobileActiveView("map");
    }
  }, [selectedLiveAlertId, selectedHistEventId]);

  useEffect(() => {
    if (!mapInstance || !resolvedLocation) return;
    mapInstance.setView([resolvedLocation.lat, resolvedLocation.lng], 11, { animate: true, duration: 1.5 });
  }, [resolvedLocation, mapInstance]);

  // Impose Smooth Fade-In and Fade-Out Marker Diffing
  useEffect(() => {
    if (!mapInstance) return;

    // Wipe old marker variables
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Wipe old circles
    circlesRef.current.forEach((circle) => circle.remove());
    circlesRef.current = [];

    // Clear and remove legacy circles
    if ((mapRef.current as any).circleBoundaryOverlay) {
      (mapRef.current as any).circleBoundaryOverlay.remove();
      delete (mapRef.current as any).circleBoundaryOverlay;
    }

    if (activeTab === "live") {
      filteredLiveAlerts.forEach((item) => {
        const isCritical = item.severity === "Critical";
        const isCleared = item.severity === "Cleared";

        // Build premium, glowing, fully visual custom marker divs
        const mIcon = L.divIcon({
          className: "leaflet-precision-marker",
          html: isCritical
            ? `<div class="pulse-marker-critical"><div class="dot-critical"></div></div>`
            : isCleared
              ? `<div class="marker-cleared-tick">✓</div>`
              : `<div class="pulse-marker-active"><div class="dot-active"></div></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        // Instantiate with initially faded opacity (0)
        const mk = L.marker([item.lat, item.lng], { icon: mIcon, opacity: 0 }).addTo(mapRef.current!);

        // Draw impact radius circle overlay on the map if loaded
        const impact = impactDataMap[item.id];
        if (impact && impact.radius_km) {
          const circle = L.circle([item.lat, item.lng], {
            radius: impact.radius_km * 1000, // convert to meters
            fillColor: "#FF6B35",
            fillOpacity: 0.15,
            color: "#FF6B35",
            weight: 2,
            dashArray: "8, 8"
          }).addTo(mapRef.current!);
          
          circlesRef.current.push(circle);
        }

        // Fade in over 500ms
        let opacity = 0;
        const duration = 500;
        const startTime = performance.now();
        const fadeIn = (now: number) => {
          const progress = Math.min((now - startTime) / duration, 1);
          mk.setOpacity(progress);
          if (progress < 1) {
            requestAnimationFrame(fadeIn);
          }
        };
        requestAnimationFrame(fadeIn);

        // Bind high speed hover description tooltips
        mk.bindTooltip(`
          <div class="px-2 py-1.5 bg-zinc-950/95 border border-zinc-850 rounded-lg font-sans text-[10px] text-zinc-100 uppercase pointer-events-none">
            <strong class="text-white">${item.title}</strong><br/>
            <span class="text-zinc-500 font-mono">Severity: ${item.severity}</span>
          </div>
        `, {
          direction: "top",
          offset: [0, -12],
          className: "custom-map-tooltip",
          opacity: 0.95
        });

        markersRef.current.push(mk);

        mk.on("click", () => {
          setSelectedLiveAlertId(item.id);
          fetchWeather(item.lat, item.lng);
        });
      });

      if (markersRef.current.length > 0) {
        const group = L.featureGroup(markersRef.current);
        mapRef.current.fitBounds(group.getBounds().pad(0.18));
      }

    } else if (activeTab === "historical") {
      if (resolvedLocation) {
        const { lat, lng, displayName } = resolvedLocation;

        const centerIcon = L.divIcon({
          className: "search-center-marker",
          html: "<div class='marker-search-center'></div>",
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const baseMarker = L.marker([lat, lng], { icon: centerIcon, opacity: 1 }).addTo(mapRef.current!);
        baseMarker.bindPopup(`
          <div style="font-family: 'Space Grotesk', sans-serif; padding: 4px;">
            <h5 style="margin:0; font-size:10px; color:#00E5FF; text-transform:uppercase;">Search Center Centroid</h5>
            <p style="margin:2px 0 0 0; font-size:8px; color:#a1a1aa;">${displayName}</p>
          </div>
        `);
        markersRef.current.push(baseMarker);

        // Bind 100km Radial Boundary Ring
        const ring = L.circle([lat, lng], {
          radius: 100000, 
          color: "#00E5FF",
          fillColor: "#00E5FF",
          fillOpacity: 0.05,
          weight: 1,
          dashArray: "4, 6"
        }).addTo(mapRef.current!);
        (mapRef.current as any).circleBoundaryOverlay = ring;

        // Plot nearby look back historical points
        histEvents.forEach((evt) => {
          const isCritical = evt.severity === "Critical";
          const eventIcon = L.divIcon({
            className: "historical-pin-container",
            html: isCritical 
              ? "<div class='pulse-marker-critical'><div class='dot-critical'></div></div>" 
              : "<div class='pulse-marker-active'><div class='dot-active'></div></div>",
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          const itemMarker = L.marker([evt.lat, evt.lng], { icon: eventIcon, opacity: 0 }).addTo(mapRef.current!);
          
          let opacity = 0;
          const startTime = performance.now();
          const fadeIn = (now: number) => {
            const progress = Math.min((now - startTime) / 500, 1);
            itemMarker.setOpacity(progress);
            if (progress < 1) requestAnimationFrame(fadeIn);
          };
          requestAnimationFrame(fadeIn);

          itemMarker.bindTooltip(`
            <div class="px-2 py-1 bg-purple-950/95 border border-purple-800 rounded font-sans text-[10px] text-zinc-100 uppercase">
              <strong>${evt.title}</strong><br/>
              <span class="text-zinc-400 font-mono">Type: ${evt.type}</span>
            </div>
          `, { direction: "top", offset: [0, -12] });

          markersRef.current.push(itemMarker);

          itemMarker.on("click", () => {
            setSelectedHistEventId(evt.id);
          });
        });

        mapRef.current.fitBounds(ring.getBounds().pad(0.12));
      }
    } else if (activeTab === "overpass") {
      // Show single tracking pin overlay on the active target coordinate
      const trackingIcon = L.divIcon({
        className: "sat-tracking-pin",
        html: `<div class="sat-orbit-radar-indicator"></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const trackingMarker = L.marker([lastTrackedCoords.lat, lastTrackedCoords.lng], { icon: trackingIcon }).addTo(mapRef.current!);
      trackingMarker.bindPopup(`
        <div style="font-family: 'Space Grotesk', sans-serif; padding: 4px; min-width: 140px;">
          <h5 style="margin:0; font-size:10px; color:#00E5FF; text-transform:uppercase;">Sat Intercept Base</h5>
          <p style="margin:2px 0 0 0; font-size:8px; color:#d4d4d8;">Locked onto: ${lastTrackedCoords.name}</p>
        </div>
      `);
      markersRef.current.push(trackingMarker);

      // Add radial coverage overlay ring
      const radiusOverlay = L.circle([lastTrackedCoords.lat, lastTrackedCoords.lng], {
        radius: 40000, // 40km satellite scanning swath index
        color: "#00E5FF",
        fillColor: "#00E5FF",
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: "3, 6"
      }).addTo(mapRef.current!);
      (mapRef.current as any).circleBoundaryOverlay = radiusOverlay;

      mapRef.current.setView([lastTrackedCoords.lat, lastTrackedCoords.lng], 11);
    }
  }, [activeTab, liveAlerts, histEvents, resolvedLocation, lastTrackedCoords, impactDataMap, mapInstance]);

  // Simple clean chronological description formatter
  const formattedTimeOffset = (isoString?: string) => {
    if (!isoString) return "Just now";
    try {
      const timespan = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(timespan / 60000);
      const hours = Math.floor(mins / 60);
      
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return "Detected";
    }
  };

  const getResponseScale = (pop: number) => {
    if (pop < 10000) return "Small";
    if (pop < 100000) return "Medium";
    if (pop < 500000) return "Large";
    return "Massive";
  };

  // Duration Elapsed time calculations
  const calculateElapsedString = (dateStr: string) => {
    const elapsedMs = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    
    if (days < 1) return "Active today";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`;
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return `${years} ${years === 1 ? "year" : "years"}${remMonths > 0 ? ` and ${remMonths} ${remMonths === 1 ? "month" : "months"}` : ""} ago`;
  };

  // Coordinate Direction formatting
  const calculateFormattedCoords = (lat: number, lng: number) => {
    return `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(3)}°${lng >= 0 ? "E" : "W"}`;
  };

  return (
    <div className="min-h-screen bg-[#06060c] bg-gradient-to-br from-[#06060c] via-[#040408] to-[#010103] text-zinc-100 font-sans flex flex-col relative overflow-hidden h-screen">
      
      {/* Visual Marker Pulse Keyframes */}
      <style>{`
        .pulse-marker-critical {
          position: relative;
          width: 26px;
          height: 26px;
          background: rgba(255, 59, 48, 0.15);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pulse-marker-critical::after {
          content: '';
          position: absolute;
          width: 26px;
          height: 26px;
          border: 2px solid #FF3B30;
          border-radius: 50%;
          animation: radarPulse 1s infinite linear;
          box-shadow: 0 0 10px rgba(255, 59, 48, 0.6);
        }
        .dot-critical {
          width: 10px;
          height: 10px;
          background: #FF3B30;
          border-radius: 50%;
          box-shadow: 0 0 10px #FF3B30;
        }
        @keyframes radarPulse {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        
        .pulse-marker-active {
          width: 24px;
          height: 24px;
          background: rgba(255, 149, 0, 0.15);
          border: 2px solid #FF9500;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 8px rgba(255, 149, 0, 0.5);
        }
        .dot-active {
          width: 8px;
          height: 8px;
          background: #FF9500;
          border-radius: 50%;
        }
        
        .marker-cleared-tick {
          width: 24px;
          height: 24px;
          background: #34C759;
          border-radius: 50%;
          border: 2px solid #06060c;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 10px rgba(52, 199, 89, 0.5);
          color: white;
          font-weight: bold;
          font-size: 11px;
        }

        .marker-search-center {
          width: 22px;
          height: 22px;
          background: rgba(0, 229, 255, 0.15);
          border: 2px dashed #00E5FF;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: rotateSearchCenter 5s infinite linear;
        }
        .marker-search-center::after {
          content: '';
          width: 8px;
          height: 8px;
          background: #00E5FF;
          border-radius: 50%;
          box-shadow: 0 0 12px #00E5FF;
        }
        @keyframes rotateSearchCenter {
          100% { transform: rotate(360deg); }
        }

        /* High contrast dark base styling overrides: Slate/Charcoal land, Navy-blue water, Bright borders & labels */
        .leaflet-tile-container {
          filter: brightness(1.6) contrast(1.3) saturate(1.4) hue-rotate(190deg);
        }

        .sat-orbit-radar-indicator {
          width: 32px;
          height: 32px;
          background: rgba(0, 229, 255, 0.1);
          border: 1.5px solid #00E5FF;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sat-orbit-radar-indicator::after {
          content: '';
          width: 10px;
          height: 10px;
          background: #00E5FF;
          border-radius: 50%;
          box-shadow: 0 0 15px #00E5FF;
          animation: satBeacon 1.5s infinite ease-in-out;
        }
        @keyframes satBeacon {
          0%, 100% { transform: scale(0.85); box-shadow: 0 0 10px #00E5FF; }
          50% { transform: scale(1.15); box-shadow: 0 0 20px #00E5FF; }
        }
      `}</style>
      
      {/* Background atmosphere light blobs */}
      <div className="absolute top-0 left-1/4 w-[750px] h-[350px] bg-cyan-950/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Strategic Command Header */}
      <nav className="w-full border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-4 py-3 sm:px-6 sm:py-4 flex flex-col gap-3 sm:flex-row justify-between items-start sm:items-center z-40 shrink-0 relative">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 shrink-0">
            <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="font-orbitron font-extrabold tracking-widest text-[#00E5FF] text-sm sm:text-base md:text-lg">
                <ScrambleText text="VYOMOPS COMMAND CENTER" speed={40} />
              </span>
              <span className="text-[8px] sm:text-[9px] font-mono bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded text-cyan-300 uppercase font-semibold">
                MISSION GROUND CTRL
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-zinc-400 font-sans mt-0.5">
              Integrated real-time hazard vectors, historical lookup timelines, and live orbital pass trackers.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Change Detect Ingest Shortcut Button */}
          <Link
            to="/monitor"
            className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 hover:from-cyan-500/20 hover:to-blue-500/20 border border-cyan-500/30 text-[#00E5FF] text-[10px] sm:text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-xl transition-all shadow-[0_0_12px_rgba(0,229,255,0.08)] hover:shadow-[0_0_18px_rgba(0,229,255,0.25)] hover:scale-105 active:scale-95 cursor-pointer min-h-[44px] shrink-0"
          >
            <Orbit className="w-3.5 h-3.5 text-[#00E5FF] animate-spin" style={{ animationDuration: "8s" }} />
            <span>Live Monitor</span>
          </Link>

          <div className="text-right hidden xl:block">
            <div className="text-xs text-zinc-400">
              Profile: <span className="text-[#00E5FF] font-semibold">{user?.displayName || "Senior Flight Director"}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="border border-zinc-800 hover:border-zinc-700 hover:text-red-400 bg-zinc-900/30 text-zinc-400 text-xs px-4 py-2 rounded-xl transition-all cursor-pointer font-bold min-h-[44px]"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Mobile/Stacked Switch Control Panel */}
      {isStacked && (
        <div className="flex bg-zinc-950 border-b border-zinc-900 p-2 gap-2 shrink-0 z-20">
          <button
            onClick={() => setMobileActiveView("map")}
            className={`flex-1 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all min-h-[44px] flex items-center justify-center border ${
              mobileActiveView === "map"
                ? "bg-cyan-500/10 border-cyan-500/30 text-[#00E5FF] font-black"
                : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Compass className="w-4 h-4 mr-1.5 text-[#00E5FF]" />
            Tactical Map
          </button>
          <button
            onClick={() => setMobileActiveView("feed")}
            className={`flex-1 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all min-h-[44px] flex items-center justify-center border ${
              mobileActiveView === "feed"
                ? "bg-cyan-500/10 border-cyan-500/30 text-[#00E5FF] font-black"
                : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Activity className="w-4 h-4 mr-1.5 text-[#00E5FF]" />
            Operations Feed
          </button>
        </div>
      )}

      {/* Command Core Panel */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10">
        
        {/* Left Stage: Map View Container */}
        <div className={`w-full lg:w-[60%] relative border-b lg:border-b-0 lg:border-r border-zinc-900 bg-black ${
          isStacked 
            ? (mobileActiveView === "map" ? "h-full block" : "hidden") 
            : "h-full"
        }`}>
          <AdvancedMap
            onMapInstance={(map) => {
              mapRef.current = map;
              setMapInstance(map);
            }}
            center={[20.5937, 78.9629]}
            zoom={5}
            enableSearch={false}
            enableControls={false}
            className="w-full h-full z-0"
            style={{ height: "100%", width: "100%" }}
          />

          {/* Map Legend Frame */}
          <div className="absolute bottom-3 left-3 sm:bottom-6 sm:left-6 bg-zinc-950/85 backdrop-blur-md border border-zinc-800 p-3 sm:p-4 rounded-xl max-w-[220px] sm:max-w-xs z-30 space-y-2 shadow-[0_12px_24px_rgba(0,0,0,0.85)] pointer-events-none text-[10px] sm:text-xs">
            <h4 className="font-bold text-zinc-300 tracking-wide uppercase text-[9px] sm:text-[10px] border-b border-zinc-800 pb-1.5 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> MAP COORDINATES LEGEND
            </h4>
            <div className="space-y-1.5 text-[9.5px] sm:text-[10.5px] font-sans text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF3B30] animate-pulse shrink-0" style={{ boxShadow: '0 0 8px #FF3B30' }} />
                <span>Pulsing Crimson (Critical)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF9500] animate-pulse shrink-0" style={{ boxShadow: '0 0 8px #FF9500' }} />
                <span>Pulsing Saffron (Active)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#34C759] shrink-0" style={{ boxShadow: '0 0 6px #34C759' }} />
                <span>Green Dot (Cleared)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Stage: Strategic Control Operations Feed */}
        <div className={`w-full lg:w-[40%] flex flex-col bg-[#030306] overflow-hidden ${
          isStacked 
            ? (mobileActiveView === "feed" ? "h-full flex" : "hidden") 
            : "h-full"
        }`}>
          
          {/* Navigation and Tab Layout Switcher (Section 5 custom instructions) */}
          <div className="p-4 border-b border-zinc-900 bg-zinc-950/40 shrink-0 space-y-3.5">
            <div className="grid grid-cols-3 gap-1 bg-black/60 p-1 rounded-xl border border-zinc-900/80">
              <button
                onClick={() => { setActiveTab("live"); setFilter("ALL"); }}
                className={`py-3 text-[11px] tracking-[0.5px] uppercase transition-all cursor-pointer flex items-center justify-center min-h-[44px] ${
                  activeTab === "live"
                    ? "border-b-2 border-cyan-400 text-[#00E5FF] font-bold"
                    : "text-zinc-500 hover:text-zinc-300 font-medium"
                }`}
              >
                LIVE MONITOR
              </button>
              <button
                onClick={() => { setActiveTab("historical"); setFilter("ALL"); }}
                className={`py-3 text-[11px] tracking-[0.5px] uppercase transition-all cursor-pointer flex items-center justify-center min-h-[44px] ${
                  activeTab === "historical"
                    ? "border-b-2 border-cyan-400 text-[#00E5FF] font-bold"
                    : "text-zinc-500 hover:text-zinc-300 font-medium"
                }`}
              >
                LOOK BACK
              </button>
              <button
                onClick={() => { setActiveTab("overpass"); setFilter("ALL"); }}
                className={`py-3 text-[11px] tracking-[0.5px] uppercase transition-all cursor-pointer flex items-center justify-center min-h-[44px] ${
                  activeTab === "overpass"
                    ? "border-b-2 border-cyan-400 text-[#00E5FF] font-bold"
                    : "text-zinc-500 hover:text-zinc-300 font-medium"
                }`}
              >
                LIVE OVERPASS
              </button>
            </div>

            {/* In-feed filters or Search bars */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {activeTab === "historical" ? (
                <form onSubmit={handleHistoricalSearch} className="w-full flex items-center gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Enter target location (e.g. Wayanad, Kerala)"
                      className="w-full bg-black/80 border border-zinc-850 rounded-xl pl-10 pr-4 py-3 text-xs text-zinc-200 outline-none focus:border-cyan-500/50 transition-all font-sans min-h-[44px]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={histLoading}
                    className="bg-cyan-500 hover:bg-cyan-400 text-black text-xs uppercase tracking-wider px-6 py-3 rounded-xl font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50 min-h-[44px]"
                  >
                    {histLoading ? "Scanning..." : "SCAN HISTORY"}
                  </button>
                </form>
              ) : activeTab === "live" ? (
                <>
                  <div className="flex flex-wrap items-center gap-1 bg-black/50 p-1 rounded-lg border border-zinc-900">
                    {["ALL", "CRITICAL", "ACTIVE", "CLEARED"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setFilter(opt)}
                        className={`px-3 py-2 rounded text-[10px] font-sans font-medium transition-all cursor-pointer min-h-[44px] min-w-[50px] flex items-center justify-center ${
                          filter === opt
                            ? "bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                    <Clock className="w-3.5 h-3.5 text-cyan-600 animate-pulse" />
                    <span>Auto-sync in {refreshCountdown}s</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">TELEMETRY LOCKPOINT:</span>
                  <span className="text-[10px] font-mono text-[#00E5FF] font-bold uppercase truncate max-w-[200px]">
                    {lastTrackedCoords.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* SCROLL FEED CONTENT */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            
            {/* TAB 1: LIVE MONITOR FEEDS */}
            {activeTab === "live" && (
              <>
                {liveErrors.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-900/40 text-red-400 space-y-1.5 animate-pulse">
                    <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Telemetry Stream Disrupted
                    </p>
                    <ul className="list-disc list-inside text-[10px] space-y-1 text-zinc-400">
                      {liveErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {liveLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <RefreshCcw className="w-7 h-7 text-cyan-400 animate-spin" />
                    <p className="font-sans text-zinc-500 text-[10px] uppercase tracking-wider">Decrypting Live Alert Matrices...</p>
                  </div>
                ) : filteredLiveAlerts.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-zinc-900 rounded-2xl p-6 bg-zinc-950/20 space-y-3">
                    <ShieldAlert className="w-8 h-8 text-zinc-700 mx-auto" />
                    <div>
                      <p className="font-sans text-zinc-400 text-xs font-semibold uppercase">No active alerts</p>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        No active disaster alerts currently reported for this region. Natural hazard status is nominal.
                      </p>
                    </div>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredLiveAlerts.map((item) => {
                      const isCritical = item.severity === "Critical";
                      const isSelected = item.id === selectedLiveAlertId;

                      let badgeColor = "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20";
                      if (isCritical) badgeColor = "bg-red-500/10 text-red-500 border-red-500/20";
                      else if (item.severity === "Active") badgeColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";

                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          className={`p-4 rounded-xl border relative overflow-hidden flex flex-col justify-between transition-all cursor-pointer group ${
                            isSelected
                              ? "border-cyan-500 bg-cyan-950/5 shadow-[0_0_15px_rgba(0,229,255,0.05)]"
                              : isCritical
                                ? "border-red-950/30 hover:border-red-900/60 bg-red-950/[0.02]"
                                : "border-zinc-900 hover:border-zinc-800 bg-[#06060c]/30"
                          }`}
                          onClick={() => {
                            setSelectedLiveAlertId(item.id);
                            fetchWeather(item.lat, item.lng);
                          }}
                        >
                          <div className={`absolute top-0 bottom-0 left-0 w-1 ${
                            isSelected
                              ? "bg-cyan-400"
                              : isCritical
                                ? "bg-red-500"
                                : "bg-amber-500"
                          }`} />

                          <div className="pl-2.5 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className={`text-[9px] font-mono font-semibold tracking-widest px-2 py-0.5 rounded border uppercase leading-none ${badgeColor}`}>
                                {item.severity} [{item.source}]
                              </span>
                              
                              <span className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                                <Calendar className="w-3 h-3 text-zinc-600" />
                                {formattedTimeOffset(item.detectedAt)}
                              </span>
                            </div>

                            <div>
                              <h4 className={`text-xs font-bold tracking-wide leading-snug transition-colors uppercase ${
                                isSelected ? "text-white" : "text-zinc-200 group-hover:text-cyan-400"
                              }`}>
                                {item.title}
                              </h4>
                              <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                                {item.description}
                              </p>
                            </div>

                            {/* Expandable Impact Estimator Card */}
                            {(() => {
                              const impact = impactDataMap[item.id];
                              const isExpanded = !!expandedImpactIds[item.id];
                              
                              if (!impact) {
                                return (
                                  <div className="py-1 px-2.5 bg-zinc-950/40 border border-zinc-900 rounded-lg text-[9px] font-mono text-zinc-500 animate-pulse uppercase flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                    Calculating impact footprint matrix...
                                  </div>
                                );
                              }
                              
                              return (
                                <div 
                                  className="border border-zinc-900 bg-zinc-950/50 hover:bg-zinc-950/80 rounded-lg p-2.5 transition-all text-xs font-sans relative overflow-hidden"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedImpactIds(prev => ({
                                      ...prev,
                                      [item.id]: !isExpanded
                                    }));
                                  }}
                                >
                                  <div className="flex items-center justify-between cursor-pointer">
                                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-300">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]" />
                                      <span className="font-semibold uppercase text-zinc-400">At-Risk Pop:</span>
                                      <span className="font-bold text-[#FF6B35]">
                                        {impact.affected_population.toLocaleString()}
                                      </span>
                                    </div>
                                    <span className="text-[9px] font-mono text-cyan-400 hover:text-cyan-300 uppercase select-none flex items-center gap-0.5">
                                      {isExpanded ? "Collapse ▲" : "Expand ▼"}
                                    </span>
                                  </div>

                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden pt-2.5 mt-2 border-t border-zinc-900 space-y-2 text-[11px]"
                                      >
                                        <div className="grid grid-cols-2 gap-2 font-mono text-[9.5px]">
                                          <div>
                                            <span className="block text-[8px] text-zinc-500 uppercase">IMPACT RADIUS</span>
                                            <span className="font-bold text-zinc-200">{impact.radius_km} km</span>
                                          </div>
                                          <div>
                                            <span className="block text-[8px] text-zinc-500 uppercase">RESPONSE SCALE</span>
                                            <span className={`font-bold uppercase ${
                                              getResponseScale(impact.affected_population) === "Massive" ? "text-red-500" :
                                              getResponseScale(impact.affected_population) === "Large" ? "text-amber-500" :
                                              "text-green-500"
                                            }`}>
                                              {getResponseScale(impact.affected_population)}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Towns in impact zone */}
                                        <div>
                                          <span className="block text-[8px] font-mono text-zinc-500 uppercase mb-1">TOWNS IN IMPACT ZONE:</span>
                                          {impact.towns && impact.towns.length > 0 ? (
                                            <div className="max-h-24 overflow-y-auto space-y-1 pr-1 custom-scrollbar font-mono text-[9.5px]">
                                              {impact.towns.map((town: any, idx: number) => (
                                                <div key={idx} className="flex justify-between items-center text-zinc-300 py-0.5 border-b border-zinc-900/40 last:border-0">
                                                  <span className="font-semibold text-zinc-200">{town.name}</span>
                                                  <span className="text-zinc-500 text-[9px] text-right">
                                                    {town.distance_km} km ({town.population.toLocaleString()})
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-[9px] font-mono text-zinc-600 uppercase">No major settlements identified within perimeter.</span>
                                          )}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })()}

                            {/* Additional overlay metrics for weather at active selection */}
                            {isSelected && (
                              <div className="pt-2">
                                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">LOCAL CO-LATITUDE WEATHER:</span>
                                {weatherLoading ? (
                                  <div className="flex items-center gap-1 font-mono text-[8.5px] text-zinc-500 animate-pulse">
                                    <RefreshCcw className="w-3 h-3 animate-spin text-cyan-400" /> CORRELATING METEOROLOGICAL MATRIX...
                                  </div>
                                ) : weatherData?.current ? (
                                  <div className="grid grid-cols-4 gap-1 p-2 bg-black/60 rounded border border-zinc-900 text-center font-mono">
                                    <div>
                                      <span className="block text-[7px] text-zinc-650">TEMP</span>
                                      <span className="text-[9.5px] font-bold text-[#00E5FF]">{weatherData.current.temperature_2m}°C</span>
                                    </div>
                                    <div>
                                      <span className="block text-[7px] text-zinc-650">RAIN</span>
                                      <span className="text-[9.5px] font-bold text-[#00E5FF]">{weatherData.current.precipitation}mm</span>
                                    </div>
                                    <div>
                                      <span className="block text-[7px] text-zinc-650">RH</span>
                                      <span className="text-[9.5px] font-bold text-[#00E5FF]">{weatherData.current.relative_humidity_2m}%</span>
                                    </div>
                                    <div>
                                      <span className="block text-[7px] text-zinc-650">WIND</span>
                                      <span className="text-[9.5px] font-bold text-[#00E5FF]">{weatherData.current.wind_speed_10m}k/h</span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[8.5px] font-sans font-medium text-[#FF9500] uppercase block">Awaiting meteorological feedback.</span>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-between border-t border-zinc-900/80 pt-3 mt-1 text-[10px]">
                              <p className="text-zinc-500 flex items-center gap-1 font-sans">
                                <MapPin className="w-3 h-3 text-cyan-400" />
                                {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                              </p>
                              
                              <a
                                href={item.link}
                                target="_blank"
                                onClick={(e) => e.stopPropagation()}
                                className="text-cyan-400 hover:text-cyan-300 font-semibold uppercase tracking-wider flex items-center gap-1 outline-none text-[9px]"
                              >
                                <span>Original Source</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </>
            )}

            {/* TAB 2: LOOK BACK HISTORICAL TIMELINE */}
            {activeTab === "historical" && (
              <>
                {histErrors.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-900/40 text-red-400 space-y-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Geocoding System Diagnostics
                    </p>
                    <ul className="list-disc list-inside text-[10px] space-y-1 text-zinc-400">
                      {histErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {histLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <RefreshCcw className="w-7 h-7 text-cyan-550 animate-spin" />
                    <p className="font-sans text-zinc-500 text-[10px] uppercase tracking-wider">Acquiring Multi-Temporal Space Archives...</p>
                  </div>
                ) : !resolvedLocation ? (
                  <div className="text-center py-16 border border-dashed border-zinc-900 rounded-2xl p-6 bg-zinc-950/40 space-y-3">
                    <Search className="w-8 h-8 text-zinc-700 mx-auto" />
                    <div>
                      <p className="font-sans text-zinc-400 text-xs font-bold uppercase">Archive Search Centroid Unassigned</p>
                      <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                        Input a target Indian landmark or global city above to geocode coordinates and automatically scan historical disaster archives within a 100km radius and sliding 24 months.
                      </p>
                    </div>
                  </div>
                ) : histEvents.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-zinc-900 rounded-2xl p-6 bg-zinc-950/40 space-y-3">
                    <ShieldAlert className="w-8 h-8 text-zinc-700 mx-auto" />
                    <div>
                      <p className="font-sans text-zinc-400 text-xs font-semibold uppercase">Zero incidents mapped</p>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        No registered disasters found in the spatial registry for the past 24 months within 100km of coordinates.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="px-1 border-l-2 border-cyan-400 pl-3">
                      <p className="text-[10px] uppercase text-zinc-500 font-mono font-bold">Scanning Focal Centroid point</p>
                      <h4 className="text-xs font-bold text-zinc-300 leading-snug uppercase font-mono">{resolvedLocation.displayName}</h4>
                    </div>

                    <p className="text-[9px] uppercase tracking-wider text-purple-400 font-bold font-mono">
                      {histEvents.length} Historical Incidents Mapped (Sliding 24 Months)
                    </p>

                    <AnimatePresence mode="popLayout">
                      {histEvents.map((evt) => {
                        const isSelected = evt.id === selectedHistEventId;
                        const isCritical = evt.severity === "Critical";

                        // Colored left borders based on disaster properties
                        let leftBorderColor = "bg-purple-500";
                        if (evt.type.toLowerCase().includes("fire") || evt.type.toLowerCase().includes("thermal")) leftBorderColor = "bg-red-400";
                        else if (evt.type.toLowerCase().includes("flood") || evt.type.toLowerCase().includes("cyclone")) leftBorderColor = "bg-blue-500";
                        else if (evt.type.toLowerCase().includes("quake") || evt.type.toLowerCase().includes("landslide")) leftBorderColor = "bg-amber-600";

                        return (
                          <motion.div
                            key={evt.id}
                            initial={{ opacity: 0, scale: 0.99 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`p-4 rounded-xl border relative overflow-hidden transition-all cursor-pointer flex flex-col gap-3 ${
                              isSelected
                                ? "border-purple-500 bg-purple-950/[0.04]"
                                : "border-zinc-900 hover:border-zinc-800 bg-[#030306]"
                            }`}
                            onClick={() => setSelectedHistEventId(evt.id)}
                          >
                            {/* Accent indicator border */}
                            <div className={`absolute top-0 bottom-0 left-0 w-1 ${leftBorderColor}`} />

                            <div className="pl-2 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-mono text-purple-300 font-bold uppercase leading-none px-2 py-0.5 bg-purple-950/20 border border-purple-500/20 rounded">
                                  {evt.type} • {evt.source}
                                </span>
                              </div>

                              <div>
                                <h4 className="text-xs font-bold uppercase text-zinc-200 mt-1 font-sans">
                                  {evt.title}
                                </h4>
                              </div>

                              {/* Stacked 4 Required Fields for Section 2 (USGS Mags / duration etc) */}
                              <div className="grid grid-cols-1 bg-black/50 p-3 rounded-lg border border-zinc-900 text-[10px] space-y-1.5 font-mono text-zinc-400">
                                <div className="flex justify-between border-b border-zinc-910 pb-1">
                                  <span className="text-zinc-500 uppercase">Risk Level / Severity:</span>
                                  <span className="font-bold text-[#00E5FF] uppercase">
                                    {evt.type === "Earthquake" 
                                      ? (evt.description.match(/Magnitude: [\d\.]+/) ? evt.description.match(/Magnitude: [\d\.]+/)?.[0] : "SEISMIC ACTIVITY") 
                                      : `${evt.severity} Hazard Status`}
                                  </span>
                                </div>
                                <div className="flex justify-between border-b border-zinc-910 pb-1">
                                  <span className="text-zinc-500 uppercase">Duration / Time Elapsed:</span>
                                  <span className="font-bold text-[#00E5FF] uppercase">
                                    {calculateElapsedString(evt.date)}
                                  </span>
                                </div>
                                <div className="flex justify-between border-b border-zinc-910 pb-1">
                                  <span className="text-zinc-500 uppercase">Exact UTC Date & Time:</span>
                                  <span className="font-bold text-[#00E5FF]">
                                    {new Date(evt.date).toISOString().replace("T", " ").substring(0, 19)} UTC
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-zinc-500 uppercase">Exact Location:</span>
                                  <span className="font-bold text-zinc-300">
                                    {calculateFormattedCoords(evt.lat, evt.lng)}
                                  </span>
                                </div>
                              </div>

                              {/* What Happened paragraph */}
                              <div className="p-2.5 bg-zinc-900/40 rounded-lg border border-zinc-850">
                                <span className="text-[8px] font-mono text-zinc-500 uppercase block mb-1">Observation Summary log:</span>
                                <p className="text-[10.5px] font-sans text-zinc-300 leading-normal font-light">
                                  {evt.description}
                                </p>
                              </div>

                              {/* ReliefWeb Situation reports photos */}
                              {evt.reliefWebReport ? (
                                <div className="p-3.5 bg-zinc-950/90 border border-zinc-900 rounded-lg space-y-2.5">
                                  <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#00E5FF] font-bold">
                                    <Layers className="w-3.5 h-3.5 text-cyan-400" /> Active ReliefWeb Situation dossier
                                  </div>
                                  <h5 className="text-[10.5px] font-sans font-semibold text-zinc-300 leading-snug">
                                    {evt.reliefWebReport.title}
                                  </h5>

                                  {evt.reliefWebReport.image ? (
                                    <div className="relative rounded overflow-hidden border border-zinc-900 mt-2">
                                      <img
                                        src={evt.reliefWebReport.image}
                                        alt="Situation Report Attachment Map"
                                        className="w-full max-h-36 object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/80 border border-zinc-800 font-mono text-[7.5px] text-[#00E5FF] font-bold">
                                        OBSERVATION_FLYER_PREVIEW
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-[9px] text-zinc-500 uppercase font-mono italic">
                                      No imagery available for this event
                                    </p>
                                  )}

                                  {evt.reliefWebReport.link && (
                                    <a
                                      href={evt.reliefWebReport.link}
                                      target="_blank"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-cyan-400 hover:text-cyan-300 text-[8.5px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 mt-1 cursor-pointer"
                                    >
                                      Review Situation Dossier <ChevronRight className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <div className="p-3.5 bg-zinc-950/30 border border-dashed border-zinc-900 rounded-lg text-center">
                                  <p className="text-[9px] text-zinc-550 uppercase font-mono italic">
                                    No imagery available for this event
                                  </p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}

            {/* TAB 3: LIVE OVERPASS TRACKER (Section 4 requirement) */}
            {activeTab === "overpass" && (
              <div className="space-y-4">
                
                {/* HUD Header description */}
                <div className="px-1 border-l-2 border-cyan-400 pl-3">
                  <p className="text-[10px] uppercase text-zinc-500 font-mono font-bold">Orbital Intercept calculations</p>
                  <h4 className="text-xs font-bold text-zinc-300 leading-snug uppercase font-mono">
                    Tracking over: {lastTrackedCoords.name}
                  </h4>
                </div>

                {/* Satellite Selector Buttons */}
                <div className="flex items-center justify-between bg-black/60 p-2 rounded-xl border border-zinc-900 text-xs font-mono">
                  <span className="text-zinc-500 uppercase text-[9px]">Select Instrument:</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedSatelliteId(40053)}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold uppercase text-[9px] ${
                        selectedSatelliteId === 40053 
                          ? "bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20" 
                          : "text-zinc-500 hover:text-zinc-300 bg-transparent border-none"
                      }`}
                    >
                      Sentinel-2A
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSatelliteId(39084)}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold uppercase text-[9px] ${
                        selectedSatelliteId === 39084 
                          ? "bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20" 
                          : "text-zinc-500 hover:text-zinc-300 bg-transparent border-none"
                      }`}
                    >
                      Landsat 8
                    </button>
                  </div>
                </div>

                {/* Central digital countdown card */}
                {passesLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <RefreshCcw className="w-6 h-6 text-cyan-400 animate-spin" />
                    <span className="text-[8px] font-mono text-zinc-550 uppercase tracking-widest">PROPAGATING KEPLERIAN MATH...</span>
                  </div>
                ) : passesError ? (
                  <div className="text-center py-10 border border-dashed border-red-900/30 rounded-2xl bg-red-950/5 space-y-2">
                    <AlertTriangle className="w-7 h-7 text-red-500 mx-auto animate-pulse" />
                    <p className="font-mono text-zinc-400 text-xs font-bold uppercase">Tracking unavailable</p>
                    <p className="text-[10px] text-zinc-550">UPSTREAM CLESATRAK PROXIES REPORTED OFFLINE SIGNS</p>
                  </div>
                ) : overpassPredict ? (
                  <div className="space-y-4">
                    
                    {/* Big Countdown Card */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 text-center space-y-2 relative overflow-hidden shadow-lg shadow-cyan-950/5">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-blue-500" />
                      
                      <span className="block text-[10px] font-mono text-zinc-500 tracking-wider font-extrabold uppercase">
                        NEXT INTERCEPT TIME WINDOW COUNTDOWN
                      </span>
                      
                      {/* Monospace 60px digital timer */}
                      <span className="font-mono text-[48px] sm:text-[60px] font-black text-cyan-400 tracking-widest block tabular-nums leading-none">
                        {overpassCountdown}
                      </span>

                      <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-300 font-mono">
                        <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>Locked tracking target: {lastTrackedCoords.name}</span>
                      </div>
                    </div>

                    {/* Orbit specs */}
                    <div className="grid grid-cols-2 gap-3.5 font-mono text-[11px]">
                      <div className="p-3 border border-zinc-900 bg-black/40 rounded-xl space-y-1">
                        <span className="block text-[8.5px] text-zinc-500 uppercase tracking-wider font-bold">ACTIVE PLATFORM</span>
                        <span className="block font-black text-white uppercase text-[12px]">{overpassPredict.satelliteName}</span>
                      </div>

                      <div className="p-3 border border-zinc-900 bg-black/40 rounded-xl space-y-1">
                        <span className="block text-[8.5px] text-zinc-500 uppercase tracking-wider font-bold">PASS HEIGHT MAX</span>
                        <span className="block font-black text-[#00E5FF] text-[12px]">{overpassPredict.altitudeKm} KM</span>
                      </div>

                      <div className="p-3 border border-zinc-900 bg-black/40 rounded-xl space-y-1">
                        <span className="block text-[8.5px] text-zinc-500 uppercase tracking-wider font-bold">CROSS INTERCEPT</span>
                        <span className="block font-bold text-white text-[11.5px]">
                          {new Date(overpassPredict.nextPassTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })} UTC
                        </span>
                      </div>

                      <div className="p-3 border border-zinc-900 bg-black/40 rounded-xl space-y-1">
                        <span className="block text-[8.5px] text-zinc-500 uppercase tracking-wider font-bold">ZENITH ELEVATION</span>
                        <span className="block font-bold text-[#00E5FF] text-[11.5px]">{overpassPredict.maxElevationDegrees}° (ELEV)</span>
                      </div>
                    </div>

                    {/* Upcoming Passes Table List */}
                    <div className="space-y-2 pt-2">
                      <span className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-extrabold flex items-center gap-1.5">
                        <Orbit className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '12s' }} /> UPCOMING TRANSMISSION WINDOWS
                      </span>
                      
                      <div className="space-y-2">
                        {upcomingPasses.map((pass, i) => {
                          const isHigh = pass.maxElevationDegrees >= 35;
                          return (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-black/80 border border-zinc-900 font-mono text-[11px]">
                              <div>
                                <span className="block font-bold text-zinc-200">{pass.satelliteName}</span>
                                <span className="text-[9.5px] text-zinc-500">
                                  {new Date(pass.nextPassTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="block font-bold text-cyan-400">{pass.maxElevationDegrees}° El</span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border leading-none inline-block ${
                                  isHigh ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-800 text-zinc-400 border-zinc-700"
                                }`}>
                                  {isHigh ? "Optimal Zenith" : "Low Horizon"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="text-center py-10 font-mono text-[10px] text-zinc-650 uppercase">
                    CORRELATING VECTOR NODES...
                  </div>
                )}

              </div>
            )}

          </div>

          {/* Operational telemetry message */}
          <div className="p-3 border-t border-zinc-900 bg-zinc-950 shrink-0 text-[9px] text-zinc-500 flex items-center gap-2 justify-center font-mono uppercase tracking-wide">
            <Server className="w-3.5 h-3.5 text-zinc-700 animate-pulse" />
            <span>CLOUD SYNCHRONIZATION OPERATIONAL • MISSION DIRECTORS READY • RECON FEED STEADY</span>
          </div>

        </div>

        {/* Tablet & Desktop Side Panel (slides in from the right over the map or feed with full available viewport height) */}
        {!isMobile && activeTab === "live" && selectedLiveAlertId && currentLiveAlert && (
          <div 
            className={`absolute top-6 bottom-6 bg-zinc-950/95 backdrop-blur-md border border-zinc-850 p-4 rounded-xl z-30 w-80 shadow-[0_12px_45px_rgba(0,0,0,0.95)] flex flex-col space-y-4 font-sans transition-all overflow-y-auto ${
              isStacked ? "right-6" : "right-[calc(40%+1.5rem)]"
            }`}
          >
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <span className="text-[9px] font-mono bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 rounded text-cyan-300 font-bold uppercase leading-none">
                {currentLiveAlert.type} [{currentLiveAlert.source}]
              </span>
              <span className={`text-[8.5px] font-mono font-bold px-2 py-0.5 rounded leading-none border uppercase ${
                currentLiveAlert.severity === "Critical" 
                  ? "bg-red-500/10 text-red-500 border-red-500/20 animate-pulse" 
                  : "bg-amber-500/10 text-amber-500 border-amber-500/20"
              }`}>
                {currentLiveAlert.severity}
              </span>
            </div>
            
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white uppercase tracking-wide leading-snug">{currentLiveAlert.title}</h4>
              <p className="text-[10.5px] text-zinc-400 leading-normal font-light">{currentLiveAlert.description}</p>
            </div>

            <div className="border-t border-zinc-900 pt-3 space-y-1.5 text-[9px] font-mono text-zinc-500">
              <div className="flex justify-between"><span>GEOPOINT:</span> <span className="text-zinc-300">{currentLiveAlert.lat.toFixed(4)}°N, {currentLiveAlert.lng.toFixed(4)}°E</span></div>
              <div className="flex justify-between"><span>DETERMINATION:</span> <span className="text-zinc-300">{new Date(currentLiveAlert.detectedAt).toUTCString()}</span></div>
              <div className="flex justify-between"><span>SEVERITY INDEX:</span> <span className="text-cyan-400 font-bold">{currentLiveAlert.severityScore || "HIGH RISK"}</span></div>
            </div>

            <a
              href={currentLiveAlert.link}
              target="_blank"
              className="w-full text-center bg-zinc-900 border border-zinc-800 hover:border-cyan-500/40 text-[#00E5FF] py-3 rounded-lg text-[9px] uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <span>VISIT CORRESPONDENT FEED</span>
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            </a>

            <button
              onClick={() => setSelectedLiveAlertId(null)}
              className="w-full bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-zinc-350 py-2.5 rounded-lg text-[9px] uppercase tracking-wider font-bold transition-all min-h-[44px]"
            >
              Close Panel
            </button>
          </div>
        )}

      </div>

      {/* Mobile Bottom Sheet for Marker Detail (Slide Up overlay) */}
      <AnimatePresence>
        {isMobile && activeTab === "live" && selectedLiveAlertId && currentLiveAlert && (
          <>
            {/* Backdrop Blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLiveAlertId(null)}
              className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs cursor-pointer"
            />
            {/* Slide up sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 bg-zinc-950/98 border-t border-zinc-900 rounded-t-3xl z-55 px-5 pt-3 pb-8 shadow-[0_-12px_45px_rgba(0,0,0,0.95)] max-h-[60vh] overflow-y-auto font-sans"
            >
              {/* Drag handle line indicator */}
              <div 
                className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-5 cursor-pointer" 
                onClick={() => setSelectedLiveAlertId(null)}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                  <span className="text-[10px] font-mono bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 rounded-lg text-cyan-300 font-bold uppercase">
                    {currentLiveAlert.type} [{currentLiveAlert.source}]
                  </span>
                  <span className={`text-[9px] font-mono font-bold px-2.5 py-1 rounded-lg border uppercase ${
                    currentLiveAlert.severity === "Critical" 
                      ? "bg-red-500/10 text-red-500 border-red-500/20 animate-pulse" 
                      : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  }`}>
                    {currentLiveAlert.severity}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wide leading-snug">{currentLiveAlert.title}</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed font-light">{currentLiveAlert.description}</p>
                </div>

                <div className="border-t border-zinc-900 pt-3.5 space-y-2 text-[10px] font-mono text-zinc-550">
                  <div className="flex justify-between"><span>GEOPOINT:</span> <span className="text-zinc-300">{currentLiveAlert.lat.toFixed(4)}°N, {currentLiveAlert.lng.toFixed(4)}°E</span></div>
                  <div className="flex justify-between"><span>DETERMINATION:</span> <span className="text-zinc-300">{new Date(currentLiveAlert.detectedAt).toUTCString()}</span></div>
                  <div className="flex justify-between"><span>SEVERITY INDEX:</span> <span className="text-cyan-400 font-bold">{currentLiveAlert.severityScore || "HIGH RISK"}</span></div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <a
                    href={currentLiveAlert.link}
                    target="_blank"
                    className="text-center bg-cyan-500 hover:bg-cyan-400 text-black py-3 rounded-xl text-[10px] uppercase tracking-wider font-black transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <span>VISIT FEED</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => setSelectedLiveAlertId(null)}
                    className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-350 py-3 rounded-xl text-[10px] uppercase tracking-wider font-bold transition-all min-h-[44px]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
