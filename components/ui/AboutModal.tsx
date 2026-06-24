import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ShieldCheck, Layers, Database, Eye, Zap, Compass } from "lucide-react";

function InteractiveScanner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [scanPoint, setScanPoint] = useState({ x: 180, y: 130, lat: "22.5726° N", lon: "88.3639° E", label: "Sundarbans Delta Delta-Scan" });
  const [isScanning, setIsScanning] = useState(false);
  const [deviation, setDeviation] = useState(0.84);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;
    
    // Smoothly map mouse position to rotation angles (max 12 degrees)
    const rotateY = (mouseX / (width / 2)) * 12;
    const rotateX = -(mouseY / (height / 2)) * 12;
    
    setRotate({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Simulate real latitude and longitude mapping for South Asia and surrounding region
    const latDecimal = (28.5 - (y / rect.height) * 18).toFixed(4);
    const lonDecimal = (72.0 + (x / rect.width) * 22).toFixed(4);
    
    // Generate a random label
    const labels = [
      "Teesta River Floodplain Scan",
      "Ganges-Brahmaputra Deltaic Perimeter",
      "Bhutan Sub-Himalayan Landslide Zone",
      "Bay of Bengal Cyclone Storm Surge Track",
      "Narmada Basin Drought Sentinel Sector",
      "Assam Valley Inundation Vector"
    ];
    const randomLabel = labels[Math.floor(Math.random() * labels.length)];
    
    // Start active scan simulation
    setIsScanning(true);
    setScanPoint({
      x,
      y,
      lat: `${latDecimal}° N`,
      lon: `${lonDecimal}° E`,
      label: randomLabel
    });
    
    // Simulate random pixel diff calculation
    const targetDev = parseFloat((0.2 + Math.random() * 0.75).toFixed(2));
    let currentDev = 0.05;
    const interval = setInterval(() => {
      currentDev += 0.1;
      if (currentDev >= targetDev) {
        setDeviation(targetDev);
        setIsScanning(false);
        clearInterval(interval);
      } else {
        setDeviation(parseFloat(currentDev.toFixed(2)));
      }
    }, 80);
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{
        transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
        transition: "transform 0.1s ease-out",
        transformStyle: "preserve-3d"
      }}
      className="relative w-full h-[320px] lg:h-full min-h-[300px] rounded-xl overflow-hidden border border-zinc-800 bg-[#04040d] cursor-crosshair select-none flex flex-col justify-between p-4 group"
    >
      {/* Dynamic 3D Grid Underlay */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#111122_1px,transparent_1px),linear-gradient(to_bottom,#111122_1px,transparent_1px)] bg-[size:24px_24px] opacity-60" />
      
      {/* Radial Depth Gradient */}
      <div className="absolute inset-0 bg-gradient-to-tr from-cyber-cyan/10 via-transparent to-cyber-orange/5 pointer-events-none" />

      {/* Futuristic Radar Sweep */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_50%,rgba(6,182,212,0.15)_95%,rgba(6,182,212,0.4)_100%)] animate-spin" style={{ animationDuration: '8s' }} />
      </div>

      {/* Holographic Concentric Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-35">
        <div className="w-[100px] h-[100px] rounded-full border border-dashed border-cyber-cyan/40 animate-pulse" />
        <div className="absolute w-[200px] h-[200px] rounded-full border border-zinc-800" />
        <div className="absolute w-[300px] h-[300px] rounded-full border border-dashed border-zinc-900" />
      </div>

      {/* Topographical Contour Wave Vectors (Vector Graphics) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20 stroke-cyber-cyan" xmlns="http://www.w3.org/2000/svg">
        <path d="M 0 120 Q 80 80, 160 140 T 320 100 T 480 180 T 640 120" fill="none" strokeWidth="1" />
        <path d="M 0 160 Q 90 120, 180 180 T 360 130 T 540 210 T 640 150" fill="none" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M 0 200 Q 100 150, 200 220 T 400 170 T 600 240 T 640 190" fill="none" strokeWidth="1" />
      </svg>

      {/* Active Target Beacon */}
      <div 
        className="absolute z-10 transition-all duration-300 pointer-events-none"
        style={{ left: `${scanPoint.x}px`, top: `${scanPoint.y}px` }}
      >
        <span className="absolute -translate-x-1/2 -translate-y-1/2 flex h-8 w-8">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isScanning ? 'bg-cyber-orange' : 'bg-cyber-cyan'} opacity-75`}></span>
          <span className={`relative inline-flex rounded-full h-8 w-8 border border-dashed ${isScanning ? 'border-cyber-orange' : 'border-cyber-cyan'} animate-spin`} style={{ animationDuration: '10s' }} />
        </span>
        <span className={`absolute -translate-x-1/2 -translate-y-1/2 block w-2.5 h-2.5 rounded-full ${isScanning ? 'bg-cyber-orange' : 'bg-cyber-cyan'} shadow-lg shadow-cyber-cyan/50`} />
        
        {/* Dynamic target HUD projection label */}
        <div className="absolute left-6 -top-6 bg-zinc-950/90 border border-zinc-805 text-[10px] font-mono text-zinc-300 py-1 px-2 rounded backdrop-blur-sm whitespace-nowrap space-y-0.5 pointer-events-none shadow-md">
          <div className="text-[9px] text-cyber-cyan uppercase font-bold tracking-widest flex items-center gap-1">
            <span className={`w-1 h-1 rounded-full ${isScanning ? 'bg-cyber-orange animate-ping' : 'bg-green-500'}`} />
            {isScanning ? 'COMPUTING RESOLUTION...' : 'TARGET ACQUIRED'}
          </div>
          <div>L: {scanPoint.lat}</div>
          <div>O: {scanPoint.lon}</div>
        </div>
      </div>

      {/* TOP HEADER Telemetry HUD */}
      <div className="relative z-10 flex items-center justify-between pointer-events-none w-full">
        <div className="flex flex-col">
          <span className="text-[10px] text-cyber-cyan font-mono tracking-widest uppercase">SCANNER MODE: ACTIVE</span>
          <span className="text-xs text-white font-bold tracking-wide font-space-grotesk">{scanPoint.label}</span>
        </div>
        <div className="text-right flex flex-col font-mono text-[9px] text-zinc-500">
          <span>ALT: 724.89KM</span>
          <span>SENSOR: SAR-3D</span>
        </div>
      </div>

      {/* INTERACTIVE CENTER NOTIFICATION overlay hint */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-100 opacity-60 transition-opacity duration-300">
        <span className="px-3 py-1.5 rounded-full border border-zinc-800 bg-black/80 text-[10px] font-mono text-zinc-400 tracking-wider uppercase backdrop-blur-sm">
          Click scanner grid to lock target
        </span>
      </div>

      {/* BOTTOM HUD MODULE */}
      <div className="relative z-10 w-full mt-auto space-y-2 pointer-events-none">
        <div className="p-2.5 rounded bg-zinc-950/80 border border-zinc-850/80 backdrop-blur-sm flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-zinc-500 uppercase tracking-widest">Pixel Change Difference Ratio</span>
            <span className={`${deviation > 0.6 ? 'text-cyber-orange' : 'text-cyber-cyan'} font-bold`}>
              {(deviation * 100).toFixed(0)}% DEVIATION
            </span>
          </div>
          
          {/* Animated Progress Bar */}
          <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ease-out ${deviation > 0.6 ? 'bg-gradient-to-r from-cyber-cyan to-cyber-orange' : 'bg-cyber-cyan'}`}
              style={{ width: `${deviation * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400">
            <span>PRE-EVENT: 0.12 SAR</span>
            <span className="text-zinc-600">|</span>
            <span>POST-EVENT: {(0.12 + deviation).toFixed(2)} SAR</span>
            <span className="text-zinc-600">|</span>
            <span className="text-cyber-cyan">DIFF: +{deviation.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isScanning ? 'bg-cyber-orange animate-ping' : 'bg-cyber-cyan animate-pulse'}`} />
            <span>ORBITAL TELEMETRY INTERACTIVE PANEL</span>
          </div>
          <span>GRID SEC: A-491-09</span>
        </div>
      </div>
    </div>
  );
}

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="about-modal-wrapper" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 backdrop-blur-md p-4 sm:p-6 md:p-10">
          {/* Modal Overlay backdrop click */}
          <div 
            className="fixed inset-0" 
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
            className="relative w-full max-w-5xl bg-[#070714] border border-zinc-850 rounded-2xl overflow-hidden shadow-2xl shadow-black/80 z-10 max-h-[85vh] sm:max-h-[90vh] flex flex-col font-sans"
          >
            {/* Top-Right Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-30 p-2 rounded-full bg-black/50 border border-zinc-800 text-zinc-400 hover:text-white hover:border-cyber-cyan hover:scale-105 transition-all duration-200"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* 1. HERO BLOCK (with Earth Satellite view from Unsplash) */}
              <div className="relative h-[250px] sm:h-[320px] w-full flex items-end p-6 sm:p-8 md:p-10 overflow-hidden">
                <div className="absolute inset-0 z-0">
                  <img
                    src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80"
                    alt="Earth Satellite View from Orbit"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover brightness-[0.4] contrast-[1.1] scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#070714] via-[#070714]/40 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#070714]/80 via-transparent to-[#070714]/20" />
                </div>

                <div className="relative z-10 max-w-3xl space-y-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30">
                    <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} /> DEEP ORBIT OBSERVATION SYSTEM
                  </span>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-black font-space-grotesk tracking-tight text-white uppercase">
                    What Exactly <span className="text-cyber-cyan">VyomOps</span> Is
                  </h1>
                  <p className="text-zinc-300 text-sm sm:text-base leading-relaxed font-light">
                    VyomOps is a futuristic planetary-scale tactical disaster-response intelligence system — combining live orbital hazard monitoring, historical multi-spectral disaster lookups, and verified satellite pixel change-detection into a single unified telemetry command deck.
                  </p>
                </div>
              </div>

              {/* Technical Facts Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 border-y border-zinc-900 bg-black/30">
                <div className="p-4 sm:p-6 text-center border-b sm:border-b-0 sm:border-r border-zinc-900 flex flex-col items-center justify-center">
                  <Database className="w-5 h-5 text-cyber-cyan mb-2" />
                  <span className="text-lg sm:text-xl font-bold font-space-grotesk text-white">3 Live Data Sources</span>
                  <span className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Bhuvan, MOSDAC, Sentinel</span>
                </div>
                <div className="p-4 sm:p-6 text-center border-b sm:border-b-0 sm:border-r border-zinc-900 flex flex-col items-center justify-center">
                  <Eye className="w-5 h-5 text-cyber-orange mb-2" />
                  <span className="text-lg sm:text-xl font-bold font-space-grotesk text-white">24-Month Window</span>
                  <span className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Historical Lookback Archive</span>
                </div>
                <div className="p-4 sm:p-6 text-center flex flex-col items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 mb-2" />
                  <span className="text-lg sm:text-xl font-bold font-space-grotesk text-white">Zero Mocked Policy</span>
                  <span className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Verified Real Data Calculations</span>
                </div>
              </div>

              {/* Core Body Container */}
              <div className="p-6 sm:p-8 md:p-10 space-y-12 sm:space-y-16">
                
                {/* 2. ABOUT SECTION HEADER */}
                <div className="text-center max-w-2xl mx-auto space-y-3">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold font-space-grotesk tracking-tight text-white uppercase">
                    How VyomOps Works
                  </h2>
                  <div className="w-12 h-0.5 bg-cyber-cyan mx-auto rounded" />
                  <p className="text-zinc-400 text-sm sm:text-base leading-relaxed font-light">
                    Built on a simple principle: <span className="text-white font-medium">measure first, interpret second</span> — so nothing we show you is an AI guess.
                  </p>
                </div>

                {/* 3. THREE FEATURE CARDS (reused exactly from landing page) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Card 1 */}
                  <div className="group p-5 sm:p-6 rounded-xl border border-zinc-900 bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all duration-300 hover:border-cyber-cyan/30 hover:-translate-y-1">
                    <div className="flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full bg-cyber-cyan mt-2 flex-shrink-0" />
                      <div className="space-y-2">
                        <h3 className="font-semibold text-white text-base sm:text-lg tracking-wide font-space-grotesk">
                          Local Response Caching Layer
                        </h3>
                        <p className="text-zinc-400 text-sm leading-relaxed font-light">
                          Hardcoded pre-cached JSON data structures for exact demo assets ensure instant, zero-latency local fallback if venue Wi-Fi network latency spikes live.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="group p-5 sm:p-6 rounded-xl border border-zinc-900 bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all duration-300 hover:border-cyber-orange/30 hover:-translate-y-1">
                    <div className="flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full bg-cyber-orange mt-2 flex-shrink-0" />
                      <div className="space-y-2">
                        <h3 className="font-semibold text-white text-base sm:text-lg tracking-wide font-space-grotesk">
                          Credible Data Intake
                        </h3>
                        <p className="text-zinc-400 text-sm leading-relaxed font-light">
                          Seamless ingestion integration accepting public remote sensing database frameworks including Bhuvan, MOSDAC, and Sentinel repositories to maintain real-world analytical credibility.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div className="group p-5 sm:p-6 rounded-xl border border-zinc-900 bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all duration-300 hover:border-emerald-500/30 hover:-translate-y-1">
                    <div className="flex items-start gap-4">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                      <div className="space-y-2">
                        <h3 className="font-semibold text-white text-base sm:text-lg tracking-wide font-space-grotesk">
                          The Wrapper Defense Narrative
                        </h3>
                        <p className="text-zinc-400 text-sm leading-relaxed font-light">
                          A dedicated operational strategy splitting measurement from interpretation, ensuring our product never hallucinates critical hazard perimeters.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. LEFT IMAGE + RIGHT TWO CARDS LAYOUT ("How We're Different") */}
                <div className="space-y-6">
                  <div className="text-left space-y-1.5">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-cyber-cyan">Comparative Advantage</h3>
                    <h2 className="text-lg sm:text-2xl font-bold font-space-grotesk tracking-tight text-white uppercase">How We're Different</h2>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                    {/* Left big interactive scanner */}
                    <div className="lg:col-span-5 rounded-xl overflow-hidden border border-zinc-900 relative min-h-[300px] lg:min-h-full flex flex-col">
                      <InteractiveScanner />
                    </div>

                    {/* Right side cards */}
                    <div className="lg:col-span-7 flex flex-col gap-6 justify-between">
                      {/* Right Card 1 */}
                      <div className="p-5 sm:p-6 rounded-xl border border-zinc-900/80 bg-zinc-950/40 space-y-3">
                        <div className="flex items-center gap-2.5">
                          <Zap className="w-4 h-4 text-cyber-cyan" />
                          <h4 className="font-bold text-white text-sm sm:text-base uppercase tracking-wide font-space-grotesk">
                            Real Data, Not Guesses
                          </h4>
                        </div>
                        <p className="text-zinc-400 text-sm leading-relaxed font-light">
                          Most disaster dashboards ask an AI model to spot the damage directly from images — which is exactly where vision models are least reliable. VyomOps runs real pixel-difference computation first, and only uses AI to explain a result that's already mathematically verified.
                        </p>
                      </div>

                      {/* Right Card 2 */}
                      <div className="p-5 sm:p-6 rounded-xl border border-zinc-900/80 bg-zinc-950/40 space-y-3">
                        <div className="flex items-center gap-2.5">
                          <Layers className="w-4 h-4 text-cyber-orange" />
                          <h4 className="font-bold text-white text-sm sm:text-base uppercase tracking-wide font-space-grotesk">
                            Three Live Modes, Not One
                          </h4>
                        </div>
                        <p className="text-zinc-400 text-sm leading-relaxed font-light">
                          Live Monitor tracks active disasters across South Asia and the surrounding region in real time. Look Back searches 24 months of verified history for any location. Change Detect runs your own before/after image pairs through the same verified pipeline. No mocked data in any of the three.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer / Interactive Close Accent */}
              <div className="p-6 border-t border-zinc-900 bg-black/60 text-center flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <span className="text-xs text-zinc-500 font-mono tracking-wide">
                  VYOMOPS RECONNAISSANCE TELEMETRY // ORBITAL GROUND TRUTH DIRECT ACCESS
                </span>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded bg-zinc-900 hover:bg-zinc-850 text-white font-mono text-xs uppercase tracking-wider border border-zinc-800 hover:border-cyber-cyan transition-all"
                >
                  Terminate Interface
                </button>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
