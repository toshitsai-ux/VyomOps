import React, { useEffect, useRef, useState, useCallback, useMemo } from "react"; 
import { useNavigate } from "react-router-dom";
import Globe from "@/components/ui/globe";
import ScrambleText from "@/components/ui/scramble-text";
import { cn } from "@/lib/utils";
import AboutModal from "@/components/ui/AboutModal";

// Reusable ScrollGlobe component following shadcn/ui patterns
interface ScrollGlobeProps {
  sections: {
    id: string;
    badge?: string;
    title: string;
    subtitle?: string;
    description: string;
    align?: 'left' | 'center' | 'right';
    features?: { title: string; description: string; indicator?: 'emerald' | 'rose' }[];
    actions?: { label: string; variant: 'primary' | 'secondary'; onClick?: () => void }[];
  }[];
  globeConfig?: {
    positions: {
      top: string;
      left: string;
      scale: number;
    }[];
  };
  className?: string;
}

const defaultGlobeConfig = {
  positions: [
    { top: "50%", left: "75%", scale: 1.4 },  // Hero: Right side, balanced
    { top: "25%", left: "50%", scale: 0.9 },  // Innovation: Top side, subtle
    { top: "15%", left: "90%", scale: 2 },  // Discovery: Left side, medium
    { top: "50%", left: "50%", scale: 1.8 },  // Future: Center, large backdrop
  ]
};

// Parse percentage string or number safely
const parsePercent = (val: string | number | undefined): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val.replace('%', '')) || 0;
  return 0;
};

function ScrollGlobe({ sections = [], globeConfig = defaultGlobeConfig, className }: ScrollGlobeProps) {
  const [activeSection, setActiveSection] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [globeTransform, setGlobeTransform] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationFrameId = useRef<number>();
  
  // Pre-calculate positions for performance
  const calculatedPositions = useMemo(() => {
    const list = globeConfig?.positions || defaultGlobeConfig.positions;
    return list.map(pos => ({
      top: parsePercent(pos?.top),
      left: parsePercent(pos?.left),
      scale: typeof pos?.scale === 'number' ? pos.scale : 1
    }));
  }, [globeConfig]);

  // Simple, direct scroll tracking
  const updateScrollPosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const scrollTop = window.scrollY !== undefined ? window.scrollY : window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? Math.min(Math.max(scrollTop / docHeight, 0), 1) : 0;
    
    setScrollProgress(progress);

    // Simple section detection
    const viewportCenter = window.innerHeight / 2;
    let newActiveSection = 0;
    let minDistance = Infinity;

    sectionRefs.current.forEach((ref, index) => {
      if (ref) {
        const rect = ref.getBoundingClientRect();
        const sectionCenter = rect.top + rect.height / 2;
        const distance = Math.abs(sectionCenter - viewportCenter);
        
        if (distance < minDistance) {
          minDistance = distance;
          newActiveSection = index;
        }
      }
    });

    // Direct position update - no interpolation with safety guard
    const currentPos = calculatedPositions[newActiveSection] || calculatedPositions[0];
    if (currentPos) {
      const transform = `translate3d(${currentPos.left}vw, ${currentPos.top}vh, 0) translate3d(-50%, -50%, 0) scale3d(${currentPos.scale}, ${currentPos.scale}, 1)`;
      setGlobeTransform(transform);
    }
    setActiveSection(newActiveSection);
  }, [calculatedPositions]);

  // Throttled scroll handler with RAF
  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        animationFrameId.current = requestAnimationFrame(() => {
          updateScrollPosition();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    updateScrollPosition(); // Initial call
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [updateScrollPosition]);

  // Initial globe position
  useEffect(() => {
    const initialPos = calculatedPositions[0];
    const initialTransform = `translate3d(${initialPos.left}vw, ${initialPos.top}vh, 0) translate3d(-50%, -50%, 0) scale3d(${initialPos.scale}, ${initialPos.scale}, 1)`;
    setGlobeTransform(initialTransform);
  }, [calculatedPositions]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative w-full max-w-screen overflow-x-hidden min-h-screen bg-background text-foreground",
        className
      )}
    >
      {/* Progress Bar with original Blue Gradient style */}
      <div className="fixed top-0 left-0 w-full h-0.5 bg-gradient-to-r from-border/20 via-border/40 to-border/20 z-50">
        <div 
          className="h-full bg-gradient-to-r from-primary via-blue-600 to-blue-900 will-change-transform shadow-sm"
          style={{ 
            transform: `scaleX(${scrollProgress})`,
            transformOrigin: 'left center',
            transition: 'transform 0.15s ease-out',
            filter: 'drop-shadow(0 0 2px rgba(59, 130, 246, 0.3))'
          }}
        />
      </div>

      {/* Enhanced Navigation with auto-hiding labels - Original premium design */}
      <div className="hidden sm:flex fixed right-2 sm:right-4 lg:right-8 top-1/2 -translate-y-1/2 z-40">
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">
          {sections.map((section, index) => (
            <div key={index} className="relative group">
              {/* Auto-hiding label */}
              <div
                className={cn(
                  "nav-label absolute right-5 sm:right-6 lg:right-8 top-1/2 -translate-y-1/2",
                  "px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap",
                  "bg-background/95 backdrop-blur-md border border-border/60 shadow-xl z-50",
                  activeSection === index ? "animate-fadeOut" : "opacity-0"
                )}
              >
                <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2">
                  <div className="w-1 sm:w-1.5 lg:w-2 h-1 sm:h-1.5 lg:h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs sm:text-sm lg:text-base">
                    {section.badge || `Section ${index + 1}`}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  sectionRefs.current[index]?.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'center'
                  });
                }}
                className={cn(
                  "relative w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 rounded-full border-2 transition-all duration-300 hover:scale-125",
                  "before:absolute before:inset-0 before:rounded-full before:transition-all before:duration-300",
                  activeSection === index 
                    ? "bg-primary border-primary shadow-lg before:animate-ping before:bg-primary/20" 
                    : "bg-transparent border-muted-foreground/40 hover:border-primary/60 hover:bg-primary/10"
                )}
                aria-label={`Go to ${section.badge || `section ${index + 1}`}`}
              />
            </div>
          ))}
        </div>
        
        {/* Original thin connection line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 lg:w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent -translate-x-1/2 -z-10" />
      </div>

      {/* Ultra-smooth Globe with original scaling */}
      <div
        className="fixed z-10 pointer-events-none will-change-transform transition-all duration-[1400ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
        style={{
          transform: globeTransform,
          filter: `opacity(${activeSection === 3 ? 0.4 : 0.85})`, // Original subtle opacity
        }}
      >
        <div className="scale-75 sm:scale-90 lg:scale-100">
          <Globe />
        </div>
      </div>

      {/* Dynamic sections - styled in the original clean layout */}
      {sections.map((section, index) => (
        <section
          key={section.id}
          ref={(el) => (sectionRefs.current[index] = el)}
          className={cn(
            "relative min-h-screen flex flex-col justify-center px-4 sm:px-6 md:px-8 lg:px-12 z-20 py-12 sm:py-16 lg:py-20",
            "w-full max-w-full overflow-hidden",
            section.align === 'center' && "items-center text-center",
            section.align === 'right' && "items-end text-right",
            section.align !== 'center' && section.align !== 'right' && "items-start text-left"
          )}
        >
          <div className={cn(
            "w-full max-w-sm sm:max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-5xl will-change-transform transition-all duration-700",
            "opacity-100 translate-y-0"
          )}>
            
            <h1 className={cn(
              "font-bold mb-6 sm:mb-8 leading-[1.1] tracking-tight",
              index === 0 
                ? "text-3xl sm:text-4xl md:text-5xl lg:text-3xl xl:text-7xl" 
                : "text-2xl sm:text-3xl md:text-4xl lg:text-3xl xl:text-5xl"
            )}>
              {section.subtitle ? (
                <div className="space-y-1 sm:space-y-2">
                  <div className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    <ScrambleText text={section.title} speed={70} scrambleOnHover autoStart useIntersectionObserver retriggerOnIntersection />
                  </div>
                  <div className="text-muted-foreground/90 text-sm sm:text-base lg:text-lg font-medium tracking-wide">
                    <ScrambleText text={section.subtitle} speed={85} scrambleOnHover autoStart useIntersectionObserver retriggerOnIntersection />
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text text-transparent">
                  <ScrambleText text={section.title} speed={70} scrambleOnHover autoStart useIntersectionObserver retriggerOnIntersection />
                </div>
              )}
            </h1>
            
            <div className={cn(
              "text-muted-foreground/85 leading-relaxed mb-8 sm:mb-10 text-base sm:text-lg font-light",
              section.align === 'center' ? "max-w-full mx-auto text-center" : "max-w-full"
            )}>
              <div className="mb-3 sm:mb-4">
                <ScrambleText text={section.description} speed={95} autoStart useIntersectionObserver />
              </div>

            </div>

            {/* Enhanced Features - Original bento grid styling with primary-colored subtle borders */}
            {section.features && (
              <div className="grid gap-3 sm:gap-4 mb-8 sm:mb-10 text-left">
                {section.features.map((feature, featureIndex) => (
                  <div 
                    key={feature.title}
                    className={cn(
                      "group p-4 sm:p-5 lg:p-6 rounded-lg sm:rounded-xl border bg-card/60 backdrop-blur-sm hover:bg-card/90 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5",
                      "hover:border-primary/20 hover:-translate-y-1"
                    )}
                    style={{ animationDelay: `${featureIndex * 0.1}s` }}
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-primary/60 mt-1.5 sm:mt-2 group-hover:bg-primary transition-colors flex-shrink-0" />
                      <div className="flex-1 space-y-1.5 sm:space-y-2 min-w-0">
                        <h3 className="font-semibold text-card-foreground text-base sm:text-lg">{feature.title}</h3>
                        <p className="text-muted-foreground/80 leading-relaxed text-sm sm:text-base">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Enhanced Actions - Original designer button styling */}
            {section.actions && (
              <div className={cn(
                "flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4",
                section.align === 'center' && "justify-center",
                section.align === 'right' && "justify-end",
                (!section.align || section.align === 'left') && "justify-start"
              )}>
                {section.actions.map((action, actionIndex) => (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    className={cn(
                      "group relative px-6 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl font-medium transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base",
                      "hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-auto",
                      action.variant === 'primary' 
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/30" 
                        : "border-2 border-border/60 bg-background/50 backdrop-blur-sm hover:bg-accent/50 hover:border-primary/30 text-foreground"
                    )}
                    style={{ animationDelay: `${actionIndex * 0.1 + 0.2}s` }}
                  >
                    <span className="relative z-10">{action.label}</span>
                    {action.variant === 'primary' && (
                      <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-r from-primary to-primary/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

// Demo component showcasing the ScrollGlobe
export default function GlobeScrollDemo() {
  const navigate = useNavigate();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const demoSections = [
    {
      id: "hero",
      badge: "SYSTEM ACTIVE - ORBITAL RECONNAISSANCE",
      title: "Clear Delta.",
      subtitle: "VyomOps shows exactly what changed from space — so you can respond with confidence.",
      description: "Harness real-time delta mapping to observe, analyze, and act on geographic changes over key strategic installations.",
      align: "left" as const,
      actions: [
        { label: "Enter Tactical Terminal", variant: "primary" as const, onClick: () => navigate("/login") },
      ]
    },
    {
      id: "analysis",
      badge: "CORE TECHNICAL PIVOT [METRICS: 99.8% ACCURACY]",
      title: "Algorithmic Precision",
      subtitle: "Deterministic computer vision models separate spatial modification from noise.",
      description: "We execute strict programmatic difference calculations to ensure ground truth matches intelligence assets before parsing.",
      align: "center" as const,
      features: [
        { 
          title: "Real Programmatic Measurement", 
          description: "A genuine OpenCV pixel-difference computation isolates absolute structural transformations programmatically before involving any artificial intelligence. This is actual computer vision math, not a black box simulation.",
          indicator: "emerald" as const
        },
        { 
          title: "Precision Interpretation Engine", 
          description: "Gemini 3.5 Flash is strictly isolated to translate computed change matrices into field-ready language, risk calculation scores, and prioritized ground tactical action checklists. We never ask an LLM to guess coordinates.",
          indicator: "emerald" as const
        },
        { 
          title: "Defensible Live Architecture", 
          description: "Built explicitly to survive tough judging panels. Every coordinate box rendered on the display HUD is backed by verified pixel data first, giving a definitive, explainable answer to accuracy validation queries.",
          indicator: "emerald" as const
        }
      ]
    },
    {
      id: "ecosystem",
      badge: "VERIFIED TECHNOLOGY ECOSYSTEM",
      title: "The Operational Stack",
      subtitle: "Five robust modules engineered for uncompromised live-demo resilience.",
      description: "Our distributed layers isolate calculation, transformation, and presentation beautifully.",
      align: "left" as const,
      features: [
        { 
          title: "Core Engine: Real Pixel Difference", 
          description: "Compares before and after satellite/drone images using OpenCV to accurately detect exactly what changed on the ground.",
          indicator: "emerald" as const
        },
        { 
          title: "Smart Analysis: Gemini 3.5 Flash", 
          description: "Takes the verified changes + original images and turns them into simple risk scores and clear action steps for response teams.",
          indicator: "emerald" as const
        },
        { 
          title: "Visual Layer: Interactive Canvas", 
          description: "Shows real-time before/after comparison with neon highlights on changed areas using HTML5 Canvas.",
          indicator: "rose" as const
        },
        { 
          title: "Live Triage: Firebase Sync", 
          description: "Automatically saves every analysis and updates the dashboard in real-time so teams can track critical, active, and cleared incidents.",
          indicator: "emerald" as const
        },
        { 
          title: "Live Overpass Tracking", 
          description: "Computes orbits from real TLE data. Know not just what changed on the ground, but exactly when you'll see it from space again.",
          indicator: "emerald" as const
        }
      ]
    },
    {
      id: "resilience",
      badge: "DEMO-DAY INSURANCE HUD",
      title: "System Resilience Architecture",
      subtitle: "Pre-positioned fail-sec networks designed for intense high-stakes verification panels.",
      description: "We split calculation from interpretation so critical safety thresholds never hallucinate.",
      align: "center" as const,
      features: [
        { 
          title: "Local Response Caching Layer", 
          description: "Hardcoded pre-cached JSON data structures for exact demo assets ensure instant, zero-latency local fallback if venue Wi-Fi network latency spikes live.",
          indicator: "emerald" as const
        },
        { 
          title: "Credible Data Intake", 
          description: "Seamless ingestion integration accepting public remote sensing database frameworks including Bhuvan, MOSDAC, and Sentinel repositories to maintain real-world analytical credibility.",
          indicator: "emerald" as const
        },
        { 
          title: "The \"Wrapper\" Defense Narrative", 
          description: "A dedicated operational strategy splitting measurement from interpretation, ensuring our product never hallucinates critical hazard perimeters.",
          indicator: "rose" as const
        }
      ],
      actions: [
        { label: "What Exactly VyomOps Is", variant: "primary" as const, onClick: () => setIsAboutOpen(true) },
      ]
    }
  ];

  return (
    <>
      <ScrollGlobe 
        sections={demoSections}
        className="bg-gradient-to-br from-background via-muted/20 to-background"
      />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </>
  );
}
