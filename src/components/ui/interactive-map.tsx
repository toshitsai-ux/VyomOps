import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polygon,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom marker icons
const createCustomIcon = (color: string = "blue", size: "small" | "medium" | "large" = "medium") => {
  const sizes = {
    small: [20, 32] as [number, number],
    medium: [25, 41] as [number, number],
    large: [30, 50] as [number, number],
  };

  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: sizes[size],
    iconAnchor: [sizes[size][0] / 2, sizes[size][1]],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
};

// Map event handler component
interface MapEventsProps {
  onMapClick?: (latlng: L.LatLng) => void;
  onLocationFound?: (latlng: L.LatLng) => void;
}

const MapEvents: React.FC<MapEventsProps> = ({ onMapClick, onLocationFound }) => {
  const map = useMapEvents({
    click: (e) => {
      onMapClick && onMapClick(e.latlng);
    },
    locationfound: (e) => {
      onLocationFound && onLocationFound(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return null;
};

// Custom control component
interface CustomControlsProps {
  onLocate: () => void;
  onToggleLayer: (layerType: "openstreetmap" | "satellite" | "traffic") => void;
  layers: {
    openstreetmap: boolean;
    satellite: boolean;
    traffic: boolean;
  };
}

const CustomControls: React.FC<CustomControlsProps> = ({ onLocate, onToggleLayer, layers }) => {
  const map = useMap();

  useEffect(() => {
    const control = new L.Control({ position: "topright" });

    control.onAdd = () => {
      const div = L.DomUtil.create("div", "custom-controls");
      div.innerHTML = `
        <div style="background: rgba(10, 10, 22, 0.85); padding: 8px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(8px); display: flex; flex-direction: column; gap: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
          <button id="locate-btn" style="padding: 6px 12px; background: rgba(255, 255, 255, 0.05); color: #00E5FF; border: 1px solid rgba(0, 229, 255, 0.2); border-radius: 4px; font-family: monospace; font-size: 10px; cursor: pointer; transition: all 0.2s;">📍 LOCATE ME</button>
          <button id="satellite-btn" style="padding: 6px 12px; background: ${layers.satellite ? "rgba(0, 229, 255, 0.15)" : "rgba(255, 255, 255, 0.05)"}; color: ${layers.satellite ? "#00E5FF" : "#a1a1aa"}; border: 1px solid ${layers.satellite ? "rgba(0, 229, 255, 0.4)" : "rgba(255, 255, 255, 0.1)"}; border-radius: 4px; font-family: monospace; font-size: 10px; cursor: pointer; transition: all 0.2s;">🛰️ SATELLITE</button>
          <button id="osm-btn" style="padding: 6px 12px; background: ${layers.openstreetmap ? "rgba(0, 229, 255, 0.15)" : "rgba(255, 255, 255, 0.05)"}; color: ${layers.openstreetmap ? "#00E5FF" : "#a1a1aa"}; border: 1px solid ${layers.openstreetmap ? "rgba(0, 229, 255, 0.4)" : "rgba(255, 255, 255, 0.1)"}; border-radius: 4px; font-family: monospace; font-size: 10px; cursor: pointer; transition: all 0.2s;">🗺️ MAP LAYER</button>
        </div>
      `;

      L.DomEvent.disableClickPropagation(div);

      const locateBtn = div.querySelector("#locate-btn") as HTMLButtonElement;
      const satelliteBtn = div.querySelector("#satellite-btn") as HTMLButtonElement;
      const osmBtn = div.querySelector("#osm-btn") as HTMLButtonElement;

      locateBtn.onclick = () => onLocate();
      satelliteBtn.onclick = () => onToggleLayer("satellite");
      osmBtn.onclick = () => onToggleLayer("openstreetmap");

      return div;
    };

    control.addTo(map);

    return () => {
      control.remove();
    };
  }, [map, onLocate, onToggleLayer, layers]);

  return null;
};

// Search component
interface SearchControlProps {
  onSearch?: (result: { latLng: [number, number]; name: string }) => void;
}

const SearchControl: React.FC<SearchControlProps> = ({ onSearch }) => {
  const [query, setQuery] = useState("");
  const map = useMap();

  const handleSearch = async () => {
    if (!query.trim()) return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
      );
      const results = await response.json();

      if (results.length > 0) {
        const { lat, lon, display_name } = results[0];
        const latLng: [number, number] = [parseFloat(lat), parseFloat(lon)];
        map.flyTo(latLng, 13);
        onSearch && onSearch({ latLng, name: display_name });
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  useEffect(() => {
    const control = new L.Control({ position: "topleft" });

    control.onAdd = () => {
      const div = L.DomUtil.create("div", "search-control");
      div.innerHTML = `
        <div style="background: rgba(10, 10, 22, 0.85); padding: 8px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(8px); display: flex; gap: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
          <input 
            id="search-input" 
            type="text" 
            placeholder="Search coordinates..." 
            value="${query}"
            style="padding: 6px 10px; background: rgba(0, 0, 0, 0.5); color: #fff; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 4px; width: 160px; font-family: monospace; font-size: 10px; outline: none;"
          />
          <button 
            id="search-btn" 
            style="padding: 6px 10px; border: 1px solid rgba(0, 229, 255, 0.3); border-radius: 4px; cursor: pointer; background: rgba(0, 229, 255, 0.1); color: #00E5FF; font-family: monospace; font-size: 10px; font-weight: bold; transition: all 0.2s;"
          >
            FIND
          </button>
        </div>
      `;

      L.DomEvent.disableClickPropagation(div);

      const input = div.querySelector("#search-input") as HTMLInputElement;
      const button = div.querySelector("#search-btn") as HTMLButtonElement;

      input.oninput = (e: any) => setQuery(e.target.value);
      input.onkeypress = (e: any) => {
        if (e.key === "Enter") {
          // Trigger search using current input value
          const val = input.value;
          fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}`
          )
            .then((res) => res.json())
            .then((results) => {
              if (results.length > 0) {
                const { lat, lon, display_name } = results[0];
                const latLng: [number, number] = [parseFloat(lat), parseFloat(lon)];
                map.flyTo(latLng, 13);
                onSearch && onSearch({ latLng, name: display_name });
              }
            })
            .catch((err) => console.error("Search error:", err));
        }
      };

      button.onclick = () => {
        const val = input.value;
        fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}`
        )
          .then((res) => res.json())
          .then((results) => {
            if (results.length > 0) {
              const { lat, lon, display_name } = results[0];
              const latLng: [number, number] = [parseFloat(lat), parseFloat(lon)];
              map.flyTo(latLng, 13);
              onSearch && onSearch({ latLng, name: display_name });
            }
          })
          .catch((err) => console.error("Search error:", err));
      };

      return div;
    };

    control.addTo(map);

    return () => {
      control.remove();
    };
  }, [map, onSearch]);

  return null;
};

// Component to dynamically apply flying or centering behaviors when center changes
interface MapCenterControllerProps {
  center: [number, number];
  zoom: number;
}

const MapCenterController: React.FC<MapCenterControllerProps> = ({ center, zoom }) => {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 1.5 });
  }, [center, zoom, map]);

  return null;
};

export interface MapMarkerItem {
  id: string | number;
  position: [number, number];
  color?: string;
  size?: "small" | "medium" | "large";
  icon?: L.Icon | L.DivIcon;
  popup?: {
    title: string;
    content: React.ReactNode;
    image?: string;
  };
  eventHandlers?: Record<string, () => void>;
}

export interface MapPolygonItem {
  id?: string | number;
  positions: [number, number][];
  style?: L.PathOptions;
  popup?: string;
}

export interface MapCircleItem {
  id?: string | number;
  center: [number, number];
  radius: number;
  style?: L.PathOptions;
  popup?: string;
}

export interface MapPolylineItem {
  id?: string | number;
  positions: [number, number][];
  style?: L.PathOptions;
  popup?: string;
}

interface AdvancedMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarkerItem[];
  polygons?: MapPolygonItem[];
  circles?: MapCircleItem[];
  polylines?: MapPolylineItem[];
  onMarkerClick?: (marker: MapMarkerItem) => void;
  onMapClick?: (latlng: L.LatLng) => void;
  enableClustering?: boolean;
  enableSearch?: boolean;
  enableControls?: boolean;
  mapLayers?: {
    openstreetmap: boolean;
    satellite: boolean;
    traffic: boolean;
  };
  className?: string;
  style?: React.CSSProperties;
  onMapInstance?: (map: L.Map) => void;
}

export const AdvancedMap: React.FC<AdvancedMapProps> = ({
  center = [20.5937, 78.9629],
  zoom = 5,
  markers = [],
  polygons = [],
  circles = [],
  polylines = [],
  onMarkerClick,
  onMapClick,
  enableClustering = true,
  enableSearch = true,
  enableControls = true,
  mapLayers = {
    openstreetmap: true,
    satellite: false,
    traffic: false,
  },
  className = "",
  style = { height: "100%", width: "100%" },
  onMapInstance,
}) => {
  const [currentLayers, setCurrentLayers] = useState(mapLayers);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [searchResult, setSearchResult] = useState<{ latLng: [number, number]; name: string } | null>(null);
  const [clickedLocation, setClickedLocation] = useState<L.LatLng | null>(null);

  // Handle layer toggling
  const handleToggleLayer = useCallback((layerType: "openstreetmap" | "satellite" | "traffic") => {
    setCurrentLayers((prev) => ({
      ...prev,
      [layerType]: !prev[layerType],
    }));
  }, []);

  // Handle geolocation
  const handleLocate = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        (error) => {
          console.error("Geolocation error:", error);
        }
      );
    }
  }, []);

  // Handle map click
  const handleMapClick = useCallback(
    (latlng: L.LatLng) => {
      setClickedLocation(latlng);
      onMapClick && onMapClick(latlng);
    },
    [onMapClick]
  );

  // Handle search results
  const handleSearch = useCallback((result: { latLng: [number, number]; name: string }) => {
    setSearchResult(result);
  }, []);

  // Component to register map instance callback
  const MapInstanceHook = () => {
    const mapInstance = useMap();
    useEffect(() => {
      if (onMapInstance) {
        onMapInstance(mapInstance);
      }
    }, [mapInstance]);
    return null;
  };

  return (
    <div className={`advanced-map ${className}`} style={style}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%", background: "#0A0A1A" }}
        scrollWheelZoom={true}
        zoomControl={false}
        attributionControl={false}
        zoomSnap={0.5}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={80}
        maxBounds={[[0.0, 60.0], [40.0, 102.0]]}
        maxBoundsViscosity={0.8}
        zoomAnimation={true}
        fadeAnimation={true}
        markerZoomAnimation={true}
      >
        <MapInstanceHook />
        <MapCenterController center={center} zoom={zoom} />

        {/* Base tile layers */}
        {currentLayers.openstreetmap && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
        )}

        {currentLayers.satellite && (
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}

        {/* Map events */}
        <MapEvents onMapClick={handleMapClick} onLocationFound={(latlng) => setUserLocation([latlng.lat, latlng.lng])} />

        {/* Search control */}
        {enableSearch && <SearchControl onSearch={handleSearch} />}

        {/* Custom controls */}
        {enableControls && (
          <CustomControls onLocate={handleLocate} onToggleLayer={handleToggleLayer} layers={currentLayers} />
        )}

        {/* Markers with clustering */}
        {enableClustering ? (
          <MarkerClusterGroup>
            {markers.map((marker, index) => (
              <Marker
                key={marker.id || index}
                position={marker.position}
                icon={marker.icon || createCustomIcon(marker.color, marker.size)}
                eventHandlers={
                  marker.eventHandlers || {
                    click: () => onMarkerClick && onMarkerClick(marker),
                  }
                }
              >
                {marker.popup && (
                  <Popup>
                    <div className="text-zinc-900 dark:text-zinc-100 font-sans p-1">
                      <h3 className="font-bold text-xs uppercase text-cyan-600 dark:text-cyan-400">
                        {marker.popup.title}
                      </h3>
                      <div className="text-[11px] mt-1 text-zinc-700 dark:text-zinc-300">
                        {marker.popup.content}
                      </div>
                      {marker.popup.image && (
                        <img
                          src={marker.popup.image}
                          alt={marker.popup.title}
                          className="mt-2 rounded max-w-[180px] h-auto border border-zinc-200 dark:border-zinc-800"
                        />
                      )}
                    </div>
                  </Popup>
                )}
              </Marker>
            ))}
          </MarkerClusterGroup>
        ) : (
          markers.map((marker, index) => (
            <Marker
              key={marker.id || index}
              position={marker.position}
              icon={marker.icon || createCustomIcon(marker.color, marker.size)}
              eventHandlers={
                marker.eventHandlers || {
                  click: () => onMarkerClick && onMarkerClick(marker),
                }
              }
            >
              {marker.popup && (
                <Popup>
                  <div className="text-zinc-900 dark:text-zinc-100 font-sans p-1">
                    <h3 className="font-bold text-xs uppercase text-cyan-600 dark:text-cyan-400">
                      {marker.popup.title}
                    </h3>
                    <div className="text-[11px] mt-1 text-zinc-700 dark:text-zinc-300">
                      {marker.popup.content}
                    </div>
                  </div>
                </Popup>
              )}
            </Marker>
          ))
        )}

        {/* User location marker */}
        {userLocation && (
          <Marker position={userLocation} icon={createCustomIcon("red", "medium")}>
            <Popup>
              <div className="text-zinc-900 p-1 font-mono text-xs font-bold">YOUR LOCATION</div>
            </Popup>
          </Marker>
        )}

        {/* Search result marker */}
        {searchResult && (
          <Marker position={searchResult.latLng} icon={createCustomIcon("green", "large")}>
            <Popup>
              <div className="text-zinc-900 p-1 font-sans text-xs">
                <strong>SearchResult</strong>
                <p className="text-[10px] text-zinc-500 mt-0.5">{searchResult.name}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Clicked location marker */}
        {clickedLocation && (
          <Marker position={[clickedLocation.lat, clickedLocation.lng]} icon={createCustomIcon("orange", "small")}>
            <Popup>
              <div className="text-zinc-900 p-1 font-mono text-[10px]">
                LAT: {clickedLocation.lat.toFixed(6)}
                <br />
                LNG: {clickedLocation.lng.toFixed(6)}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Polygons */}
        {polygons.map((polygon, index) => (
          <Polygon
            key={polygon.id || index}
            positions={polygon.positions}
            pathOptions={polygon.style || { color: "purple", weight: 2, fillOpacity: 0.3 }}
          >
            {polygon.popup && (
              <Popup>
                <div className="text-zinc-900 p-1 text-xs">{polygon.popup}</div>
              </Popup>
            )}
          </Polygon>
        ))}

        {/* Circles */}
        {circles.map((circle, index) => (
          <Circle
            key={circle.id || index}
            center={circle.center}
            radius={circle.radius}
            pathOptions={circle.style || { color: "blue", weight: 2, fillOpacity: 0.2 }}
          >
            {circle.popup && (
              <Popup>
                <div className="text-zinc-900 p-1 text-xs">{circle.popup}</div>
              </Popup>
            )}
          </Circle>
        ))}

        {/* Polylines */}
        {polylines.map((polyline, index) => (
          <Polyline
            key={polyline.id || index}
            positions={polyline.positions}
            pathOptions={polyline.style || { color: "red", weight: 3 }}
          >
            {polyline.popup && (
              <Popup>
                <div className="text-zinc-900 p-1 text-xs">{polyline.popup}</div>
              </Popup>
            )}
          </Polyline>
        ))}
      </MapContainer>
    </div>
  );
};
