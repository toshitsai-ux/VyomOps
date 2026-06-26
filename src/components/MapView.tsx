import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Incident {
  id: string;
  disaster_type?: string;
  title?: string;
  location?: string;
  severity?: string;
  lat?: number | string;
  lng?: number | string;
  verification_score?: number;
}

interface MapViewProps {
  incidents: Incident[];
  onMarkerClick?: (id: string) => void;
  selectedId?: string | null;
}

// Map Center Controller Component to auto-center when selectedId changes
const MapCenterController: React.FC<{ selectedId?: string | null; incidents: Incident[] }> = ({
  selectedId,
  incidents,
}) => {
  const map = useMap();

  useEffect(() => {
    if (!selectedId || !incidents) return;
    const selected = incidents.find((i) => i.id === selectedId);
    if (selected) {
      const lat = typeof selected.lat === "number" ? selected.lat : parseFloat(selected.lat || "20.5937");
      const lng = typeof selected.lng === "number" ? selected.lng : parseFloat(selected.lng || "78.9629");
      if (!isNaN(lat) && !isNaN(lng)) {
        map.setView([lat, lng], 7, { animate: true, duration: 1.2 });
      }
    }
  }, [selectedId, incidents, map]);

  return null;
};

// Map Controls Component
const MapControls: React.FC = () => {
  const map = useMap();

  const handleReset = () => {
    map.flyTo([20.5937, 78.9629], 4, { duration: 1.5 });
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        display: "flex",
        gap: "6px",
        background: "rgba(10,10,26,0.85)",
        padding: "8px 14px",
        borderRadius: "8px",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <button onClick={() => map.zoomIn()} style={buttonStyle} aria-label="Zoom in" title="Zoom in">
        +
      </button>
      <button onClick={() => map.zoomOut()} style={buttonStyle} aria-label="Zoom out" title="Zoom out">
        −
      </button>
      <div style={{ width: "1px", background: "rgba(255,255,255,0.08)" }} />
      <button onClick={handleReset} style={{ ...buttonStyle, padding: "4px 12px", fontSize: "11px", width: "auto" }} aria-label="Reset map view" title="Reset map view">
        ↺ Reset
      </button>
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.7)",
  borderRadius: "4px",
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: "16px",
  transition: "all 0.2s",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "30px",
  height: "28px",
};

const MapView: React.FC<MapViewProps> = ({ incidents, onMarkerClick, selectedId }) => {
  const mapRef = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Fix Leaflet Default Marker Icons
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });
    setMapReady(true);
  }, []);

  if (!mapReady) {
    return (
      <div
        style={{
          height: "100%",
          width: "100%",
          background: "#0A0A1A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.3)",
          fontFamily: "monospace",
          fontSize: "11px",
        }}
      >
        Loading map telemetry...
      </div>
    );
  }

  return (
    <div className="map-container" style={{ height: "100%", width: "100%", position: "relative" }}>
      {/* ONLY ONE MAP - NO OVERLAY */}
      <MapContainer
        ref={mapRef}
        center={[20.5937, 78.9629]}
        zoom={4}
        style={{
          height: "100%",
          width: "100%",
          background: "#0A0A1A",
        }}
        zoomControl={false}
        attributionControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        dragging={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Dynamic Auto-Centering and Zoom Controller */}
        <MapCenterController selectedId={selectedId} incidents={incidents} />

        {/* Render incident markers */}
        {incidents?.map((incident) => {
          const lat = typeof incident.lat === "number" ? incident.lat : parseFloat(incident.lat || "20.5937");
          const lng = typeof incident.lng === "number" ? incident.lng : parseFloat(incident.lng || "78.9629");

          if (isNaN(lat) || isNaN(lng)) return null;

          return (
            <Marker
              key={incident.id}
              position={[lat, lng]}
              eventHandlers={{
                click: () => onMarkerClick?.(incident.id),
              }}
            >
              <Popup>
                <div
                  style={{
                    color: "#FFFFFF",
                    fontFamily: "Inter, sans-serif",
                    minWidth: "150px",
                  }}
                >
                  <strong style={{ fontSize: "13px", color: "#00E5FF" }}>
                    {incident.title || "Incident Report"}
                  </strong>
                  <br />
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", display: "block", marginTop: "4px" }}>
                    Location: {incident.location || "Coordinates Centroid"}
                  </span>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", display: "block" }}>
                    Severity: <span style={{ fontWeight: "bold", color: incident.severity === "Critical" ? "#FF6B35" : "#00E5FF" }}>{incident.severity}</span>
                  </span>
                  {incident.verification_score && (
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", display: "block" }}>
                      Confidence Score: <span style={{ color: "#34C759", fontWeight: "bold" }}>{incident.verification_score}%</span>
                    </span>
                  )}
                  <button
                    onClick={() => onMarkerClick?.(incident.id)}
                    style={{
                      marginTop: "10px",
                      padding: "5px 12px",
                      background: "#00E5FF",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      color: "#0A0A1A",
                      fontWeight: 700,
                      fontFamily: "Orbitron, sans-serif",
                      fontSize: "10px",
                      letterSpacing: "0.5px",
                      width: "100%",
                      textAlign: "center",
                      transition: "background 0.2s",
                    }}
                  >
                    SELECT TELEMETRY
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Map Controls */}
        <MapControls />
      </MapContainer>
    </div>
  );
};

export default MapView;
