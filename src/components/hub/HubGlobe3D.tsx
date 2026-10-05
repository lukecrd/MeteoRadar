import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Minus, Plus, LocateFixed } from 'lucide-react';

export interface GlobeMarker {
  id: string;
  kind: 'news' | 'market';
  lat: number;
  lon: number;
  label: string;
  sublabel?: string;
  color: string;
  /** 0-1: drives beam height and pulse speed */
  heat: number;
  dimmed?: boolean;
}

interface HubGlobe3DProps {
  markers: GlobeMarker[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** the globe turns to face this point whenever it changes */
  focus: { lat: number; lon: number } | null;
}

// NASA "Earth at Night" (public domain), as packaged by three-globe (MIT).
const EARTH_TEXTURE = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-night.jpg';
const R = 1;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.2;
/** world-space radius (globe + halo) that must fit inside the viewport at zoom 1 */
const FIT_RADIUS = 1.17;

function fitDistance(fovDeg: number, aspect: number): number {
  const half = THREE.MathUtils.degToRad(fovDeg) / 2;
  const hHalf = Math.atan(Math.tan(half) * aspect);
  return FIT_RADIUS / Math.sin(Math.min(half, hHalf));
}

/** Matches SphereGeometry's UV layout so markers land on the texture. */
function latLonToVec3(lat: number, lon: number, r = R): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

interface MarkerObjects {
  id: string;
  root: THREE.Group;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  coreMat: THREE.MeshBasicMaterial;
  beamMat: THREE.MeshBasicMaterial;
  hit: THREE.Mesh;
  anchor: THREE.Vector3; // local position on the surface
  marker: GlobeMarker;
  phase: number;
}

interface SceneHandles {
  globe: THREE.Group;
  markerGroup: THREE.Group;
  earth: THREE.Mesh;
  camera: THREE.PerspectiveCamera;
  shared: { core: THREE.SphereGeometry; ring: THREE.RingGeometry; beam: THREE.CylinderGeometry; hit: THREE.SphereGeometry; diamond: THREE.OctahedronGeometry };
  markers: MarkerObjects[];
  target: { rx: number; ry: number; zoom: number };
  fitZ: number;
  lastInteraction: number;
}

export const HubGlobe3D: React.FC<HubGlobe3DProps> = ({ markers, selectedId, onSelect, focus }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const handles = useRef<SceneHandles | null>(null);
  const selectedRef = useRef<string | null>(selectedId);
  const hoveredRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  const [hovered, setHovered] = useState<GlobeMarker | null>(null);
  const [textureFailed, setTextureFailed] = useState(false);

  onSelectRef.current = onSelect;
  selectedRef.current = selectedId;

  // ---- Scene setup (once) ----
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = container.clientWidth;
    let height = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.touchAction = 'pan-y';
    renderer.domElement.style.cursor = 'grab';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, fitDistance(38, width / height));

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0x9bdcff, 1.1);
    sun.position.set(-3, 2, 4);
    scene.add(sun);

    const globe = new THREE.Group();
    scene.add(globe);

    // Earth: night-lights texture doubles as emissive map so cities glow.
    const earthMat = new THREE.MeshPhongMaterial({ color: 0x1b3550, emissive: 0x05101c, shininess: 12, specular: 0x123447 });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 96), earthMat);
    globe.add(earth);
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      EARTH_TEXTURE,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        earthMat.map = tex;
        earthMat.emissiveMap = tex;
        earthMat.color.set(0xb8d4ff);
        earthMat.emissive.set(0xffc27a);
        earthMat.emissiveIntensity = 0.9;
        earthMat.needsUpdate = true;
      },
      undefined,
      () => setTextureFailed(true)
    );

    // Lat/lon graticule: the "instrument" layer over the planet.
    const gratPts: number[] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = -180; lon < 180; lon += 3) {
        const a = latLonToVec3(lat, lon, R * 1.004);
        const b = latLonToVec3(lat, lon + 3, R * 1.004);
        gratPts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    for (let lon = -180; lon < 180; lon += 30) {
      for (let lat = -87; lat < 87; lat += 3) {
        const a = latLonToVec3(lat, lon, R * 1.004);
        const b = latLonToVec3(lat + 3, lon, R * 1.004);
        gratPts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const gratGeo = new THREE.BufferGeometry();
    gratGeo.setAttribute('position', new THREE.Float32BufferAttribute(gratPts, 3));
    const gratMat = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.12 });
    globe.add(new THREE.LineSegments(gratGeo, gratMat));

    // Fresnel atmosphere halo.
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vNormal; void main(){ vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vNormal; void main(){ float i = pow(0.68 - dot(vNormal, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(0.13, 0.83, 0.93, 1.0) * i * 0.55; }`,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(R * 1.1, 64, 64), atmoMat);
    scene.add(atmosphere);

    // Orbit ring + distant star field for depth.
    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(R * 1.42, 0.0025, 8, 200),
      new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.35 })
    );
    orbit.rotation.x = Math.PI / 2.25;
    orbit.rotation.y = 0.3;
    scene.add(orbit);

    const starCount = 700;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(18 + Math.random() * 20);
      starPos.set([v.x, v.y, v.z], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xbfe9ff, size: 0.06, transparent: true, opacity: 0.6 });
    scene.add(new THREE.Points(starGeo, starMat));

    const markerGroup = new THREE.Group();
    globe.add(markerGroup);

    // Start with Europe/Africa facing the viewer.
    const start = latLonToVec3(30, 15);
    const startRy = -Math.atan2(start.x, start.z);
    globe.rotation.set(0.45, startRy, 0);

    const h: SceneHandles = {
      globe,
      markerGroup,
      earth,
      camera,
      shared: {
        core: new THREE.SphereGeometry(0.014, 12, 12),
        ring: new THREE.RingGeometry(0.022, 0.028, 40),
        beam: new THREE.CylinderGeometry(0.0035, 0.0035, 1, 6, 1, true),
        hit: new THREE.SphereGeometry(0.055, 8, 8),
        diamond: new THREE.OctahedronGeometry(0.02),
      },
      markers: [],
      target: { rx: 0.45, ry: startRy, zoom: 1 },
      fitZ: camera.position.z,
      lastInteraction: 0,
    };
    handles.current = h;

    // ---- Pointer interaction ----
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2(9, 9);
    let pointerInside = false;
    let drag: { x: number; y: number; startX: number; startY: number; moved: boolean } | null = null;

    const setNdc = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    };

    const pick = (): MarkerObjects | null => {
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects([earth, ...h.markers.map((m) => m.hit)], false);
      const first = hits[0];
      if (!first || first.object === earth) {
        // Markers sit just above the surface: allow a hit slightly "inside" the earth hit.
        const marker = hits.find((x) => x.object !== earth && first && x.distance - first.distance < 0.05);
        return marker ? h.markers.find((m) => m.hit === marker.object) ?? null : null;
      }
      return h.markers.find((m) => m.hit === first.object) ?? null;
    };

    const onDown = (e: PointerEvent) => {
      setNdc(e);
      drag = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false };
      renderer.domElement.setPointerCapture(e.pointerId);
      renderer.domElement.style.cursor = 'grabbing';
    };
    const onMove = (e: PointerEvent) => {
      pointerInside = true;
      setNdc(e);
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 5) drag.moved = true;
      const speed = 0.0055 / h.target.zoom;
      h.target.ry += dx * speed;
      h.target.rx = THREE.MathUtils.clamp(h.target.rx + dy * speed, -1.2, 1.2);
      h.lastInteraction = performance.now();
    };
    const onUp = (e: PointerEvent) => {
      if (drag && !drag.moved) {
        setNdc(e);
        const m = pick();
        if (m) onSelectRef.current(m.marker.id);
      }
      drag = null;
      renderer.domElement.style.cursor = hoveredRef.current ? 'pointer' : 'grab';
    };
    const onLeave = () => {
      pointerInside = false;
      ndc.set(9, 9);
    };
    const el = renderer.domElement;
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', () => (drag = null));
    el.addEventListener('pointerleave', onLeave);

    // ---- Resize / visibility ----
    const ro = new ResizeObserver(() => {
      width = container.clientWidth;
      height = container.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      h.fitZ = fitDistance(camera.fov, camera.aspect);
      camera.updateProjectionMatrix();
    });
    ro.observe(container);

    let onScreen = true;
    const io = new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting));
    io.observe(container);

    // ---- Render loop ----
    const clock = new THREE.Clock();
    const tmp = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    let frame = 0;

    const place = (elRef: HTMLDivElement | null, m: MarkerObjects | undefined) => {
      if (!elRef) return;
      if (!m) {
        elRef.style.opacity = '0';
        return;
      }
      m.root.getWorldPosition(tmp);
      camDir.copy(camera.position).sub(tmp);
      const facing = tmp.clone().normalize().dot(camDir.normalize()) > 0.05;
      tmp.project(camera);
      elRef.style.transform = `translate(${((tmp.x + 1) / 2) * width}px, ${((1 - tmp.y) / 2) * height}px)`;
      elRef.style.opacity = facing ? '1' : '0';
    };

    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (!onScreen || document.visibilityState !== 'visible') return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.elapsedTime;

      const idle = performance.now() - h.lastInteraction > 4000;
      if (!reducedMotion && idle && !selectedRef.current) h.target.ry += dt * 0.06;

      const k = Math.min(1, dt * 4.5);
      globe.rotation.y += (h.target.ry - globe.rotation.y) * k;
      globe.rotation.x += (h.target.rx - globe.rotation.x) * k;
      camera.position.z += (h.fitZ / h.target.zoom - camera.position.z) * k;
      orbit.rotation.z += dt * 0.05;

      for (const m of h.markers) {
        const isSel = m.id === selectedRef.current;
        const isHover = m.id === hoveredRef.current;
        if (m.marker.kind === 'news') {
          const period = 2.6 - m.marker.heat * 1.4;
          const p = reducedMotion ? 0.4 : ((t + m.phase) % period) / period;
          const s = isSel ? 2.2 + Math.sin(t * 3) * 0.2 : 1 + p * 1.5;
          m.ring.scale.setScalar(s);
          m.ringMat.opacity = (m.marker.dimmed ? 0.15 : isSel ? 0.95 : 0.8) * (isSel ? 1 : 1 - p);
        } else {
          m.ring.scale.setScalar(isSel ? 2 : 1);
          m.ringMat.opacity = isSel || isHover ? 0.9 : 0;
        }
        m.root.scale.setScalar(isHover || isSel ? 1.35 : 1);
      }

      // Hover picking once per frame instead of on every pointermove.
      if (pointerInside && !drag) {
        const m = pick();
        const id = m?.marker.id ?? null;
        if (id !== hoveredRef.current) {
          hoveredRef.current = id;
          setHovered(m?.marker ?? null);
          el.style.cursor = id ? 'pointer' : 'grab';
        }
      } else if (!pointerInside && hoveredRef.current) {
        hoveredRef.current = null;
        setHovered(null);
      }

      renderer.render(scene, camera);
      place(tooltipRef.current, h.markers.find((m) => m.id === hoveredRef.current && m.id !== selectedRef.current));
      place(labelRef.current, h.markers.find((m) => m.id === selectedRef.current));
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointerleave', onLeave);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((mm) => mm.dispose());
      });
      Object.values(h.shared).forEach((g) => g.dispose());
      earthMat.map?.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      handles.current = null;
    };
  }, []);

  // ---- Markers (rebuilt when data changes) ----
  useEffect(() => {
    const h = handles.current;
    if (!h) return;
    for (const m of h.markers) {
      h.markerGroup.remove(m.root);
      m.root.traverse((o) => {
        const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
        mat?.dispose();
      });
    }
    const up = new THREE.Vector3(0, 1, 0);
    h.markers = markers.map((marker, i) => {
      const normal = latLonToVec3(marker.lat, marker.lon).normalize();
      const color = new THREE.Color(marker.color);
      const root = new THREE.Group();
      root.position.copy(normal).multiplyScalar(R);
      root.quaternion.setFromUnitVectors(up, normal);

      const beamLen = marker.kind === 'news' ? 0.05 + marker.heat * 0.16 : 0.04 + marker.heat * 0.2;
      const baseOpacity = marker.dimmed ? 0.2 : 1;

      const beamMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 * baseOpacity, depthWrite: false });
      const beam = new THREE.Mesh(h.shared.beam, beamMat);
      beam.scale.y = beamLen;
      beam.position.y = beamLen / 2;
      root.add(beam);

      const coreMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: baseOpacity });
      const core = new THREE.Mesh(marker.kind === 'news' ? h.shared.core : h.shared.diamond, coreMat);
      core.position.y = marker.kind === 'news' ? 0.004 : beamLen;
      root.add(core);

      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
      const ring = new THREE.Mesh(h.shared.ring, ringMat);
      ring.rotation.x = -Math.PI / 2; // ring geometry faces +z; lay it flat on the surface
      ring.position.y = 0.003;
      root.add(ring);

      const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const hit = new THREE.Mesh(h.shared.hit, hitMat);
      hit.position.y = marker.kind === 'news' ? 0.02 : beamLen * 0.7;
      root.add(hit);

      h.markerGroup.add(root);
      return { id: marker.id, root, ring, ringMat, coreMat, beamMat, hit, anchor: root.position.clone(), marker, phase: (i * 0.37) % 2 };
    });
  }, [markers]);

  // ---- Focus: rotate the shortest way so the point faces the camera ----
  useEffect(() => {
    const h = handles.current;
    if (!h || !focus) return;
    const p = latLonToVec3(focus.lat, focus.lon);
    const desiredY = -Math.atan2(p.x, p.z);
    const desiredX = Math.atan2(p.y, Math.hypot(p.x, p.z));
    h.target.ry = h.globe.rotation.y + wrapAngle(desiredY - h.globe.rotation.y);
    h.target.rx = THREE.MathUtils.clamp(desiredX, -1.2, 1.2);
    h.lastInteraction = performance.now();
  }, [focus?.lat, focus?.lon]);

  const zoom = (dir: 1 | -1) => {
    const h = handles.current;
    if (!h) return;
    h.target.zoom = THREE.MathUtils.clamp(h.target.zoom * (dir > 0 ? 1.25 : 0.8), MIN_ZOOM, MAX_ZOOM);
    h.lastInteraction = performance.now();
  };

  const selected = markers.find((m) => m.id === selectedId) ?? null;

  return (
    <div className="hub-globe relative w-full h-full select-none">
      <div ref={containerRef} className="absolute inset-0" aria-hidden />

      {/* Projected overlays, positioned by the render loop */}
      <div ref={tooltipRef} className="hub-globe-tag pointer-events-none" style={{ opacity: 0 }}>
        {hovered && hovered.id !== selectedId && (
          <div className="hub-globe-tag__box" style={{ borderColor: hovered.color }}>
            <div className="font-display text-xs font-bold uppercase" style={{ color: hovered.color }}>{hovered.label}</div>
            {hovered.sublabel && <div className="font-hud text-[10px] text-[var(--hub-dim)]">{hovered.sublabel}</div>}
          </div>
        )}
      </div>
      <div ref={labelRef} className="hub-globe-tag hub-globe-tag--selected pointer-events-none" style={{ opacity: 0 }}>
        {selected && (
          <div className="hub-globe-tag__box" style={{ borderColor: selected.color, boxShadow: `0 0 22px -6px ${selected.color}` }}>
            <div className="font-display text-sm font-bold uppercase" style={{ color: selected.color }}>{selected.label}</div>
            {selected.sublabel && <div className="font-hud text-[10px] text-[var(--hub-text)] opacity-80">{selected.sublabel}</div>}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute right-3 bottom-3 flex flex-col gap-1.5 z-10">
        <button type="button" className="hub-icon-btn !h-8 !min-w-8 !p-0" onClick={() => zoom(1)} aria-label="Avvicina">
          <Plus className="w-4 h-4" />
        </button>
        <button type="button" className="hub-icon-btn !h-8 !min-w-8 !p-0" onClick={() => zoom(-1)} aria-label="Allontana">
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="hub-icon-btn !h-8 !min-w-8 !p-0"
          onClick={() => {
            const h = handles.current;
            if (!h) return;
            h.target.zoom = 1;
            h.target.rx = 0.45;
            h.lastInteraction = 0;
          }}
          aria-label="Ripristina vista"
        >
          <LocateFixed className="w-4 h-4" />
        </button>
      </div>
      {textureFailed && (
        <div className="absolute right-3 top-3 hub-label z-10">Texture terrestre non caricata · modalità griglia</div>
      )}
    </div>
  );
};
