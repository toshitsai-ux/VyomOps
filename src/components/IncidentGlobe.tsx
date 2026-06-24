import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface IncidentMarker {
  id: string;
  disaster_type: string;
  title: string;
  lat: number;
  lng: number;
  severity: string;
  verification_score: number;
}

interface IncidentGlobeProps {
  incidents: IncidentMarker[];
  selectedIncidentId: string | null;
  onSelectIncident: (id: string) => void;
}

export default function IncidentGlobe({ incidents, selectedIncidentId, onSelectIncident }: IncidentGlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredIncident, setHoveredIncident] = useState<IncidentMarker | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. Scene, Camera & WebGL Renderer
    const scene = new THREE.Scene();
    // Dark tactical background matching VyomOps theme
    scene.background = new THREE.Color(0x060613);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 18;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0x1a2b4c, 1.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00e5ff, 2.5);
    dirLight.position.set(5, 3, 5);
    scene.add(dirLight);

    const redLight = new THREE.PointLight(0xff6b35, 3, 50);
    redLight.position.set(-10, -5, -5);
    scene.add(redLight);

    // 3. Globe Mesh Setup
    const globeRadius = 5;
    const globeGeom = new THREE.SphereGeometry(globeRadius, 40, 40);

    // Futuristic deep glass material with elegant gloss reflections
    const coreMaterial = new THREE.MeshPhongMaterial({
      color: 0x0a0b24,
      emissive: 0x050618,
      specular: 0x00e5ff,
      shininess: 35,
      transparent: true,
      opacity: 0.9,
    });
    const globeMesh = new THREE.Mesh(globeGeom, coreMaterial);
    scene.add(globeMesh);

    // Digital wireframe grid layer (slightly larger than core)
    const gridGeom = new THREE.SphereGeometry(globeRadius + 0.05, 30, 30);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const gridMesh = new THREE.Mesh(gridGeom, gridMat);
    globeMesh.add(gridMesh);

    // Atmosphere halo glow ring
    const glowGeom = new THREE.SphereGeometry(globeRadius + 0.35, 30, 30);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.05,
      side: THREE.BackSide,
    });
    const glowMesh = new THREE.Mesh(glowGeom, glowMat);
    scene.add(glowMesh);

    // 4. Space / Starfield background particles
    const starsCount = 450;
    const starsGeom = new THREE.BufferGeometry();
    const starsPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
      const radius = 25 + Math.random() * 40;
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      starsPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
      starsPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starsPositions[i + 2] = radius * Math.cos(phi);
    }
    starsGeom.setAttribute("position", new THREE.BufferAttribute(starsPositions, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.11,
      transparent: true,
      opacity: 0.35,
    });
    const starField = new THREE.Points(starsGeom, starsMat);
    scene.add(starField);

    // Helper to map lat/lng coordinates to 3D Cartesian coordinates on sphere
    const latLngToVector3 = (lat: number, lng: number, r: number) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);
      return new THREE.Vector3(
        -r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.cos(theta)
      );
    };

    // 5. Active verified disaster coordinate markers
    const markerGroup = new THREE.Group();
    globeMesh.add(markerGroup);

    const markerMeshes: { mesh: THREE.Mesh; pulseRing: THREE.Mesh; incident: IncidentMarker }[] = [];

    incidents.forEach((inc) => {
      const pos = latLngToVector3(inc.lat, inc.lng, globeRadius + 0.1);

      // Color depends on severity (Critical = Saffron #FF6B35, others = Aqua #00E5FF)
      const isCritical = inc.severity === "Critical" || inc.verification_score > 85;
      const colorHex = isCritical ? 0xff6b35 : 0x00e5ff;

      // Inner glowing core sphere
      const coreGeom = new THREE.SphereGeometry(0.15, 8, 8);
      const coreMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.95
      });
      const coreMesh = new THREE.Mesh(coreGeom, coreMat);
      coreMesh.position.copy(pos);
      markerGroup.add(coreMesh);

      // Outer pulsing ripple ring
      const ringGeom = new THREE.RingGeometry(0.18, 0.35, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.position.copy(pos);
      ringMesh.lookAt(pos.clone().multiplyScalar(2)); // orient flat against sphere surface
      markerGroup.add(ringMesh);

      markerMeshes.push({ mesh: coreMesh, pulseRing: ringMesh, incident: inc });
    });

    // Rotate globe to focus on India centroids initially (approx Lat 21, Lng 78)
    const indiaPos = latLngToVector3(21, 78, globeRadius);
    globeMesh.rotation.y = Math.PI - 0.25;
    globeMesh.rotation.x = 0.3;

    // 6. Interaction: Raycasting on click/hover
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleMouseMove = (event: MouseEvent) => {
      if (!mountRef.current) return;
      const rect = mountRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(markerMeshes.map(m => m.mesh));

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const matched = markerMeshes.find(m => m.mesh === hitMesh);
        if (matched) {
          setHoveredIncident(matched.incident);
          setTooltipPos({
            x: event.clientX - rect.left + 15,
            y: event.clientY - rect.top + 15
          });
          document.body.style.cursor = "pointer";
          return;
        }
      }
      setHoveredIncident(null);
      document.body.style.cursor = "default";
    };

    const handleMouseClick = (event: MouseEvent) => {
      if (!mountRef.current) return;
      const rect = mountRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(markerMeshes.map(m => m.mesh));

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const matched = markerMeshes.find(m => m.mesh === hitMesh);
        if (matched) {
          onSelectIncident(matched.incident.id);
        }
      }
    };

    mountRef.current.addEventListener("mousemove", handleMouseMove);
    mountRef.current.addEventListener("click", handleMouseClick);

    // 7. Tactical Drag / Rotate controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleDragMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y,
      };

      // Apply rotation on dragging
      globeMesh.rotation.y += deltaMove.x * 0.005;
      globeMesh.rotation.x += deltaMove.y * 0.005;

      // Bound polar angle to avoid wrapping upside down
      globeMesh.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, globeMesh.rotation.x));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    mountRef.current.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    mountRef.current.addEventListener("mousemove", handleDragMove);

    // 8. Animation loop
    let animationId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Slow passive rotation of the digital wireframe and background starfield
      if (!isDragging) {
        globeMesh.rotation.y += 0.001;
      }
      starField.rotation.y -= 0.0003;

      // Pulsing effect for custom alert coordinates
      markerMeshes.forEach((m) => {
        const scaleVal = 1 + Math.sin(elapsed * 5.5 + m.incident.lat) * 0.35;
        m.pulseRing.scale.set(scaleVal, scaleVal, 1);
        const opacityVal = 0.8 - (scaleVal - 0.65) * 0.6;
        if (Array.isArray(m.pulseRing.material)) {
          m.pulseRing.material.forEach(mat => { mat.opacity = opacityVal; });
        } else {
          m.pulseRing.material.opacity = opacityVal;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize Listener
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup logic
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mouseup", handleMouseUp);
      if (mountRef.current) {
        mountRef.current.removeEventListener("mousemove", handleMouseMove);
        mountRef.current.removeEventListener("click", handleMouseClick);
        mountRef.current.removeEventListener("mousedown", handleMouseDown);
        mountRef.current.removeEventListener("mousemove", handleDragMove);
        try {
          mountRef.current.removeChild(renderer.domElement);
        } catch (e) {}
      }
      cancelAnimationFrame(animationId);
      renderer.dispose();
    };

  }, [incidents]);

  return (
    <div id="incident-globe-container" className="relative w-full h-full min-h-[400px] bg-[#060613]/50 rounded-lg border border-zinc-800/40 overflow-hidden">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      
      {/* Dynamic Tactical Marker tooltip */}
      {hoveredIncident && (
        <div
          id="globe-tactical-tooltip"
          className="absolute z-50 pointer-events-none p-3 rounded bg-zinc-950/95 border border-zinc-800 text-xs font-mono shadow-2xl space-y-1 backdrop-blur-md"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
        >
          <div className="flex items-center justify-between space-x-3">
            <span className="text-zinc-400 font-bold tracking-wider uppercase text-[10px]">
              {hoveredIncident.disaster_type}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                hoveredIncident.severity === "Critical"
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
              }`}
            >
              {hoveredIncident.severity}
            </span>
          </div>
          <div className="text-white font-medium text-sm">{hoveredIncident.title}</div>
          <div className="text-zinc-500 flex justify-between pt-1 border-t border-zinc-900">
            <span>Coordinates:</span>
            <span className="text-zinc-300">
              {hoveredIncident.lat.toFixed(3)}°N, {hoveredIncident.lng.toFixed(3)}°E
            </span>
          </div>
          <div className="text-zinc-500 flex justify-between">
            <span>AI Verified Confidence:</span>
            <span className="text-cyber-cyan font-bold">{hoveredIncident.verification_score}%</span>
          </div>
        </div>
      )}

      {/* Decorative Compass and Status Indicators */}
      <div className="absolute top-4 left-4 pointer-events-none space-y-1 bg-zinc-950/80 p-2.5 rounded border border-zinc-800/60 font-mono text-[10px] text-zinc-400 backdrop-blur-sm">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse" />
          <span className="uppercase tracking-wider font-bold">SENTINEL-AI MATRIX</span>
        </div>
        <div className="text-[9px] text-zinc-600 uppercase">3D Earth Ingress View // active</div>
      </div>

      <div className="absolute bottom-4 right-4 pointer-events-none text-right font-mono text-[9px] text-zinc-600 bg-zinc-950/40 p-2 rounded border border-zinc-900">
        <div>ELEVATION: GEOSYNC</div>
        <div>DRAG TO ROTATE GLOBE</div>
      </div>
    </div>
  );
}
