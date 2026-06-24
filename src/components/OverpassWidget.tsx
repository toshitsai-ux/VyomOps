import React, { useEffect, useState, useRef } from "react";
import { calculateNextOverpass, OverpassDetails } from "../utils/orbital";
import { RefreshCcw, Orbit, AlertCircle, Compass, Radio } from "lucide-react";
import ScrambleText from "@/components/ui/scramble-text";

interface OverpassWidgetProps {
  latitude: number;
  longitude: number;
  locationName?: string;
}

export default function OverpassWidget({ latitude, longitude, locationName = "Current Focus Vector" }: OverpassWidgetProps) {
  const [overpass, setOverpass] = useState<OverpassDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorStr, setErrorStr] = useState<string | null>(null);
  const [countdownStr, setCountdownStr] = useState<string>("00:00:00");
  const [satelliteId, setSatelliteId] = useState<number>(40053); // Sentinel-2A = 40053, Landsat 8 = 39084

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to run overpass calculation
  const updateOverpassPrediction = async (satId: number) => {
    setLoading(true);
    setErrorStr(null);
    try {
      const details = await calculateNextOverpass(latitude, longitude, satId);
      setOverpass(details);
    } catch (err: any) {
      console.error("Overpass update failed:", err);
      setErrorStr(err.message || "Tracking system offline");
      setOverpass(null);
    } finally {
      setLoading(false);
    }
  };

  // Trigger calculations whenever Coordinates or Selected Satellite changes
  useEffect(() => {
    updateOverpassPrediction(satelliteId);
  }, [latitude, longitude, satelliteId]);

  // Handle countdown calculations
  useEffect(() => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    if (!overpass) {
      setCountdownStr("00:00:00");
      return;
    }

    const nextPassMs = new Date(overpass.nextPassTime).getTime();

    const updateCountdown = () => {
      const diffMs = nextPassMs - Date.now();
      if (diffMs <= 0) {
        setCountdownStr("OVERPASS ACTIVE");
        // Re-calculate after overpass window ends (e.g. after duration)
        setTimeout(() => {
          updateOverpassPrediction(satelliteId);
        }, 15000);
        return;
      }

      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);

      const hStr = hours.toString().padStart(2, "0");
      const mStr = minutes.toString().padStart(2, "0");
      const sStr = seconds.toString().padStart(2, "0");

      setCountdownStr(`${hStr}:${mStr}:${sStr}`);
    };

    updateCountdown();
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [overpass]);

  const selectSatellite = (satId: number) => {
    setSatelliteId(satId);
  };

  const getVisibilityBadge = (elevation: number) => {
    if (elevation >= 35) return { text: "Optimal Zenith", color: "text-emerald-400 bg-emerald-400/5 border-emerald-400/20" };
    if (elevation >= 15) return { text: "Standard Pass", color: "text-amber-400 bg-amber-400/5 border-amber-400/20" };
    return { text: "Low Horizon", color: "text-zinc-500 bg-zinc-500/5 border-zinc-500/20" };
  };

  const badge = overpass ? getVisibilityBadge(overpass.maxElevationDegrees) : null;

  return (
    <div className="ops-card p-4 rounded-xl border border-white/10 space-y-4 bg-black/40">
      
      {/* HUD Panel Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <Orbit className="w-4 h-4 text-[#00E5FF] animate-spin" style={{ animationDuration: "14s" }} />
          <div>
            <h3 className="font-orbitron font-extrabold text-[11px] tracking-widest text-[#00E5FF] uppercase">
              LIVE OVERPASS TRACKING
            </h3>
            <p className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider">
              Real-time Orbital Pass Computation
            </p>
          </div>
        </div>

        {/* Satellite Selection Selector */}
        <div className="flex items-center gap-1.5 border border-white/5 bg-black/40 p-0.5 rounded-lg text-[8px] font-mono">
          <button
            type="button"
            onClick={() => selectSatellite(40053)}
            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
              satelliteId === 40053 ? "bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20 font-bold" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            S2_A
          </button>
          <button
            type="button"
            onClick={() => selectSatellite(39084)}
            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
              satelliteId === 39084 ? "bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20 font-bold" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            L8_RECON
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <RefreshCcw className="w-5 h-5 text-[#00E5FF] animate-spin" />
          <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
            CORRELATING ORBITAL NODES...
          </span>
        </div>
      ) : errorStr ? (
        <div className="flex items-center gap-2.5 p-3 rounded-xl border border-red-500/10 bg-red-500/[0.02] text-zinc-500 font-mono text-[9px] uppercase tracking-wider justify-center">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span>{errorStr} (TRACKING UNAVAILABLE)</span>
        </div>
      ) : overpass ? (
        <div className="space-y-3.5">
          {/* Main big countdown */}
          <div className="text-center py-2 bg-black/30 border border-white/5 rounded-xl space-y-1 relative overflow-hidden">
            <span className="block text-[8px] font-mono text-zinc-500 tracking-wider font-semibold uppercase">
              NEXT INTERCEPT WINDOW CLOSE COUNTDOWN
            </span>
            <span className="font-mono text-xl sm:text-2xl font-black text-[#00E5FF] tracking-widest block tabular-nums animate-pulse">
              {countdownStr}
            </span>
            <div className="flex items-center justify-center gap-1 text-[8px] text-zinc-400 uppercase font-mono">
              <Compass className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Target: {locationName.length > 20 ? `${locationName.substring(0, 18)}...` : locationName}</span>
            </div>
          </div>

          {/* Sub-HUD Readouts Grid */}
          <div className="grid grid-cols-2 gap-3 font-mono text-[9px]">
            <div className="p-2 border border-white/5 rounded-lg space-y-1">
              <span className="block text-[8px] text-zinc-500 uppercase tracking-wider">ACTIVE PLATFORM</span>
              <span className="block font-bold text-white uppercase">{overpass.satelliteName}</span>
            </div>

            <div className="p-2 border border-white/5 rounded-lg space-y-1">
              <span className="block text-[8px] text-zinc-500 uppercase tracking-wider">ZENITH PASS HEIGHT</span>
              <span className="block font-bold text-white">{overpass.altitudeKm} KM</span>
            </div>

            <div className="p-2 border border-white/5 rounded-lg space-y-1">
              <span className="block text-[8px] text-zinc-500 uppercase tracking-wider">NEXT CROSS TIME</span>
              <span className="block font-bold text-white">
                {new Date(overpass.nextPassTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>

            <div className="p-2 border border-white/5 rounded-lg space-y-1">
              <span className="block text-[8px] text-zinc-500 uppercase tracking-wider">MAX ELEVATION</span>
              <span className="block font-bold text-white">{overpass.maxElevationDegrees}° (ELEV)</span>
            </div>
          </div>

          {/* Visibility Index Status */}
          {badge && (
            <div className="flex items-center justify-between border border-white/5 p-2 rounded-lg bg-black/20 text-[9px] font-mono">
              <span className="text-zinc-500 uppercase">VISIBILITY ASSESSMENT</span>
              <span className={`px-2 py-0.5 rounded border uppercase text-[8px] font-bold ${badge.color}`}>
                {badge.text}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 text-zinc-500 font-mono text-[9px] uppercase">
          Select an active target vector to initialize orbit tracker.
        </div>
      )}
    </div>
  );
}
