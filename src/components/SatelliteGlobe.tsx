import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface ZoneMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: string;
  changePercentage?: number;
}

interface SatelliteGlobeProps {
  zones: ZoneMarker[];
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
}

export default function SatelliteGlobe({ zones, selectedZoneId, onSelectZone }: SatelliteGlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredZone, setHoveredZone] = useState<ZoneMarker | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. Scene, Camera & WebGL Renderer
    const scene = THREE.Scene ? new THREE.Scene() : null;
    if (!scene) return;
    
    // Space background color matches VyomOps dark tactical aesthetic #020208
    scene.background = new THREE.Color(0x020208);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 18;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0x1a2b4c, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00e5ff, 2.5);
    dirLight.position.set(5, 3, 5);
    scene.add(dirLight);

    const redLight = new THREE.PointLight(0xff6b35, 3, 50);
    redLight.position.set(-10, -5, -5);
    scene.add(redLight);

    // 3. Globe Construction
    const globeRadius = 5;
    
    // Standard segment geometry
    const globeGeom = new THREE.SphereGeometry(globeRadius, 40, 40);
    
    // Base core: transparent dark glass with cyan wireframe
    const coreMaterial = new THREE.MeshPhongMaterial({
      color: 0x071330,
      emissive: 0x051026,
      specular: 0x00e5ff,
      shininess: 40,
      transparent: true,
      opacity: 0.85,
    });
    const globeMesh = new THREE.Mesh(globeGeom, coreMaterial);
    scene.add(globeMesh);

    // Digital scan wireframe grid (slightly larger)
    const gridGeom = new THREE.SphereGeometry(globeRadius + 0.05, 30, 30);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const gridMesh = new THREE.Mesh(gridGeom, gridMat);
    globeMesh.add(gridMesh);

    // Atmosphere halo glow ring
    const glowGeom = new THREE.SphereGeometry(globeRadius + 0.4, 30, 30);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide,
    });
    const glowMesh = new THREE.Mesh(glowGeom, glowMat);
    scene.add(glowMesh);

    // 4. Space/Starfield background particle points
    const starsCount = 400;
    const starsGeom = new THREE.BufferGeometry();
    const starsPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
      const radius = 25 + Math.random() * 50;
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
      size: 0.12,
      transparent: true,
      opacity: 0.4,
    });
    const starField = new THREE.Points(starsGeom, starsMat);
    scene.add(starField);

    // 5. Monitored Zone coordinate markers on Earth surface
    const markerGroup = new THREE.Group();
    globeMesh.add(markerGroup);

    const latLngToVector3 = (lat: number, lng: number, radius: number) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);
      return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.cos(theta)
      );
    };

    const zoneMeshes: { mesh: THREE.Mesh; zone: ZoneMarker }[] = [];

    // Draw active coordinates
    zones.forEach((z) => {
      const pos = latLngToVector3(z.lat, z.lng, globeRadius + 0.1);
      
      // Ring pulse indicator
      const ringGeom = new THREE.RingGeometry(0.12, 0.22, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: z.changePercentage && z.changePercentage > 15 ? 0xff6b35 : 0x00e5ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const markerMesh = new THREE.Mesh(ringGeom, ringMat);
      markerMesh.position.copy(pos);
      // Align ring to sphere surface normal
      markerMesh.lookAt(pos.clone().multiplyScalar(2));
      
      // Store reference to check for raycasting hits
      markerGroup.add(markerMesh);
      zoneMeshes.push({ mesh: markerMesh, zone: z });
    });

    // 6. Rotating Orbital Satellites (Sentinel-2 and Landsat-8 orbits)
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);

    // Create 2 tilted orbits
    const createOrbitLine = (tiltX: number, tiltY: number, colorHex: number) => {
      const curve = new THREE.EllipseCurve(
        0, 0,            // Center x, y
        6.8, 6.8,        // xRadius, yRadius
        0, 2 * Math.PI,  // Start angle, end angle
        false,           // clockwise
        0                // rotation
      );
      const points = curve.getPoints(64);
      const orbitPoints3D = points.map(p => new THREE.Vector3(p.x, 0, p.y));
      const orbitGeom = new THREE.BufferGeometry().setFromPoints(orbitPoints3D);
      const orbitMat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.2,
      });
      const orbitLine = new THREE.Line(orbitGeom, orbitMat);
      orbitLine.rotation.x = tiltX;
      orbitLine.rotation.y = tiltY;
      orbitGroup.add(orbitLine);
      return orbitLine;
    };

    const orbit1 = createOrbitLine(Math.PI / 3, Math.PI / 6, 0x00e5ff);
    const orbit2 = createOrbitLine(-Math.PI / 4, -Math.PI / 4, 0xff6b35);

    // Add satellite meshes
    const satGeom = new THREE.BoxGeometry(0.24, 0.14, 0.14);
    const satMat1 = new THREE.MeshPhongMaterial({ color: 0x00e5ff, emissive: 0x00e5ff });
    const satMat2 = new THREE.MeshPhongMaterial({ color: 0xff6b35, emissive: 0xff6b35 });
    
    const sat1 = new THREE.Mesh(satGeom, satMat1);
    const sat2 = new THREE.Mesh(satGeom, satMat2);
    scene.add(sat1);
    scene.add(sat2);

    // 7. Interaction Raycasting
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / height) * 2 + 1;

      // Update hovered marker
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(markerGroup.children, true);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const matched = zoneMeshes.find(zm => zm.mesh === hitMesh);
        if (matched) {
          setHoveredZone(matched.zone);
          // Set tool tip coordinate position
          setTooltipPos({
            x: event.clientX - rect.left + 15,
            y: event.clientY - rect.top + 15
          });
          document.body.style.cursor = "pointer";
          return;
        }
      }
      setHoveredZone(null);
      document.body.style.cursor = "default";
    };

    const handleMouseClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(markerGroup.children, true);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const matched = zoneMeshes.find(zm => zm.mesh === hitMesh);
        if (matched) {
          onSelectZone(matched.zone.id);
        }
      }
    };

    renderer.domElement.addEventListener("mousemove", handleMouseMove);
    renderer.domElement.addEventListener("click", handleMouseClick);

    // Drag-rotation state
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleDragMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y,
      };

      // Rotate globe and markers together
      globeMesh.rotation.y += deltaMove.x * 0.005;
      globeMesh.rotation.x += deltaMove.y * 0.005;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    renderer.domElement.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleMouseUp);

    // 8. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const time = clock.getElapsedTime();

      // Slow idle rotation of starfield and globe
      if (!isDragging) {
        globeMesh.rotation.y += 0.0018;
      }
      starField.rotation.y -= 0.0003;

      // Pulse active markers
      zoneMeshes.forEach(({ mesh, zone }) => {
        const scaleVal = 1 + Math.sin(time * 5 + zone.lat) * 0.12;
        mesh.scale.set(scaleVal, scaleVal, 1);
        
        // Match selection status visually
        if (selectedZoneId === zone.id) {
          // Glow green/cyan for selected
          (mesh.material as THREE.MeshBasicMaterial).color.setHex(0x00ffcc);
        } else {
          // Restore native coloring
          (mesh.material as THREE.MeshBasicMaterial).color.setHex(
            zone.changePercentage && zone.changePercentage > 15 ? 0xff6b35 : 0x00e5ff
          );
        }
      });

      // Animate satellite orbit positions (circular translation)
      const angle1 = time * 0.4;
      const localPos1 = new THREE.Vector3(Math.cos(angle1) * 6.8, 0, Math.sin(angle1) * 6.8);
      localPos1.applyEuler(orbit1.rotation);
      sat1.position.copy(localPos1);

      const angle2 = time * -0.3 + 2; // offset starting point
      const localPos2 = new THREE.Vector3(Math.cos(angle2) * 6.8, 0, Math.sin(angle2) * 6.8);
      localPos2.applyEuler(orbit2.rotation);
      sat2.position.copy(localPos2);

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

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (mountRef.current && renderer.domElement) {
        renderer.domElement.removeEventListener("mousemove", handleMouseMove);
        renderer.domElement.removeEventListener("click", handleMouseClick);
        renderer.domElement.removeEventListener("mousedown", handleMouseDown);
        mountRef.current.removeChild(renderer.domElement);
      }
      // dispose geometries/materials
      globeGeom.dispose();
      gridGeom.dispose();
      glowGeom.dispose();
      coreMaterial.dispose();
      gridMat.dispose();
      glowMat.dispose();
      starsGeom.dispose();
      starsMat.dispose();
      satGeom.dispose();
      satMat1.dispose();
      satMat2.dispose();
    };
  }, [zones, selectedZoneId]);

  return (
    <div className="relative w-full h-full min-h-[380px] select-none" ref={mountRef}>
      {/* Dynamic Floating Tooltip */}
      {hoveredZone && (
        <div
          className="absolute z-50 bg-[#070b1e]/90 border border-cyber-cyan/50 backdrop-blur-md text-white font-mono p-2.5 rounded-lg text-[10px] space-y-1 shadow-[0_0_15px_rgba(0,229,255,0.25)] pointer-events-none"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
        >
          <div className="font-bold text-[#00E5FF] uppercase tracking-wider">{hoveredZone.name}</div>
          <div className="text-zinc-400">Lat: {hoveredZone.lat.toFixed(4)}</div>
          <div className="text-zinc-400">Lng: {hoveredZone.lng.toFixed(4)}</div>
          <div className="flex items-center gap-1">
            <span className="text-zinc-500">Status:</span>
            <span className={`uppercase text-[9px] font-bold ${hoveredZone.status === "Active" ? "text-emerald-400 animate-pulse" : "text-zinc-500"}`}>
              {hoveredZone.status}
            </span>
          </div>
          {hoveredZone.changePercentage !== undefined && (
            <div className="text-right text-[#FF6B35] font-semibold text-[11px] mt-1 border-t border-zinc-800/60 pt-1">
              Delta: {hoveredZone.changePercentage.toFixed(1)}%
            </div>
          )}
        </div>
      )}

      {/* Orbit & Calibration Compass Legend */}
      <div className="absolute bottom-3 left-3 bg-[#020208]/60 border border-zinc-800/40 backdrop-blur-md rounded-lg p-2 font-mono text-[8px] sm:text-[9px] text-zinc-400 space-y-1 pointer-events-none">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-[#00E5FF] rounded-full animate-pulse" />
          <span>ORBITAL_A: SENTINEL-2 (TILT: 60°)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-[#FF6B35] rounded-full animate-pulse" />
          <span>ORBITAL_B: LANDSAT-8 (TILT: -45°)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
          <span>ACTIVE MONITORING SENSORS</span>
        </div>
      </div>
    </div>
  );
}
