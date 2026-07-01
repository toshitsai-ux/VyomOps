import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Shield, List, AlertCircle, Sparkles, RefreshCw, Layers, CheckCircle, ShieldAlert, AlertTriangle, Play } from "lucide-react";
import { motion } from "motion/react";
import MapView from "../components/MapView";
import ScrambleText from "@/components/ui/scramble-text";

export default function Monitor() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [operatorOverrideMsg, setOperatorOverrideMsg] = useState("");

  // Operator selection for overriding Firestore status
  const [newStatus, setNewStatus] = useState("Active");
  const [newSeverity, setNewSeverity] = useState("Active");

  const fetchData = async () => {
    setRefreshing(true);
    try {
      // Fetch consolidated live alerts (Firestore public verified reports + USGS + GDACS)
      const alertsRes = await fetch("/api/live-alerts");
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }

      // Fetch all verified incidents from Firestore "incidents"
      const incidentsRes = await fetch("/api/incidents");
      if (incidentsRes.ok) {
        const list = await incidentsRes.json();
        setIncidents(list || []);
        
        // Auto-select first verified incident
        if (list && list.length > 0 && !selectedIncident) {
          setSelectedIncident(list[0]);
          setNewStatus(list[0].status || "Active");
          setNewSeverity(list[0].severity || "Active");
        }
      }
    } catch (err) {
      console.error("[CIVS Monitor] Fetch Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handler for Selecting Incidents on Globe or List
  const handleSelectIncident = (id: string) => {
    const matched = incidents.find((i) => i.id === id);
    if (matched) {
      setSelectedIncident(matched);
      setNewStatus(matched.status || "Active");
      setNewSeverity(matched.severity || "Active");
    } else {
      const alertMatch = alerts.find((a) => a.id === id);
      if (alertMatch) {
        setSelectedIncident(alertMatch);
      }
    }
  };

  // Submit operator override status to Firestore
  const handleOperatorOverride = async () => {
    if (!selectedIncident) return;
    setOperatorOverrideMsg("SUBMITTING COMMAND OVERRIDE...");
    try {
      const res = await fetch(`/api/incidents/${selectedIncident.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          severity: newSeverity
        })
      });
      if (res.ok) {
        setOperatorOverrideMsg("COMMAND OVERRIDE SUCCESSFUL.");
        setTimeout(() => setOperatorOverrideMsg(""), 3000);
        fetchData();
      } else {
        setOperatorOverrideMsg("OVERRIDE REJECTED BY ARCH.");
        setTimeout(() => setOperatorOverrideMsg(""), 3000);
      }
    } catch (err: any) {
      console.error(err);
      setOperatorOverrideMsg("CONNECTION ERROR SECURE.");
    }
  };

  return (
    <div className="min-h-screen deep-space-bg text-white font-sans flex flex-col justify-between overflow-x-hidden">
      
      {/* Dynamic Header */}
      <header className="sticky top-0 z-50 px-6 py-4 border-b border-zinc-800/50 bg-zinc-950/85 backdrop-blur-md flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center space-x-2.5">
          <Shield className="w-6 h-6 text-cyber-cyan" />
          <span className="font-orbitron font-black tracking-widest text-sm text-white">
            VYOMOPS <span className="text-cyber-cyan">LIVE MONITOR</span>
          </span>
        </Link>
        <div className="flex items-center space-x-4">
          <Link
            to="/report"
            className="px-3.5 py-1.5 rounded bg-cyber-cyan hover:bg-cyan-400 text-black font-orbitron text-xs font-bold transition-all"
          >
            NEW PUBLIC REPORT
          </Link>
          <button
            onClick={fetchData}
            disabled={refreshing}
            aria-label="Refresh data"
            className="p-1.5 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-all text-zinc-400 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-cyber-cyan" : ""}`} />
          </button>
        </div>
      </header>

      {/* Primary Dashboard Content Layout */}
      {loading ? (
        <div className="flex-grow flex flex-col items-center justify-center space-y-3 font-mono">
          <div className="w-8 h-8 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest">CONNECTING INTELLIGENCE FEED CHANNELS...</p>
        </div>
      ) : (
        <main className="flex-grow p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-7xl mx-auto">
          
          {/* Col 1: Live Feed List (3 Cols) */}
          <section className="lg:col-span-4 flex flex-col space-y-4">
            <div className="flex items-center justify-between font-mono border-b border-zinc-800/50 pb-2">
              <span className="text-xs uppercase font-bold text-zinc-400 flex items-center space-x-1.5">
                <List className="w-3.5 h-3.5 text-cyber-cyan" />
                <span>COMBINED THREAT FEED ({alerts.length})</span>
              </span>
              <span className="text-[10px] text-zinc-600">AUTO-REFRESH ACTIVE</span>
            </div>

            <div className="flex-grow overflow-y-auto max-h-[600px] pr-1 space-y-3">
              {alerts.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 font-mono text-xs border border-zinc-900 rounded bg-zinc-950/40">
                  NO ACTIVE INCIDENTS REPORTED IN SECURE SPACE CORRIDORS.
                </div>
              ) : (
                alerts.map((item) => {
                  const isSelected = selectedIncident && selectedIncident.id === item.id;
                  const isPublic = item.source === "Public Report";
                  return (
                    <motion.div
                      key={item.id}
                      onClick={() => handleSelectIncident(item.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-zinc-900/90 border-cyber-cyan shadow-[0_0_15px_rgba(0,229,255,0.08)]"
                          : "bg-zinc-950/50 border-zinc-800/50 hover:bg-zinc-900/40"
                      }`}
                    >
                      <div className="flex justify-between items-start space-x-2">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                          {new Date(item.detectedAt).toLocaleTimeString()} // {item.type}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-bold tracking-wider ${
                            isPublic
                              ? "bg-cyber-orange/15 text-cyber-orange border border-cyber-orange/20 animate-pulse"
                              : "bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/20"
                          }`}
                        >
                          {item.source}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-white mt-1.5">{item.title}</h3>
                      <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">{item.description}</p>

                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-900 text-[10px] font-mono text-zinc-500">
                        <span>CONFIDENCE</span>
                        <span className="text-cyber-cyan font-bold uppercase">{item.severityScore}</span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </section>

          {/* Col 2: Tactical Intelligence Leaflet Map (5 Cols) */}
          <section className="lg:col-span-5 flex flex-col space-y-4">
            <div className="flex items-center justify-between font-mono border-b border-zinc-800/50 pb-2">
              <span className="text-xs uppercase font-bold text-zinc-400 flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-cyber-cyan" />
                <span>TACTICAL INTELLIGENCE MAP</span>
              </span>
            </div>

            <div className="flex-grow min-h-[400px] lg:min-h-[500px] border border-zinc-800/40 rounded-lg overflow-hidden bg-zinc-950/40">
              <MapView
                incidents={incidents.map((i) => ({
                  id: i.id,
                  disaster_type: i.disaster_type,
                  title: i.title,
                  location: i.location || i.title || "Unknown Location",
                  lat: Number(i.lat),
                  lng: Number(i.lng),
                  severity: i.severity || "Active",
                  verification_score: i.verification_score || 80
                }))}
                onMarkerClick={handleSelectIncident}
                selectedId={selectedIncident ? selectedIncident.id : null}
              />
            </div>
          </section>

          {/* Col 3: Intel Analysis & Verification Metrics (3 Cols) */}
          <section className="lg:col-span-3 flex flex-col space-y-4">
            <div className="flex items-center justify-between font-mono border-b border-zinc-800/50 pb-2">
              <span className="text-xs uppercase font-bold text-zinc-400 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyber-cyan" />
                <span>COGNITIVE REPORT AUDIT</span>
              </span>
            </div>

            {selectedIncident ? (
              <div className="space-y-4 overflow-y-auto max-h-[600px] pr-1">
                {/* Visual Image if Public Report */}
                {selectedIncident.image_url && (
                  <div className="relative aspect-video rounded overflow-hidden border border-zinc-800 bg-zinc-950">
                    <img
                      src={selectedIncident.image_url}
                      alt="Telemetry Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-zinc-950/90 border border-zinc-800 text-[8px] font-mono font-bold uppercase text-cyber-cyan px-2 py-0.5 rounded">
                      TELEMETRY CORRIDOR PREVIEW
                    </div>
                  </div>
                )}

                {/* Detail Overview Card */}
                <div className="p-4 rounded border border-zinc-800/60 bg-zinc-950/40 space-y-3 font-mono text-xs">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">SECURE INCIDENT METADATA</div>
                  <div className="text-white font-sans text-sm font-bold">{selectedIncident.title}</div>
                  
                  <div className="space-y-1.5 text-[11px] text-zinc-400 font-sans border-b border-zinc-900 pb-2.5">
                    <div>{selectedIncident.description}</div>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-zinc-500">Source:</span>
                    <span className="text-zinc-300 font-bold">{selectedIncident.source}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-zinc-500">Telemetry Origin:</span>
                    <span className="text-zinc-300">{selectedIncident.location}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-zinc-500">WGS-84 Centroid:</span>
                    <span className="text-zinc-300">
                      {Number(selectedIncident.lat).toFixed(3)}°N, {Number(selectedIncident.lng).toFixed(3)}°E
                    </span>
                  </div>

                  {selectedIncident.source === "Public Report" && (
                    <div className="pt-2 border-t border-zinc-900 space-y-1">
                      <span className="text-cyber-cyan font-bold block uppercase text-[10px]">
                        AI VERACITY VALIDATION SCORE
                      </span>
                      <div className="flex justify-between items-center bg-zinc-950 p-2 rounded border border-zinc-900">
                        <span className="text-[11px]">Combined Rating:</span>
                        <span className="text-cyber-cyan font-bold text-sm">
                          {selectedIncident.verification_score}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recommended Checklists */}
                {selectedIncident.recommended_checklist && selectedIncident.recommended_checklist.length > 0 && (
                  <div className="p-4 rounded border border-zinc-800/60 bg-zinc-950/40 space-y-3">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                      CIVIL DEFENSE RESPONSE PROTOCOLS
                    </div>
                    <ul className="space-y-2 list-decimal pl-4 text-xs text-zinc-300">
                      {selectedIncident.recommended_checklist.map((step: string, idx: number) => (
                        <li key={idx} className="leading-relaxed">{step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Operator status override panel */}
                {selectedIncident.source === "Public Report" && (
                  <div className="p-4 rounded border border-cyber-cyan/30 bg-zinc-950/85 space-y-3 font-mono text-xs shadow-[0_0_15px_rgba(0,229,255,0.04)]">
                    <div className="text-[10px] text-cyber-cyan font-bold uppercase tracking-wider">
                      OPERATOR OVERRIDE MATRIX
                    </div>

                    <div className="space-y-2">
                      <div className="space-y-1">
                        <span className="text-[9px] text-zinc-500 block">TACTICAL STATUS</span>
                        <select
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 p-1.5 rounded focus:outline-none focus:border-cyber-cyan"
                        >
                          <option value="Active">Active</option>
                          <option value="Cleared">Cleared</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] text-zinc-500 block">THREAT SEVERITY LEVEL</span>
                        <select
                          value={newSeverity}
                          onChange={(e) => setNewSeverity(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 p-1.5 rounded focus:outline-none focus:border-cyber-cyan"
                        >
                          <option value="Active">Active</option>
                          <option value="Critical">Critical</option>
                          <option value="Cleared">Cleared</option>
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={handleOperatorOverride}
                      className="w-full py-2 bg-cyber-cyan hover:bg-cyan-400 text-black font-orbitron font-extrabold tracking-wider rounded text-[10px] transition-all"
                    >
                      COMMIT DIRECT OVERRIDE
                    </button>

                    {operatorOverrideMsg && (
                      <div className="text-[9px] text-cyber-cyan text-center pt-1 tracking-widest uppercase animate-pulse">
                        {operatorOverrideMsg}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-zinc-500 font-mono text-xs border border-zinc-900 rounded bg-zinc-950/40">
                SELECT AN INCIDENT TO LOAD SECURE SPECTRUM METRICS & CIVIL PROTOCOLS.
              </div>
            )}
          </section>

        </main>
      )}

      {/* Security Status Info footer */}
      <footer className="py-5 border-t border-zinc-900 bg-zinc-950 text-center font-mono text-[10px] text-zinc-600 space-y-1">
        <div>VYOMOPS COGNITIVE OPERATIONS MATRIX // SENTINEL CORE 3.5-FLASH // INDIA SECURE GRID</div>
        <div className="flex justify-center space-x-4 pt-1 text-zinc-500">
          <span>SECURE END-TO-END</span>
          <span>•</span>
          <span>REAL-TIME COGNITIVE SYNC LOGGED</span>
        </div>
      </footer>
    </div>
  );
}
