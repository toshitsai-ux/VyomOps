import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Upload, MapPin, Calendar, AlertTriangle, CheckCircle, RefreshCw, FileText, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import ScrambleText from "@/components/ui/scramble-text";

export default function Report() {
  const [locationName, setLocationName] = useState("");
  const [lat, setLat] = useState<number | "">("");
  const [lng, setLng] = useState<number | "">("");
  const [disasterType, setDisasterType] = useState("Flood");
  const [description, setDescription] = useState("");
  const [dateObserved, setDateObserved] = useState(new Date().toISOString().substring(0, 16));
  const [base64Images, setBase64Images] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [resolvingCoords, setResolvingCoords] = useState(false);

  // Submission / Verification Pipeline Statuses
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [newReportId, setNewReportId] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  // Verification Engine V2 Progress Polling
  const [progressPercent, setProgressPercent] = useState(10);
  const [progressStage, setProgressStage] = useState("upload");
  const [progressText, setProgressText] = useState("Report submitted.");

  // Address Geocoding Action via OSM Nominatim
  const handleResolveCoords = async () => {
    if (!locationName.trim()) return;
    setResolvingCoords(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`, {
        headers: { "User-Agent": "VyomOps-CIVS/1.0" }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const matched = data[0];
          setLat(parseFloat(matched.lat));
          setLng(parseFloat(matched.lon));
          setLocationName(matched.display_name);
        } else {
          alert("Location could not be geocoded. Please enter manual coordinates.");
        }
      }
    } catch (err) {
      console.error("[CIVS Geocoder] Error resolving coordinates:", err);
    } finally {
      setResolvingCoords(false);
    }
  };

  // Image Upload File Handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const processFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        alert("Only image files are allowed for disaster verification.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setBase64Images((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeImage = (index: number) => {
    setBase64Images((prev) => prev.filter((_, i) => i !== index));
  };

  // Submission & Pipeline Trigger Action
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationName || lat === "" || lng === "" || !disasterType || !description) {
      alert("Please fulfill all reporting criteria coordinates, and descriptions.");
      return;
    }

    setIsSubmitting(true);
    setProgressPercent(10);
    setProgressStage("upload");
    setProgressText("Uploading evidence and registering with secure core...");
    setSubmitSuccess(false);

    try {
      // 1. Submit public report to Firestore via API
      const reportRes = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: locationName,
          lat,
          lng,
          disaster_type: disasterType,
          description,
          date_observed: new Date(dateObserved).toISOString(),
          images: base64Images
        })
      });

      if (!reportRes.ok) {
        throw new Error("Failed to submit report metadata to secure core.");
      }

      const reportData = await reportRes.json();
      const reportId = reportData.reportId;
      setNewReportId(reportId);

      // 2. Start polling for status changes (Every 1.5 seconds)
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/report/${reportId}/status`);
          if (res.ok) {
            const data = await res.json();
            setProgressPercent(data.progress?.percent ?? 10);
            setProgressStage(data.progress?.stage ?? "upload");
            setProgressText(data.progress?.text ?? "Processing...");
            
            if (data.status !== "Processing") {
              clearInterval(pollInterval);
              setVerificationResult(data.verification_result);
              setSubmitSuccess(true);
              setIsSubmitting(false);
            }
          } else {
            clearInterval(pollInterval);
            console.error("Verification status fetch returned non-200.");
          }
        } catch (err: any) {
          clearInterval(pollInterval);
          console.error("[CIVS Polling Error]:", err);
          setIsSubmitting(false);
        }
      }, 1500);

    } catch (err: any) {
      console.error("[CIVS Submission Error]:", err);
      alert(`Submission error: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setLocationName("");
    setLat("");
    setLng("");
    setDescription("");
    setBase64Images([]);
    setVerificationResult(null);
    setNewReportId(null);
    setSubmitSuccess(false);
    setProgressPercent(10);
    setProgressStage("upload");
    setProgressText("Report submitted.");
  };

  return (
    <div className="min-h-screen deep-space-bg text-white font-sans flex flex-col justify-between overflow-x-hidden">
      
      {/* Tactical Glass Header */}
      <header className="sticky top-0 z-50 px-6 py-4 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2.5">
          <Shield className="w-6 h-6 text-cyber-cyan" />
          <span className="font-orbitron font-black tracking-widest text-sm text-white">
            VYOMOPS <span className="text-cyber-cyan">CIVS</span>
          </span>
        </Link>
        <Link
          to="/login"
          className="px-4 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono tracking-wider transition-all"
        >
          OPERATOR HUB
        </Link>
      </header>

      {/* Main Core Viewport */}
      <main className="flex-grow w-full max-w-4xl mx-auto px-6 py-12 flex flex-col items-center justify-center">
        {isSubmitting ? (
          /* High-Contrast Progress Bar & Diagnostic Checklist */
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full ops-card p-8 md:p-10 rounded-xl space-y-8"
          >
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded bg-cyber-cyan/10 border border-cyber-cyan/20 text-[10px] font-mono text-cyber-cyan uppercase tracking-widest animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>SENTINEL CORE DEPLOYED</span>
              </div>
              <h2 className="font-orbitron text-2xl font-black text-white tracking-wider">
                TACTICAL VERIFICATION IN PROGRESS
              </h2>
              <p className="text-xs text-zinc-400 font-mono">REPORT ID: {newReportId || "INITIALIZING..."}</p>
            </div>

            {/* Tactical Animated Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-zinc-400">
                <span>PROGRESS MATRIX</span>
                <span className="text-cyber-cyan font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyber-cyan"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[11px] font-mono text-center text-zinc-500 italic mt-1">{progressText}</p>
            </div>

            {/* Diagnostic Stage Checklist */}
            <div className="border border-zinc-800 rounded-lg bg-zinc-950/60 p-6 space-y-4 font-mono text-xs">
              <span className="text-zinc-500 uppercase block font-bold border-b border-zinc-800 pb-2 tracking-wider">
                ENGINE PIPELINE RUNTIME
              </span>
              <div className="space-y-4 pt-1">
                {/* Stage 1: Upload */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 flex items-center justify-center">
                      {progressPercent > 20 ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : progressStage === "upload" ? (
                        <RefreshCw className="w-4 h-4 text-cyber-cyan animate-spin" />
                      ) : (
                        <div className="w-1.5 h-1.5 bg-zinc-800 rounded-full" />
                      )}
                    </div>
                    <span className={`${progressPercent >= 20 ? "text-zinc-300 font-medium" : "text-zinc-600"}`}>
                      1. Uploading evidence and metadata
                    </span>
                  </div>
                  <span className={`text-[10px] ${progressPercent >= 20 ? "text-emerald-400" : "text-zinc-600"}`}>
                    {progressPercent > 20 ? "DONE" : progressStage === "upload" ? "ACTIVE" : "PENDING"}
                  </span>
                </div>

                {/* Stage 2: OpenCV */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 flex items-center justify-center">
                      {progressPercent > 40 ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : progressStage === "analyzing" ? (
                        <RefreshCw className="w-4 h-4 text-cyber-cyan animate-spin" />
                      ) : (
                        <div className="w-1.5 h-1.5 bg-zinc-800 rounded-full" />
                      )}
                    </div>
                    <span className={`${progressPercent >= 40 ? "text-zinc-300 font-medium" : "text-zinc-600"}`}>
                      2. Analyzing image authenticity (OpenCV)
                    </span>
                  </div>
                  <span className={`text-[10px] ${progressPercent >= 40 ? "text-emerald-400" : "text-zinc-600"}`}>
                    {progressPercent > 40 ? "DONE" : progressStage === "analyzing" ? "ACTIVE" : "PENDING"}
                  </span>
                </div>

                {/* Stage 3: AI Cognitive */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 flex items-center justify-center">
                      {progressPercent > 60 ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : progressStage === "ai_verification" ? (
                        <RefreshCw className="w-4 h-4 text-cyber-cyan animate-spin" />
                      ) : (
                        <div className="w-1.5 h-1.5 bg-zinc-800 rounded-full" />
                      )}
                    </div>
                    <span className={`${progressPercent >= 60 ? "text-zinc-300 font-medium" : "text-zinc-600"}`}>
                      3. Multivariant AI patterns and relevance
                    </span>
                  </div>
                  <span className={`text-[10px] ${progressPercent >= 60 ? "text-emerald-400" : "text-zinc-600"}`}>
                    {progressPercent > 60 ? "DONE" : progressStage === "ai_verification" ? "ACTIVE" : "PENDING"}
                  </span>
                </div>

                {/* Stage 4: Cross-Referencing */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 flex items-center justify-center">
                      {progressPercent > 85 ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : progressStage === "cross_referencing" ? (
                        <RefreshCw className="w-4 h-4 text-cyber-cyan animate-spin" />
                      ) : (
                        <div className="w-1.5 h-1.5 bg-zinc-800 rounded-full" />
                      )}
                    </div>
                    <span className={`${progressPercent >= 85 ? "text-zinc-300 font-medium" : "text-zinc-600"}`}>
                      4. Cross-referencing global disaster records
                    </span>
                  </div>
                  <span className={`text-[10px] ${progressPercent >= 85 ? "text-emerald-400" : "text-zinc-600"}`}>
                    {progressPercent > 85 ? "DONE" : progressStage === "cross_referencing" ? "ACTIVE" : "PENDING"}
                  </span>
                </div>

                {/* Stage 5: Final Check */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 flex items-center justify-center">
                      {progressPercent === 100 ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <div className="w-1.5 h-1.5 bg-zinc-800 rounded-full" />
                      )}
                    </div>
                    <span className={`${progressPercent === 100 ? "text-zinc-300 font-medium" : "text-zinc-600"}`}>
                      5. Veracity scoring and civil defense dispatch
                    </span>
                  </div>
                  <span className={`text-[10px] ${progressPercent === 100 ? "text-emerald-400" : "text-zinc-600"}`}>
                    {progressPercent === 100 ? "DONE" : "PENDING"}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : !submitSuccess ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full ops-card p-8 md:p-10 rounded-xl space-y-8"
          >
            {/* Scrambled Visual Identity Header */}
            <div className="text-center space-y-2">
              <h1 className="font-orbitron text-2xl md:text-3xl font-black tracking-wider text-white">
                <ScrambleText text="INCIDENT REPORTING TERMINAL" />
              </h1>
              <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest max-w-xl mx-auto">
                CROWD-SOURCED DISASTER INTELLIGENCE VERIFICATION SYSTEM (CIVS)
              </p>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-6">
              
              {/* Grid: Disaster Type & Timestamp */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                    Disaster Category
                  </label>
                  <select
                    value={disasterType}
                    onChange={(e) => setDisasterType(e.target.value)}
                    className="w-full px-4 py-2.5 rounded bg-zinc-950 border border-zinc-800 text-sm focus:border-cyber-cyan focus:outline-none transition-all"
                  >
                    <option value="Flood">Flood / River Overflow</option>
                    <option value="Landslide">Landslide / Mudflow</option>
                    <option value="Earthquake">Earthquake / Seismic Movement</option>
                    <option value="Tropical Cyclone">Tropical Cyclone / Storm Surge</option>
                    <option value="Wildfire">Wildfire / Forest Fire</option>
                    <option value="Cloudburst">Cloudburst / Flash Inundation</option>
                    <option value="Chemical Spill">Industrial Hazard / Spill</option>
                    <option value="Other">Other Extreme Event</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                    Observation Timestamp
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                    <input
                      type="datetime-local"
                      value={dateObserved}
                      onChange={(e) => setDateObserved(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm focus:border-cyber-cyan focus:outline-none text-zinc-300"
                    />
                  </div>
                </div>
              </div>

              {/* Geocoding Interface */}
              <div className="space-y-2.5">
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                  Observation Location
                </label>
                <div className="flex space-x-2">
                  <div className="relative flex-grow">
                    <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="e.g. Chooralmala, Wayanad, Kerala, India"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm focus:border-cyber-cyan focus:outline-none text-zinc-300"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleResolveCoords}
                    disabled={resolvingCoords || !locationName.trim()}
                    className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-mono text-cyber-cyan rounded flex items-center space-x-2 disabled:opacity-40 transition-all"
                  >
                    {resolvingCoords ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "GEOCODE"
                    )}
                  </button>
                </div>

                {/* Grid Latitude / Longitude */}
                <div className="grid grid-cols-2 gap-4 pt-1.5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">LATITUDE (WGS-84)</span>
                    <input
                      type="number"
                      step="any"
                      value={lat}
                      onChange={(e) => setLat(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      required
                      placeholder="e.g. 11.528"
                      className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-900 rounded text-xs font-mono text-zinc-300 focus:outline-none focus:border-cyber-cyan"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">LONGITUDE (WGS-84)</span>
                    <input
                      type="number"
                      step="any"
                      value={lng}
                      onChange={(e) => setLng(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      required
                      placeholder="e.g. 76.142"
                      className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-900 rounded text-xs font-mono text-zinc-300 focus:outline-none focus:border-cyber-cyan"
                    />
                  </div>
                </div>
              </div>

              {/* Narrative description */}
              <div className="space-y-2">
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                  Narrative Description
                </label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                  <textarea
                    rows={4}
                    placeholder="Provide details about terrain displacement, water levels, casualty risks, structural damages, or active road blockages..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm focus:border-cyber-cyan focus:outline-none text-zinc-300"
                  />
                </div>
              </div>

              {/* Drag-and-drop base64 image uploader */}
              <div className="space-y-2.5">
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                  On-Scene Photographic Evidence
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center space-y-2 cursor-pointer transition-all ${
                    dragActive
                      ? "border-cyber-cyan bg-cyber-cyan/5"
                      : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40"
                  }`}
                >
                  <Upload className="w-8 h-8 text-zinc-500" />
                  <p className="text-xs font-medium text-zinc-300 text-center">
                    Drag and drop your on-scene photos here, or{" "}
                    <label className="text-cyber-cyan underline cursor-pointer hover:text-cyan-300">
                      browse
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </p>
                  <p className="text-[10px] text-zinc-600 font-mono">JPG, PNG, WEBP // MAX 10MB EACH</p>
                </div>

                {/* Uploaded Images Preview */}
                {base64Images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 pt-3">
                    {base64Images.map((img, idx) => (
                      <div key={idx} className="relative group aspect-square rounded overflow-hidden border border-zinc-800 bg-zinc-950">
                        <img src={img} alt="Evidence" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-mono text-xs font-bold"
                        >
                          DELETE
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Trigger Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-cyber-cyan hover:bg-cyan-400 text-black font-orbitron font-extrabold tracking-widest rounded flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                <span>SUBMIT & VERIFY INCIDENT</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        ) : !submitSuccess ? (
          /* Fallback view (should not be active during successful flow) */
          <div className="text-center p-6 text-zinc-500 font-mono">Initializing reporting interface...</div>
        ) : (
          /* Verification Success Screen (Results Card) */
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full ops-card p-8 md:p-10 rounded-xl space-y-8"
          >
            <div className="text-center space-y-2">
              <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 mb-2">
                {verificationResult.status === "Verified" ? (
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                ) : verificationResult.status === "Fake" ? (
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-amber-500" />
                )}
              </div>
              <h2 className="font-orbitron text-2xl font-black tracking-wider uppercase">
                {verificationResult.status === "Verified" && (
                  <span className="text-emerald-400 animate-pulse">SENTINEL-AI VERIFIED REPORT</span>
                )}
                {verificationResult.status === "Fake" && (
                  <span className="text-red-500">TACTICAL ALERT: REPORT FLAGGED AS FAKE</span>
                )}
                {verificationResult.status === "Inconclusive" && (
                  <span className="text-amber-500">REPORT INCONCLUSIVE</span>
                )}
              </h2>
              <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest">
                CIVS SECURITY REPORT ID: <span className="text-cyber-cyan">{newReportId}</span>
              </p>
            </div>

            {/* VERACITY STATS GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-lg text-center space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">IMAGE AUTHENTICITY</span>
                <span className="text-lg font-mono font-bold text-zinc-200">{verificationResult.opencv_score}%</span>
                <span className="text-[9px] font-mono text-zinc-600 block">OpenCV Analysis</span>
              </div>
              <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-lg text-center space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">AI DETECTION</span>
                <span className={`text-sm font-mono font-bold block py-1 uppercase ${verificationResult.ai_detected ? "text-red-400" : "text-emerald-400"}`}>
                  {verificationResult.ai_detected ? "SUSPECT AI" : "CLEAN"}
                </span>
                <span className="text-[9px] font-mono text-zinc-600 block">Neural Pattern Check</span>
              </div>
              <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-lg text-center space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">DISASTER RELEVANCE</span>
                <span className="text-lg font-mono font-bold text-zinc-200">{verificationResult.relevance_score}%</span>
                <span className="text-[9px] font-mono text-zinc-600 block">Relevance Score</span>
              </div>
              <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-lg text-center space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">COGNITIVE CONFIDENCE</span>
                <span className="text-lg font-mono font-bold text-zinc-200">{verificationResult.gemini_score}%</span>
                <span className="text-[9px] font-mono text-zinc-600 block">Gemini 3.5-Flash</span>
              </div>
            </div>

            {/* COMBINED STATUS CORE */}
            <div className="border border-zinc-800 rounded bg-zinc-950/60 p-6 space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500 uppercase font-bold">INTELLIGENCE COMBINED SCORE</span>
                <span className="text-cyber-cyan text-lg font-black">{verificationResult.final_score}%</span>
              </div>

              {/* WEB CROSS-REFERENCE / OLD INCIDENT DETECT */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500 uppercase">WEB CROSS-REFERENCE</span>
                <span className={`font-bold px-2 py-0.5 rounded ${verificationResult.old_incident ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}>
                  {verificationResult.old_incident ? "OLD INCIDENT DETECTED" : "NEW UNIQUE EVENT"}
                </span>
              </div>
              {verificationResult.old_incident && (
                <div className="bg-red-500/5 border border-red-500/10 rounded p-3 text-red-400 text-[11px] leading-relaxed">
                  <strong>Source Match:</strong> {verificationResult.old_incident_source || "Historical Disaster Archive Match"}
                </div>
              )}

              <div className="space-y-1">
                <span className="text-zinc-500 uppercase font-bold">SENTINEL-AI ANALYTIC REASONING:</span>
                <p className="text-zinc-300 leading-relaxed text-[11px] font-sans pt-1">
                  {verificationResult.gemini_reasoning}
                </p>
              </div>

              {verificationResult.recommended_checklist && verificationResult.recommended_checklist.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-zinc-800">
                  <span className="text-zinc-500 uppercase block font-bold">TACTICAL CIVIL DEFENSE CHECKLIST:</span>
                  <ul className="space-y-2 pl-4 list-decimal text-zinc-400 font-sans text-xs">
                    {verificationResult.recommended_checklist.map((item: string, idx: number) => (
                      <li key={idx} className="leading-relaxed">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
              <button
                onClick={handleResetForm}
                className="flex-grow py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-mono text-zinc-400 rounded transition-all uppercase tracking-wider font-bold"
              >
                SUBMIT ANOTHER REPORT
              </button>
              <Link
                to="/monitor"
                className="flex-grow py-3 bg-cyber-cyan hover:bg-cyan-400 text-black text-center font-orbitron text-xs font-black rounded flex items-center justify-center space-x-1.5 transition-all uppercase tracking-wider"
              >
                <span>OPEN LIVE MONITOR</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </main>

      {/* Security notice footer */}
      <footer className="py-6 border-t border-zinc-900 bg-zinc-950 text-center font-mono text-[10px] text-zinc-600 space-y-1">
        <div>VYOMOPS COGNITIVE INTEL NETWORK // SENTINEL CORE 3.5-FLASH</div>
        <div className="flex justify-center space-x-4 pt-1 text-zinc-500">
          <span>SECURE END-TO-END</span>
          <span>•</span>
          <span>OPENCV EDGE FILTER ACTIVE</span>
        </div>
      </footer>
    </div>
  );
}
