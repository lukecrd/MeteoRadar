import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { WorldLayer } from '../services/worldEventsApi';

export interface GlobeMarker {
  id: string;
  layer: WorldLayer;
  lat: number;
  lon: number;
  /** Height above the surface in km (satellites); surface events omit it */
  altKm?: number;
  /** CSS hex colour */
  color: string;
  /** Point diameter in CSS px */
  size: number;
  title: string;
  detail?: string;
}

export interface GlobeFocus {
  lat: number;
  lon: number;
  /** Bump to re-trigger a focus on the same point */
  seq: number;
}

export interface TrackPoint {
  lat: number;
  lon: number;
  /** Omit for paths drawn on the surface */
  altKm?: number;
}

/** A polyline drawn on / above the globe (orbit, flight route, trail…). */
export interface GlobePath {
  id: string;
  points: TrackPoint[];
  color: string;
  opacity?: number;
}

interface WorldEventGlobeProps {
  isDark: boolean;
  /** Slow-changing surface events (quakes, flights, alerts) */
  markers: GlobeMarker[];
  /** Fast-changing orbital objects, re-sent every propagation tick */
  orbitals?: GlobeMarker[];
  /** Polylines to draw: satellite orbit, flight route, trail, heading… */
  paths?: GlobePath[];
  focus: GlobeFocus | null;
  /**
   * While set, the view keeps this point centred (follow mode). Any drag,
   * pinch, wheel or zoom button pauses auto-centring for FOLLOW_PAUSE_MS.
   */
  follow?: { lat: number; lon: number } | null;
  /** Changes when a new follow session starts (zooms in once). */
  followKey?: string | null;
  highlightId: string | null;
  onMarkerSelect?: (marker: GlobeMarker) => void;
  /** Tap / click on the globe that hit no marker */
  onEmptyClick?: () => void;
}

// Light-weight on purpose: coarse graticule, 110m coastline, one Points draw
// call per marker family, 30 fps cap and a capped pixel ratio.
const MERIDIANS = 12;
const PARALLELS = [-60, -30, 0, 30, 60];
const LINE_SEGMENTS = 48;
const MAX_PIXEL_RATIO = 1.25;
const FRAME_INTERVAL_MS = 1000 / 30;
const FIT_MARGIN = 1.12; // half-extent (world units) around the unit sphere at zoom 1 (leaves breathing room)
const AUTO_ROTATE_SPEED = 0.06; // rad/s
const IDLE_BEFORE_AUTOROTATE_MS = 5000;
const MAX_TILT = 1.3;
export const MIN_ZOOM = 0.6; // < 1 so high orbits (GPS/GEO) can be framed
export const MAX_ZOOM = 8;
const FOCUS_ZOOM = 1.8;
const FOLLOW_ZOOM = 3;
const FOLLOW_PAUSE_MS = 4000;
const NO_PATHS: GlobePath[] = [];
const D2R = Math.PI / 180;

const GEO_ALT_KM = 35786;
const ALT_SCALE_KM = 500;
/**
 * Altitude → radius (Earth = 1). Log-compressed so every orbit fits a
 * light-weight scene: ISS (~420 km) sits at ≈1.064 — nearly its true 1.066 —
 * while GPS (~20 200 km) lands at ≈1.39 and GEO at 1.45 instead of the true
 * 4.2 and 6.6 Earth radii. Order is preserved; distances are not to scale.
 */
export function altitudeToRadius(altKm: number): number {
  const h = Math.max(0, altKm);
  return 1 + (0.45 * Math.log(1 + h / ALT_SCALE_KM)) / Math.log(1 + GEO_ALT_KM / ALT_SCALE_KM);
}

/** lat/lon (deg) → point on a sphere of radius r. Greenwich faces +z at rest. */
function toVec3(lat: number, lon: number, r = 1): [number, number, number] {
  const phi = lat * D2R;
  const theta = lon * D2R;
  return [r * Math.cos(phi) * Math.sin(theta), r * Math.sin(phi), r * Math.cos(phi) * Math.cos(theta)];
}

const markerRadius = (m: GlobeMarker) => (m.altKm != null ? altitudeToRadius(m.altKm) : 1.006);

function buildGraticule(): THREE.BufferGeometry {
  const verts: number[] = [];
  const half = LINE_SEGMENTS / 2;
  for (let m = 0; m < MERIDIANS; m++) {
    const lon = (360 / MERIDIANS) * m;
    for (let i = 0; i < half; i++) {
      verts.push(...toVec3(-90 + (180 / half) * i, lon), ...toVec3(-90 + (180 / half) * (i + 1), lon));
    }
  }
  for (const lat of PARALLELS) {
    for (let i = 0; i < LINE_SEGMENTS; i++) {
      verts.push(...toVec3(lat, (360 / LINE_SEGMENTS) * i), ...toVec3(lat, (360 / LINE_SEGMENTS) * (i + 1)));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return geo;
}

// Natural Earth 110m coastline (via world-atlas), pre-flattened to
// [lon,lat,lon,lat,…] polylines in public/geo — ~55 KB, fetched once.
let coastlinePromise: Promise<number[][]> | null = null;
function loadCoastline(): Promise<number[][]> {
  if (!coastlinePromise) {
    const base = ((import.meta as any).env?.BASE_URL as string | undefined) ?? '/';
    coastlinePromise = fetch(`${base}geo/coastline-110m.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
  }
  return coastlinePromise;
}

function buildCoastline(lines: number[][]): THREE.BufferGeometry {
  const verts: number[] = [];
  for (const line of lines) {
    for (let i = 0; i + 3 < line.length; i += 2) {
      verts.push(...toVec3(line[i + 1], line[i], 1.001), ...toVec3(line[i + 3], line[i + 2], 1.001));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return geo;
}

const MARKER_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  uniform float uScale;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale * uPixelRatio;
  }
`;
const MARKER_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uRing;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = uRing > 0.5
      ? smoothstep(0.5, 0.44, d) * smoothstep(0.30, 0.37, d)
      : smoothstep(0.5, 0.36, d);
    gl_FragColor = vec4(vColor, a * uOpacity);
  }
`;

function makeMarkerMaterial(opacity: number, ring: boolean, pixelRatio: number) {
  return new THREE.ShaderMaterial({
    vertexShader: MARKER_VERTEX,
    fragmentShader: MARKER_FRAGMENT,
    uniforms: {
      uPixelRatio: { value: pixelRatio },
      uScale: { value: 1 },
      uOpacity: { value: opacity },
      uRing: { value: ring ? 1 : 0 },
    },
    transparent: true,
    depthWrite: false,
  });
}

const tmpColor = new THREE.Color();
function srgb(hex: string): [number, number, number] {
  // Shader output is not colour-managed, so feed it raw sRGB values.
  tmpColor.setStyle(hex);
  const out = { r: 0, g: 0, b: 0 };
  tmpColor.getRGB(out, THREE.SRGBColorSpace);
  return [out.r, out.g, out.b];
}

function shortestAngle(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d;
}

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

interface PointSet {
  geo: THREE.BufferGeometry;
  list: GlobeMarker[];
  positions: Float32Array;
}

interface SceneApi {
  setMarkers: (markers: GlobeMarker[]) => void;
  setOrbitals: (markers: GlobeMarker[]) => void;
  setPaths: (paths: GlobePath[]) => void;
  setHighlight: (marker: GlobeMarker | null) => void;
  pick: (x: number, y: number) => GlobeMarker | null;
}

/**
 * Centred, fully visible interactive globe that plots real-time events at
 * their real coordinates (satellites at log-scaled altitude). Drag to
 * rotate, wheel / pinch / buttons to zoom, hover or tap a marker for a
 * tooltip; `focus` spins a point to the front and zooms in a little.
 */
export const WorldEventGlobe: React.FC<WorldEventGlobeProps> = ({
  isDark,
  markers,
  orbitals = [],
  paths = NO_PATHS,
  focus,
  follow = null,
  followKey = null,
  highlightId,
  onMarkerSelect,
  onEmptyClick,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<SceneApi | null>(null);
  const markersRef = useRef<GlobeMarker[]>(markers);
  const orbitalsRef = useRef<GlobeMarker[]>(orbitals);
  const pathsRef = useRef<GlobePath[]>(paths);
  const followRef = useRef(follow);
  followRef.current = follow;
  const onEmptyRef = useRef(onEmptyClick);
  onEmptyRef.current = onEmptyClick;
  const highlightRef = useRef<GlobeMarker | null>(null);
  const tipMarkerRef = useRef<GlobeMarker | null>(null);
  const onSelectRef = useRef(onMarkerSelect);
  onSelectRef.current = onMarkerSelect;

  // View state lives outside the scene effect so a theme switch keeps it.
  const view = useRef({
    x: 0.5,
    y: -12 * D2R,
    targetX: null as number | null,
    targetY: null as number | null,
    zoom: 1,
    targetZoom: 1,
    lastInteraction: 0,
    /** Last explicit user gesture (drag / pinch / wheel / buttons) */
    lastUserInput: 0,
  });
  const [tip, setTip] = useState<GlobeMarker | null>(null);
  const [zoomLabel, setZoomLabel] = useState(1);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
    camera.position.set(0, 0, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(pixelRatio);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    const lineColor = isDark ? 0x7dd3fc : 0x0e7490;
    const group = new THREE.Group();
    scene.add(group);

    // Body writes depth first so the far hemisphere (grid + markers) is hidden.
    const bodyGeo = new THREE.SphereGeometry(0.99, 32, 20);
    const bodyMat = new THREE.MeshBasicMaterial({ color: isDark ? 0x07182a : 0xe0f2fe, transparent: true, opacity: isDark ? 0.85 : 0.75 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.renderOrder = -1;
    group.add(body);

    const gridGeo = buildGraticule();
    const gridMat = new THREE.LineBasicMaterial({ color: lineColor, transparent: true, opacity: isDark ? 0.12 : 0.14, depthWrite: false });
    group.add(new THREE.LineSegments(gridGeo, gridMat));

    const coastMat = new THREE.LineBasicMaterial({ color: isDark ? 0x67e8f9 : 0x0e7490, transparent: true, opacity: isDark ? 0.45 : 0.5, depthWrite: false });
    let coastGeo: THREE.BufferGeometry | null = null;
    let disposed = false;
    loadCoastline().then((lines) => {
      if (disposed || lines.length === 0) return;
      coastGeo = buildCoastline(lines);
      group.add(new THREE.LineSegments(coastGeo, coastMat));
    });

    // Limb outline lives in the scene (not the group) so it never rotates;
    // it scales with zoom through the camera like everything else.
    const limbGeo = new THREE.RingGeometry(0.995, 1.004, 128);
    const limbMat = new THREE.MeshBasicMaterial({ color: lineColor, transparent: true, opacity: isDark ? 0.5 : 0.35, depthWrite: false });
    scene.add(new THREE.Mesh(limbGeo, limbMat));

    // Polylines (satellite orbit, flight route / trail / heading).
    const pathGroup = new THREE.Group();
    group.add(pathGroup);
    const clearPaths = () => {
      for (const child of [...pathGroup.children]) {
        const line = child as THREE.Line;
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
        pathGroup.remove(line);
      }
    };

    // Two point families: surface markers and orbitals (updated every tick).
    const markerMat = makeMarkerMaterial(0.95, false, pixelRatio);
    const orbitalMat = makeMarkerMaterial(0.9, false, pixelRatio);
    const sets: Record<'markers' | 'orbitals', PointSet> = {
      markers: { geo: new THREE.BufferGeometry(), list: [], positions: new Float32Array(0) },
      orbitals: { geo: new THREE.BufferGeometry(), list: [], positions: new Float32Array(0) },
    };
    const markerPoints = new THREE.Points(sets.markers.geo, markerMat);
    const orbitalPoints = new THREE.Points(sets.orbitals.geo, orbitalMat);
    markerPoints.frustumCulled = false;
    orbitalPoints.frustumCulled = false;
    group.add(markerPoints, orbitalPoints);

    const hlGeo = new THREE.BufferGeometry();
    hlGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    hlGeo.setAttribute('aColor', new THREE.Float32BufferAttribute([1, 1, 1], 3));
    hlGeo.setAttribute('aSize', new THREE.Float32BufferAttribute([28], 1));
    const hlMat = makeMarkerMaterial(1, true, pixelRatio);
    const hlPoints = new THREE.Points(hlGeo, hlMat);
    hlPoints.frustumCulled = false;
    hlPoints.visible = false;
    group.add(hlPoints);

    const fill = (set: PointSet, list: GlobeMarker[]) => {
      const pos = new Float32Array(list.length * 3);
      const col = new Float32Array(list.length * 3);
      const size = new Float32Array(list.length);
      list.forEach((m, i) => {
        pos.set(toVec3(m.lat, m.lon, markerRadius(m)), i * 3);
        col.set(srgb(m.color), i * 3);
        size[i] = m.size;
      });
      set.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      set.geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      set.geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      set.list = list;
      set.positions = pos;
    };

    const setPaths = (list: GlobePath[]) => {
      clearPaths();
      for (const p of list) {
        if (p.points.length < 2) continue;
        const verts = new Float32Array(p.points.length * 3);
        p.points.forEach((pt, i) => verts.set(toVec3(pt.lat, pt.lon, pt.altKm != null ? altitudeToRadius(pt.altKm) : 1.004), i * 3));
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
        const mat = new THREE.LineBasicMaterial({ color: p.color, transparent: true, opacity: p.opacity ?? 0.75, depthWrite: false });
        const line = new THREE.Line(geo, mat);
        line.frustumCulled = false;
        pathGroup.add(line);
      }
    };

    const setHighlight = (m: GlobeMarker | null) => {
      hlPoints.visible = !!m;
      if (!m) return;
      (hlGeo.getAttribute('position') as THREE.BufferAttribute).set(toVec3(m.lat, m.lon, markerRadius(m) + 0.002));
      (hlGeo.getAttribute('aColor') as THREE.BufferAttribute).set(srgb(m.color));
      (hlGeo.getAttribute('aSize') as THREE.BufferAttribute).set([Math.max(22, m.size * 2.6)]);
      hlGeo.getAttribute('position').needsUpdate = true;
      hlGeo.getAttribute('aColor').needsUpdate = true;
      hlGeo.getAttribute('aSize').needsUpdate = true;
    };

    const v = new THREE.Vector3();
    /**
     * Screen position (CSS px within host) of a local point, or null when the
     * Earth hides it (behind the planet and inside its silhouette).
     */
    const project = (x: number, y: number, z: number) => {
      v.set(x, y, z).applyMatrix4(group.matrixWorld);
      if (v.z < 0.02 && v.x * v.x + v.y * v.y < 1.02) return null;
      v.project(camera);
      if (Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) return null;
      return { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight };
    };

    const pick = (px: number, py: number): GlobeMarker | null => {
      let best: GlobeMarker | null = null;
      let bestD = Infinity;
      for (const set of [sets.orbitals, sets.markers]) {
        for (let i = 0; i < set.list.length; i++) {
          const p = project(set.positions[i * 3], set.positions[i * 3 + 1], set.positions[i * 3 + 2]);
          if (!p) continue;
          const d = Math.hypot(p.x - px, p.y - py);
          if (d < Math.max(9, set.list[i].size / 2 + 5) && d < bestD) {
            best = set.list[i];
            bestD = d;
          }
        }
      }
      return best;
    };

    apiRef.current = {
      setMarkers: (l) => fill(sets.markers, l),
      setOrbitals: (l) => fill(sets.orbitals, l),
      setPaths,
      setHighlight,
      pick,
    };
    fill(sets.markers, markersRef.current);
    fill(sets.orbitals, orbitalsRef.current);
    setPaths(pathsRef.current);
    setHighlight(highlightRef.current);

    let baseScale = 1;
    const applyMarkerScale = () => {
      // Points grow gently with zoom so dense areas separate when zoomed in.
      const s = baseScale * (1 + (Math.min(view.current.zoom, 4) - 1) * 0.12);
      markerMat.uniforms.uScale.value = s;
      orbitalMat.uniforms.uScale.value = s;
    };

    const fit = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      // "Contain" fit at zoom 1: the whole sphere stays visible, centred.
      if (w >= h) {
        camera.top = FIT_MARGIN;
        camera.right = (FIT_MARGIN * w) / h;
      } else {
        camera.right = FIT_MARGIN;
        camera.top = (FIT_MARGIN * h) / w;
      }
      camera.bottom = -camera.top;
      camera.left = -camera.right;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      const diameterPx = Math.min(w, h) / FIT_MARGIN;
      baseScale = Math.min(1, Math.max(0.6, diameterPx / 520));
      applyMarkerScale();
    };
    fit();
    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(host);

    let frameId = 0;
    let last = performance.now();
    let lastZoomLabel = 1;
    const loop = (now: number) => {
      frameId = requestAnimationFrame(loop);
      if (document.visibilityState !== 'visible' || now - last < FRAME_INTERVAL_MS) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const r = view.current;

      // Follow mode: keep the followed point centred unless the user has just
      // taken over with a gesture (auto-centring resumes after a pause).
      const fol = followRef.current;
      if (fol && Date.now() - r.lastUserInput > FOLLOW_PAUSE_MS) {
        r.targetX = Math.max(-MAX_TILT, Math.min(MAX_TILT, fol.lat * D2R));
        r.targetY = shortestAngle(r.y, -fol.lon * D2R);
        r.lastInteraction = Date.now();
      }

      if (r.targetX !== null && r.targetY !== null) {
        const k = Math.min(1, dt * 4);
        r.x += (r.targetX - r.x) * k;
        r.y += (r.targetY - r.y) * k;
        if (Math.abs(r.targetX - r.x) < 0.002 && Math.abs(r.targetY - r.y) < 0.002) {
          r.targetX = r.targetY = null;
        }
      } else if (!prefersReducedMotion && Date.now() - r.lastInteraction > IDLE_BEFORE_AUTOROTATE_MS) {
        r.y += (AUTO_ROTATE_SPEED * dt) / Math.max(1, r.zoom);
      }

      if (Math.abs(r.targetZoom - r.zoom) > 0.0005) {
        r.zoom += (r.targetZoom - r.zoom) * Math.min(1, dt * (prefersReducedMotion ? 30 : 8));
        camera.zoom = r.zoom;
        camera.updateProjectionMatrix();
        applyMarkerScale();
        if (Math.abs(r.zoom - lastZoomLabel) > 0.05) {
          lastZoomLabel = r.zoom;
          setZoomLabel(Math.round(r.zoom * 10) / 10);
        }
      }

      group.rotation.set(r.x, r.y, 0);
      group.updateMatrixWorld();

      if (hlPoints.visible && !prefersReducedMotion) {
        hlMat.uniforms.uScale.value = 1 + 0.18 * Math.sin(now / 260);
      }

      // Tooltip follows its marker while the globe turns / zooms.
      const tipEl = tipRef.current;
      const tm = tipMarkerRef.current;
      if (tipEl) {
        const p = tm ? project(...toVec3(tm.lat, tm.lon, markerRadius(tm))) : null;
        if (p) {
          // Keep the tooltip inside the globe box near the right edge.
          const tipW = (tipEl.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
          const x = Math.max(0, Math.min(p.x, host.clientWidth - tipW - 20));
          tipEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(p.y)}px)`;
          tipEl.style.opacity = '1';
        } else {
          tipEl.style.opacity = '0';
        }
      }
      renderer.render(scene, camera);
    };
    frameId = requestAnimationFrame(loop);

    // Wheel zoom: a native non-passive listener so only wheel events over the
    // globe are captured; the page scrolls normally everywhere else.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = view.current;
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      r.targetZoom = clampZoom(r.targetZoom * Math.exp(-delta * 0.0015));
      r.lastInteraction = r.lastUserInput = Date.now();
    };
    host.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      host.removeEventListener('wheel', onWheel);
      apiRef.current = null;
      clearPaths();
      [bodyGeo, gridGeo, limbGeo, sets.markers.geo, sets.orbitals.geo, hlGeo, coastGeo].forEach((g) => g?.dispose());
      [bodyMat, gridMat, coastMat, limbMat, markerMat, orbitalMat, hlMat].forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [isDark]);

  // Data updates never rebuild the scene.
  useEffect(() => {
    markersRef.current = markers;
    apiRef.current?.setMarkers(markers);
  }, [markers]);

  const highlighted = highlightId
    ? markers.find((m) => m.id === highlightId) ?? orbitals.find((m) => m.id === highlightId) ?? null
    : null;

  const [hovered, setHovered] = useState<GlobeMarker | null>(null);

  useEffect(() => {
    orbitalsRef.current = orbitals;
    apiRef.current?.setOrbitals(orbitals);
  }, [orbitals]);

  useEffect(() => {
    pathsRef.current = paths;
    apiRef.current?.setPaths(paths);
  }, [paths]);

  // New follow session: zoom in once (the loop handles centring).
  useEffect(() => {
    if (!followKey) return;
    const r = view.current;
    r.targetZoom = Math.max(r.targetZoom, FOLLOW_ZOOM);
    r.lastUserInput = 0;
  }, [followKey]);

  useEffect(() => {
    highlightRef.current = highlighted;
    apiRef.current?.setHighlight(highlighted);
  }, [highlighted]);

  // Tooltip shows the hovered marker, falling back to the highlighted one.
  // Orbitals move, so re-resolve the hovered one by id on every tick.
  const hoveredLive = hovered ? (hovered.altKm != null ? orbitals.find((o) => o.id === hovered.id) ?? null : hovered) : null;
  useEffect(() => {
    const m = hoveredLive ?? highlighted;
    tipMarkerRef.current = m;
    setTip(m);
  }, [hoveredLive, highlighted]);

  useEffect(() => {
    if (!focus) return;
    const r = view.current;
    r.targetX = Math.max(-MAX_TILT, Math.min(MAX_TILT, focus.lat * D2R));
    r.targetY = shortestAngle(r.y, -focus.lon * D2R);
    r.targetZoom = Math.max(r.targetZoom, FOCUS_ZOOM);
    r.lastInteraction = Date.now();
  }, [focus]);

  const zoomBy = (factor: number) => {
    const r = view.current;
    r.targetZoom = clampZoom(r.targetZoom * factor);
    r.lastInteraction = r.lastUserInput = Date.now();
  };
  const resetView = () => {
    const r = view.current;
    r.targetZoom = 1;
    r.targetX = 0.5;
    r.targetY = shortestAngle(r.y, -12 * D2R);
    r.lastInteraction = 0;
    r.lastUserInput = Date.now();
  };

  // ---- Pointer interaction: drag to rotate, pinch to zoom, tap to select ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ moved: number; pinchDist: number | null }>({ moved: 0, pinchDist: null });

  const localXY = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const pinchDistance = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) drag.current = { moved: 0, pinchDist: null };
    else {
      drag.current.pinchDist = pinchDistance();
      drag.current.moved = Infinity; // a pinch is never a tap
    }
    view.current.lastInteraction = Date.now();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (prev) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = view.current;
      r.lastInteraction = Date.now();

      if (pointers.current.size >= 2) {
        const dist = pinchDistance();
        if (dist && drag.current.pinchDist) {
          r.lastUserInput = Date.now();
          r.targetZoom = clampZoom(r.targetZoom * (dist / drag.current.pinchDist));
          drag.current.pinchDist = dist;
        }
        return;
      }

      drag.current.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.current.moved > 4) {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.setPointerCapture(e.pointerId);
        const host = e.currentTarget;
        // Rotation speed scales with zoom so a drag tracks the surface.
        const k = (Math.PI * 0.9) / Math.max(200, Math.min(host.clientWidth, host.clientHeight)) / r.zoom;
        r.targetX = r.targetY = null;
        r.lastUserInput = Date.now();
        r.y += dx * k;
        r.x = Math.max(-MAX_TILT, Math.min(MAX_TILT, r.x + dy * k));
      }
      return;
    }
    if (e.pointerType === 'mouse') {
      const { x, y } = localXY(e);
      const hit = apiRef.current?.pick(x, y) ?? null;
      setHovered((p) => (p?.id === hit?.id ? p : hit));
    }
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>, isTap: boolean) => {
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1) drag.current.pinchDist = null;
    if (!isTap || !wasSingle || drag.current.moved > 4) return;
    const { x, y } = localXY(e);
    const hit = apiRef.current?.pick(x, y);
    if (hit) onSelectRef.current?.(hit);
    else onEmptyRef.current?.();
  };

  const total = markers.length + orbitals.length;

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        ref={hostRef}
        role="img"
        aria-label={`Mappamondo con ${total} oggetti in tempo reale. Trascina per ruotare, rotella o pizzico per lo zoom.`}
        className="absolute inset-0 cursor-grab active:cursor-grabbing [touch-action:pan-y]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, true)}
        onPointerCancel={(e) => endPointer(e, false)}
        onPointerLeave={(e) => {
          setHovered(null);
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) pointers.current.delete(e.pointerId);
        }}
      />

      {/* Zoom controls */}
      <div className="absolute right-2 bottom-2 z-10 flex flex-col gap-1" role="group" aria-label="Zoom mappamondo">
        <button type="button" className="hub-icon-btn !h-8 !min-w-8 !px-0" onClick={() => zoomBy(1.4)} aria-label="Ingrandisci" title="Ingrandisci">
          <Plus className="w-4 h-4" />
        </button>
        <button type="button" className="hub-icon-btn !h-8 !min-w-8 !px-0" onClick={() => zoomBy(1 / 1.4)} aria-label="Riduci" title="Riduci">
          <Minus className="w-4 h-4" />
        </button>
        <button type="button" className="hub-icon-btn !h-8 !min-w-8 !px-0" onClick={resetView} aria-label="Ripristina vista" title="Ripristina vista">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <span className="font-hud text-xs text-center text-[var(--hub-dim)] tabular-nums" aria-live="polite">
          {zoomLabel.toFixed(1)}×
        </span>
      </div>

      <div
        ref={tipRef}
        aria-hidden={!tip}
        className="pointer-events-none absolute left-0 top-0 z-10 transition-opacity duration-150"
        style={{ opacity: 0 }}
      >
        {tip && (
          <div className="ml-3 -mt-3 -translate-y-full w-max max-w-[240px] hub-panel !rounded-lg px-3 py-2 text-xs shadow-lg bg-[var(--hub-panel-strong)]">
            <div className="flex items-center gap-1.5 font-semibold leading-snug">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tip.color }} />
              {tip.title}
            </div>
            {tip.detail && <div className="text-[var(--hub-dim)] mt-0.5 leading-snug">{tip.detail}</div>}
          </div>
        )}
      </div>
    </div>
  );
};
