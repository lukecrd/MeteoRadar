import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Minus, Plus, LocateFixed, Sun, Moon } from 'lucide-react';

export interface GlobeMarker {
  id: string;
  kind: 'news' | 'market' | 'quake' | 'airport';
  lat: number;
  lon: number;
  label: string;
  sublabel?: string;
  color: string;
  /** 0-1: drives beam height, size and pulse speed */
  heat: number;
  dimmed?: boolean;
}

export interface GlobeFlight {
  id: string;
  lat: number;
  lon: number;
  /** track over ground, degrees */
  trk: number | null;
  /** ground speed, knots */
  gs: number | null;
  /** altitude, feet */
  alt: number;
  color: string;
  label: string;
  sublabel?: string;
}

export interface GlobeRoute {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  /** current aircraft position: splits the arc into flown / remaining */
  via: { lat: number; lon: number } | null;
  color: string;
}

interface HubGlobe3DProps {
  markers: GlobeMarker[];
  flights?: GlobeFlight[];
  route?: GlobeRoute | null;
  /** faint circles showing where live air traffic is sampled */
  coverage?: { lat: number; lon: number; radiusKm: number }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** the globe turns to face this point whenever it changes */
  focus: { lat: number; lon: number } | null;
}

interface PickInfo {
  id: string;
  label: string;
  sublabel?: string;
  color: string;
}

// NASA Blue Marble / Earth at Night (public domain), as packaged by three-globe (MIT).
const EARTH_TEXTURES = {
  day: 'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg',
  night: 'https://unpkg.com/three-globe@2.31.0/example/img/earth-night.jpg',
} as const;
type EarthStyle = keyof typeof EARTH_TEXTURES;
const EARTH_STYLE_KEY = 'globalhub_earth_style';
const R = 1;
const EARTH_KM = 6371;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 3;
/** world-space radius (globe + halo) that must fit inside the viewport at zoom 1 */
const FIT_RADIUS = 1.17;
/** how often aircraft positions are dead-reckoned forward between data updates */
const FLIGHT_TICK_MS = 500;
/** never extrapolate a stale position further than this */
const MAX_EXTRAPOLATION_MS = 5 * 60 * 1000;

function fitDistance(fovDeg: number, aspect: number): number {
  const half = THREE.MathUtils.degToRad(fovDeg) / 2;
  const hHalf = Math.atan(Math.tan(half) * aspect);
  return FIT_RADIUS / Math.sin(Math.min(half, hHalf));
}

/** Matches SphereGeometry's UV layout so markers land on the texture. */
function latLonToVec3(lat: number, lon: number, r = R, out = new THREE.Vector3()): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return out.set(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Points along the great circle a→b, lifted into an arc above the surface. */
function arcPoints(a: { lat: number; lon: number }, b: { lat: number; lon: number }, segments = 96): THREE.Vector3[] {
  const va = latLonToVec3(a.lat, a.lon).normalize();
  const vb = latLonToVec3(b.lat, b.lon).normalize();
  const angle = va.angleTo(vb);
  const lift = Math.min(0.28, 0.03 + angle * 0.12);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Spherical interpolation, falling back to lerp for (near) identical points.
    const s = Math.sin(angle);
    const v =
      s < 1e-6
        ? va.clone().lerp(vb, t).normalize()
        : va.clone().multiplyScalar(Math.sin((1 - t) * angle) / s).add(vb.clone().multiplyScalar(Math.sin(t * angle) / s));
    pts.push(v.multiplyScalar(R * (1.004 + lift * Math.sin(Math.PI * t))));
  }
  return pts;
}

interface MarkerObjects {
  id: string;
  root: THREE.Group;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  ring2: THREE.Mesh | null;
  ring2Mat: THREE.MeshBasicMaterial | null;
  hit: THREE.Mesh;
  marker: GlobeMarker;
  phase: number;
  baseScale: number;
}

interface FlightState {
  data: GlobeFlight[];
  receivedAt: number;
  /** current local positions (inside the globe group), one per flight */
  positions: THREE.Vector3[];
  mesh: THREE.InstancedMesh | null;
  hit: THREE.InstancedMesh | null;
}

interface SceneHandles {
  globe: THREE.Group;
  markerGroup: THREE.Group;
  overlayGroup: THREE.Group;
  routeGroup: THREE.Group;
  coverageGroup: THREE.Group;
  earth: THREE.Mesh;
  applyStyle: (style: EarthStyle) => void;
  camera: THREE.PerspectiveCamera;
  shared: {
    core: THREE.SphereGeometry;
    ring: THREE.RingGeometry;
    beam: THREE.CylinderGeometry;
    hit: THREE.SphereGeometry;
    diamond: THREE.OctahedronGeometry;
    plane: THREE.ConeGeometry;
    planeHit: THREE.SphereGeometry;
  };
  markers: MarkerObjects[];
  flights: FlightState;
  flightSel: THREE.Mesh;
  target: { rx: number; ry: number; zoom: number };
  fitZ: number;
  lastInteraction: number;
  updateFlights: () => void;
}

const disposeTree = (obj: THREE.Object3D) =>
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((m) => m.dispose());
  });

export const HubGlobe3D: React.FC<HubGlobe3DProps> = ({ markers, flights = [], route = null, coverage = [], selectedId, onSelect, focus }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const handles = useRef<SceneHandles | null>(null);
  const selectedRef = useRef<string | null>(selectedId);
  const hoveredRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  const [hovered, setHovered] = useState<PickInfo | null>(null);
  const [textureFailed, setTextureFailed] = useState(false);
  const [earthStyle, setEarthStyle] = useState<EarthStyle>(() => {
    try {
      return localStorage.getItem(EARTH_STYLE_KEY) === 'night' ? 'night' : 'day';
    } catch {
      return 'day';
    }
  });

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
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.05, 100);
    camera.position.set(0, 0, fitDistance(38, width / height));

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
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
    const textures = new Map<EarthStyle, THREE.Texture>();
    let wantedStyle: EarthStyle = 'day';
    // Day: evenly lit Blue Marble. Night: city lights doubling as emissive glow.
    const paint = (style: EarthStyle, tex: THREE.Texture) => {
      earthMat.map = tex;
      if (style === 'day') {
        earthMat.emissiveMap = null;
        earthMat.color.set(0xffffff);
        earthMat.emissive.set(0x0a1424);
        earthMat.emissiveIntensity = 1;
        ambient.intensity = 1.25;
        sun.intensity = 1.3;
      } else {
        earthMat.emissiveMap = tex;
        earthMat.color.set(0xb8d4ff);
        earthMat.emissive.set(0xffc27a);
        earthMat.emissiveIntensity = 0.9;
        ambient.intensity = 0.55;
        sun.intensity = 1.1;
      }
      earthMat.needsUpdate = true;
    };
    const applyStyle = (style: EarthStyle) => {
      wantedStyle = style;
      const cached = textures.get(style);
      if (cached) return paint(style, cached);
      loader.load(
        EARTH_TEXTURES[style],
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          textures.set(style, tex);
          if (wantedStyle === style) paint(style, tex);
        },
        undefined,
        () => setTextureFailed(true)
      );
    };

    // Lat/lon graticule: the "instrument" layer over the planet.
    const gratPts: number[] = [];
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = -180; lon < 180; lon += 3) {
        latLonToVec3(lat, lon, R * 1.004, a);
        latLonToVec3(lat, lon + 3, R * 1.004, b);
        gratPts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    for (let lon = -180; lon < 180; lon += 30) {
      for (let lat = -87; lat < 87; lat += 3) {
        latLonToVec3(lat, lon, R * 1.004, a);
        latLonToVec3(lat + 3, lon, R * 1.004, b);
        gratPts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const gratGeo = new THREE.BufferGeometry();
    gratGeo.setAttribute('position', new THREE.Float32BufferAttribute(gratPts, 3));
    globe.add(new THREE.LineSegments(gratGeo, new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.12 })));

    // Fresnel atmosphere halo.
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vNormal; void main(){ vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vNormal; void main(){ float i = pow(0.68 - dot(vNormal, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(0.13, 0.83, 0.93, 1.0) * i * 0.55; }`,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.1, 64, 64), atmoMat));

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
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbfe9ff, size: 0.06, transparent: true, opacity: 0.6 })));

    const markerGroup = new THREE.Group();
    const overlayGroup = new THREE.Group(); // flights
    const routeGroup = new THREE.Group();
    const coverageGroup = new THREE.Group();
    globe.add(coverageGroup, routeGroup, markerGroup, overlayGroup);

    // Pulsing ring that follows the selected aircraft.
    const flightSel = new THREE.Mesh(
      new THREE.RingGeometry(0.008, 0.0105, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    );
    flightSel.visible = false;
    overlayGroup.add(flightSel);

    // Start with Europe/Africa facing the viewer.
    const start = latLonToVec3(30, 15);
    const startRy = -Math.atan2(start.x, start.z);
    globe.rotation.set(0.45, startRy, 0);

    // Tiny arrowheads: hundreds share the view, so they must not cover the map.
    const planeGeo = new THREE.ConeGeometry(0.0017, 0.0062, 3);
    const h: SceneHandles = {
      globe,
      markerGroup,
      overlayGroup,
      routeGroup,
      coverageGroup,
      earth,
      applyStyle,
      camera,
      shared: {
        core: new THREE.SphereGeometry(0.014, 12, 12),
        ring: new THREE.RingGeometry(0.022, 0.028, 40),
        beam: new THREE.CylinderGeometry(0.0035, 0.0035, 1, 6, 1, true),
        hit: new THREE.SphereGeometry(0.055, 8, 8),
        diamond: new THREE.OctahedronGeometry(0.02),
        plane: planeGeo,
        planeHit: new THREE.SphereGeometry(0.011, 6, 6),
      },
      markers: [],
      flights: { data: [], receivedAt: 0, positions: [], mesh: null, hit: null },
      flightSel,
      target: { rx: 0.45, ry: startRy, zoom: 1 },
      fitZ: camera.position.z,
      lastInteraction: 0,
      updateFlights: () => {},
    };
    handles.current = h;

    // ---- Aircraft dead reckoning ----
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const unit = new THREE.Vector3(1, 1, 1);
    const yAxis = new THREE.Vector3(0, 1, 0);
    const pN = new THREE.Vector3();
    const pE = new THREE.Vector3();
    const dir = new THREE.Vector3();
    h.updateFlights = () => {
      const fs = h.flights;
      if (!fs.mesh || !fs.hit) return;
      const hours = Math.min(Date.now() - fs.receivedAt, MAX_EXTRAPOLATION_MS) / 3.6e6;
      fs.data.forEach((f, i) => {
        let lat = f.lat;
        let lon = f.lon;
        const trk = THREE.MathUtils.degToRad(f.trk ?? 0);
        if (f.gs && f.trk != null) {
          const km = f.gs * 1.852 * hours;
          lat += (km * Math.cos(trk)) / 111.2;
          lon += (km * Math.sin(trk)) / (111.2 * Math.max(0.05, Math.cos(THREE.MathUtils.degToRad(lat))));
        }
        const r = R * (1.006 + (Math.min(Math.max(f.alt, 0), 45000) / 45000) * 0.016);
        const pos = latLonToVec3(lat, lon, r, fs.positions[i] ?? (fs.positions[i] = new THREE.Vector3()));
        // Local north/east by finite difference → heading vector on the tangent plane.
        latLonToVec3(lat + 0.05, lon, r, pN).sub(pos);
        latLonToVec3(lat, lon + 0.05, r, pE).sub(pos);
        dir.copy(pN.normalize()).multiplyScalar(Math.cos(trk)).addScaledVector(pE.normalize(), Math.sin(trk)).normalize();
        q.setFromUnitVectors(yAxis, dir);
        m4.compose(pos, q, unit);
        fs.mesh!.setMatrixAt(i, m4);
        m4.compose(pos, q.identity(), unit);
        fs.hit!.setMatrixAt(i, m4);
      });
      fs.mesh.instanceMatrix.needsUpdate = true;
      fs.hit.instanceMatrix.needsUpdate = true;
      // Raycasting culls against the bounding sphere, which must follow the aircraft.
      fs.hit.computeBoundingSphere();
    };

    // ---- Pointer interaction ----
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2(9, 9);
    let pointerInside = false;
    let drag: { x: number; y: number; startX: number; startY: number; moved: boolean } | null = null;

    const setNdc = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    };

    const infoFor = (obj: THREE.Object3D, instanceId: number | undefined): PickInfo | null => {
      if (obj === h.flights.hit && instanceId != null) {
        const f = h.flights.data[instanceId];
        return f ? { id: f.id, label: f.label, sublabel: f.sublabel, color: f.color } : null;
      }
      const m = h.markers.find((mm) => mm.hit === obj);
      return m ? { id: m.id, label: m.marker.label, sublabel: m.marker.sublabel, color: m.marker.color } : null;
    };

    const pick = (): PickInfo | null => {
      raycaster.setFromCamera(ndc, camera);
      const targets: THREE.Object3D[] = [earth, ...h.markers.map((m) => m.hit)];
      if (h.flights.hit) targets.push(h.flights.hit);
      const hits = raycaster.intersectObjects(targets, false);
      const first = hits[0];
      if (!first) return null;
      if (first.object !== earth) return infoFor(first.object, first.instanceId);
      // Markers sit just above the surface: allow a hit slightly "inside" the earth hit.
      const near = hits.find((x) => x.object !== earth && x.distance - first.distance < 0.05);
      return near ? infoFor(near.object, near.instanceId) : null;
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
        const hit = pick();
        if (hit) onSelectRef.current(hit.id);
      }
      drag = null;
      renderer.domElement.style.cursor = hoveredRef.current ? 'pointer' : 'grab';
    };
    const onLeave = () => {
      pointerInside = false;
      ndc.set(9, 9);
    };
    const onCancel = () => (drag = null);
    const el = renderer.domElement;
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
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
    let lastFlightTick = 0;

    /** World position of whatever carries this id, or null. */
    const worldPosOf = (id: string | null, out: THREE.Vector3): THREE.Vector3 | null => {
      if (!id) return null;
      const m = h.markers.find((mm) => mm.id === id);
      if (m) return m.root.getWorldPosition(out);
      const i = h.flights.data.findIndex((f) => f.id === id);
      const p = i >= 0 ? h.flights.positions[i] : undefined;
      return p ? out.copy(p).applyMatrix4(globe.matrixWorld) : null;
    };

    const place = (elRef: HTMLDivElement | null, id: string | null) => {
      if (!elRef) return;
      const p = worldPosOf(id, tmp);
      if (!p) {
        elRef.style.opacity = '0';
        return;
      }
      camDir.copy(camera.position).sub(p);
      const facing = p.clone().normalize().dot(camDir.normalize()) > 0.05;
      p.project(camera);
      elRef.style.transform = `translate(${((p.x + 1) / 2) * width}px, ${((1 - p.y) / 2) * height}px)`;
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

      if (performance.now() - lastFlightTick > FLIGHT_TICK_MS) {
        lastFlightTick = performance.now();
        h.updateFlights();
      }

      for (const m of h.markers) {
        const isSel = m.id === selectedRef.current;
        const isHover = m.id === hoveredRef.current;
        const kind = m.marker.kind;
        if (kind === 'news' || kind === 'quake') {
          const period = kind === 'quake' ? 3.2 - m.marker.heat * 1.6 : 2.6 - m.marker.heat * 1.4;
          const p = reducedMotion ? 0.4 : ((t + m.phase) % period) / period;
          const spread = kind === 'quake' ? 2.6 : 1.5;
          m.ring.scale.setScalar(isSel ? 2.2 + Math.sin(t * 3) * 0.2 : 1 + p * spread);
          m.ringMat.opacity = (m.marker.dimmed ? 0.15 : isSel ? 0.95 : 0.85) * (isSel ? 1 : 1 - p);
          if (m.ring2 && m.ring2Mat) {
            const p2 = (p + 0.5) % 1;
            m.ring2.scale.setScalar(1 + p2 * spread);
            m.ring2Mat.opacity = (m.marker.dimmed ? 0.1 : 0.6) * (1 - p2);
          }
        } else {
          m.ring.scale.setScalar(isSel ? 2 : 1);
          m.ringMat.opacity = kind === 'airport' ? 0.95 : isSel || isHover ? 0.9 : 0;
        }
        m.root.scale.setScalar(m.baseScale * (isHover || isSel ? 1.35 : 1));
      }

      // Selected aircraft: pulsing ring that rides along with it.
      const selIdx = selectedRef.current ? h.flights.data.findIndex((f) => f.id === selectedRef.current) : -1;
      const selPos = selIdx >= 0 ? h.flights.positions[selIdx] : undefined;
      flightSel.visible = !!selPos;
      if (selPos) {
        flightSel.position.copy(selPos);
        flightSel.lookAt(tmp.copy(selPos).multiplyScalar(2));
        flightSel.scale.setScalar(1 + (reducedMotion ? 0 : Math.sin(t * 4) * 0.25));
      }

      // Hover picking once per frame instead of on every pointermove.
      if (pointerInside && !drag) {
        const hit = pick();
        const id = hit?.id ?? null;
        if (id !== hoveredRef.current) {
          hoveredRef.current = id;
          setHovered(hit);
          el.style.cursor = id ? 'pointer' : 'grab';
        }
      } else if (!pointerInside && hoveredRef.current) {
        hoveredRef.current = null;
        setHovered(null);
      }

      renderer.render(scene, camera);
      place(tooltipRef.current, hoveredRef.current !== selectedRef.current ? hoveredRef.current : null);
      place(labelRef.current, selectedRef.current);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('pointerleave', onLeave);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((mm) => mm.dispose());
      });
      Object.values(h.shared).forEach((g) => g.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      container.removeChild(renderer.domElement);
      handles.current = null;
    };
  }, []);

  // ---- Point markers (rebuilt when data changes) ----
  useEffect(() => {
    const h = handles.current;
    if (!h) return;
    for (const m of h.markers) {
      h.markerGroup.remove(m.root);
      disposeTree(m.root);
    }
    const up = new THREE.Vector3(0, 1, 0);
    h.markers = markers.map((marker, i) => {
      const normal = latLonToVec3(marker.lat, marker.lon).normalize();
      const color = new THREE.Color(marker.color);
      const root = new THREE.Group();
      root.position.copy(normal).multiplyScalar(R);
      root.quaternion.setFromUnitVectors(up, normal);

      const kind = marker.kind;
      const beamLen =
        kind === 'news' ? 0.05 + marker.heat * 0.16
        : kind === 'market' ? 0.04 + marker.heat * 0.2
        : kind === 'quake' ? 0.01 + marker.heat * 0.12
        : 0;
      const baseOpacity = marker.dimmed ? 0.2 : 1;

      if (beamLen > 0) {
        const beam = new THREE.Mesh(h.shared.beam, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 * baseOpacity, depthWrite: false }));
        beam.scale.y = beamLen;
        beam.position.y = beamLen / 2;
        root.add(beam);
      }

      const core = new THREE.Mesh(
        kind === 'market' ? h.shared.diamond : h.shared.core,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: baseOpacity })
      );
      core.position.y = kind === 'market' ? beamLen : 0.004;
      if (kind === 'airport') core.scale.setScalar(0.55);
      root.add(core);

      const makeRing = (opacity: number) => {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
        const mesh = new THREE.Mesh(h.shared.ring, mat);
        mesh.rotation.x = -Math.PI / 2; // ring geometry faces +z; lay it flat on the surface
        mesh.position.y = 0.003;
        root.add(mesh);
        return { mesh, mat };
      };
      const ring = makeRing(0.8);
      const ring2 = kind === 'quake' ? makeRing(0.6) : null;

      const hit = new THREE.Mesh(h.shared.hit, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.position.y = kind === 'market' ? beamLen * 0.7 : 0.02;
      root.add(hit);

      h.markerGroup.add(root);
      return {
        id: marker.id,
        root,
        ring: ring.mesh,
        ringMat: ring.mat,
        ring2: ring2?.mesh ?? null,
        ring2Mat: ring2?.mat ?? null,
        hit,
        marker,
        phase: (i * 0.37) % 2,
        baseScale: kind === 'quake' ? 0.6 + marker.heat * 1.1 : kind === 'airport' ? 0.8 : 1,
      };
    });
  }, [markers]);

  // ---- Aircraft (instanced; rebuilt only when the fleet size changes) ----
  useEffect(() => {
    const h = handles.current;
    if (!h) return;
    const fs = h.flights;
    if (!fs.mesh || fs.mesh.count !== flights.length) {
      for (const m of [fs.mesh, fs.hit]) {
        if (!m) continue;
        h.overlayGroup.remove(m);
        (m.material as THREE.Material).dispose();
        m.dispose();
      }
      fs.mesh = fs.hit = null;
      fs.positions = [];
      if (flights.length) {
        const mesh = new THREE.InstancedMesh(h.shared.plane, new THREE.MeshBasicMaterial({ color: 0xffffff }), flights.length);
        const hit = new THREE.InstancedMesh(
          h.shared.planeHit,
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
          flights.length
        );
        mesh.frustumCulled = false;
        hit.frustumCulled = false;
        h.overlayGroup.add(mesh, hit);
        fs.mesh = mesh;
        fs.hit = hit;
      }
    }
    fs.data = flights;
    fs.receivedAt = Date.now();
    if (fs.mesh) {
      const c = new THREE.Color();
      flights.forEach((f, i) => fs.mesh!.setColorAt(i, c.set(f.color)));
      if (fs.mesh.instanceColor) fs.mesh.instanceColor.needsUpdate = true;
    }
    h.updateFlights();
  }, [flights]);

  // ---- Route arc for the selected flight ----
  useEffect(() => {
    const h = handles.current;
    if (!h) return;
    for (const child of [...h.routeGroup.children]) {
      h.routeGroup.remove(child);
      (child as THREE.Mesh).geometry?.dispose();
      disposeTree(child);
    }
    if (!route) return;
    const pts = arcPoints(route.from, route.to);
    // Split where the aircraft is: flown part bright, remaining part faint.
    let split = pts.length - 1;
    if (route.via) {
      const v = latLonToVec3(route.via.lat, route.via.lon).normalize();
      let best = Infinity;
      pts.forEach((p, i) => {
        const d = p.clone().normalize().distanceToSquared(v);
        if (d < best) {
          best = d;
          split = i;
        }
      });
    }
    const color = new THREE.Color(route.color);
    const addTube = (part: THREE.Vector3[], opacity: number, radius: number) => {
      if (part.length < 2) return;
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(part), Math.max(8, part.length * 2), radius, 6, false);
      h.routeGroup.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })));
    };
    addTube(pts.slice(0, split + 1), 0.95, 0.0032);
    addTube(pts.slice(split), 0.35, 0.0022);
  }, [route?.from.lat, route?.from.lon, route?.to.lat, route?.to.lon, route?.via?.lat, route?.via?.lon, route?.color]);

  // ---- Coverage circles ----
  const coverageKey = coverage.map((c) => `${c.lat},${c.lon},${c.radiusKm}`).join('|');
  useEffect(() => {
    const h = handles.current;
    if (!h) return;
    for (const child of [...h.coverageGroup.children]) {
      h.coverageGroup.remove(child);
      (child as THREE.Line).geometry?.dispose();
      disposeTree(child);
    }
    const mat = new THREE.LineDashedMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35, dashSize: 0.012, gapSize: 0.01 });
    for (const c of coverage) {
      const center = latLonToVec3(c.lat, c.lon).normalize();
      // Any vector perpendicular to the centre gives the circle's starting point.
      const perp = new THREE.Vector3(0, 1, 0).cross(center).normalize();
      if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0);
      const ang = c.radiusKm / EARTH_KM;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 72; i++) {
        const p = center.clone().multiplyScalar(Math.cos(ang)).add(perp.clone().multiplyScalar(Math.sin(ang)));
        pts.push(p.applyAxisAngle(center, (i / 72) * Math.PI * 2).multiplyScalar(R * 1.003));
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
      line.computeLineDistances();
      h.coverageGroup.add(line);
    }
  }, [coverageKey]);

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

  // ---- Day / night earth ----
  useEffect(() => {
    handles.current?.applyStyle(earthStyle);
    try {
      localStorage.setItem(EARTH_STYLE_KEY, earthStyle);
    } catch {
      // Private mode: the choice lasts for this visit only.
    }
  }, [earthStyle]);

  const zoom = (dir: 1 | -1) => {
    const h = handles.current;
    if (!h) return;
    h.target.zoom = THREE.MathUtils.clamp(h.target.zoom * (dir > 0 ? 1.25 : 0.8), MIN_ZOOM, MAX_ZOOM);
    h.lastInteraction = performance.now();
  };

  const selectedMarker = markers.find((m) => m.id === selectedId);
  const selectedFlight = selectedMarker ? undefined : flights.find((f) => f.id === selectedId);
  const selected: PickInfo | null = selectedMarker ?? selectedFlight ?? null;

  return (
    <div className="hub-globe relative w-full h-full select-none">
      <div ref={containerRef} className="absolute inset-0" aria-hidden />

      {/* Projected overlays, positioned by the render loop */}
      <div ref={tooltipRef} className="hub-globe-tag pointer-events-none" style={{ opacity: 0 }}>
        {hovered && hovered.id !== selectedId && (
          <div className="hub-globe-tag__box" style={{ borderColor: hovered.color }}>
            <div className="font-display text-xs font-bold uppercase" style={{ color: hovered.color }}>{hovered.label}</div>
            {hovered.sublabel && <div className="font-hud text-xs text-[var(--hub-dim)]">{hovered.sublabel}</div>}
          </div>
        )}
      </div>
      <div ref={labelRef} className="hub-globe-tag hub-globe-tag--selected pointer-events-none" style={{ opacity: 0 }}>
        {selected && (
          <div className="hub-globe-tag__box" style={{ borderColor: selected.color, boxShadow: `0 0 22px -6px ${selected.color}` }}>
            <div className="font-display text-sm font-bold uppercase" style={{ color: selected.color }}>{selected.label}</div>
            {selected.sublabel && <div className="font-hud text-xs text-[var(--hub-text)] opacity-80">{selected.sublabel}</div>}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute right-3 bottom-3 flex flex-col gap-1.5 z-10">
        <button
          type="button"
          className="hub-icon-btn !h-8 !min-w-8 !p-0"
          onClick={() => setEarthStyle((s) => (s === 'day' ? 'night' : 'day'))}
          aria-label={earthStyle === 'day' ? 'Passa alla vista notturna' : 'Passa alla vista diurna'}
          title={earthStyle === 'day' ? 'Vista notturna (luci delle città)' : 'Vista diurna'}
        >
          {earthStyle === 'day' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
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
