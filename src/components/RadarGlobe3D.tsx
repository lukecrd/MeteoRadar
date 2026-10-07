import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface RadarGlobe3DProps {
  isDark: boolean;
  /** 0-1, lets callers dial the ambient intensity down on busy tabs */
  intensity?: number;
  /**
   * Positioning of the canvas host. Defaults to a fixed full-viewport
   * backdrop.
   */
  className?: string;
}

// Deliberately low detail: a handful of meridians/parallels and a sparse
// point field read as a stylised globe at any size and cost almost nothing.
const MERIDIANS = 12;
const PARALLELS = [-60, -30, 0, 30, 60];
const LINE_SEGMENTS = 48;
const POINT_COUNT = 56;
const MAX_PIXEL_RATIO = 1.25;
const FRAME_INTERVAL_MS = 1000 / 30; // 30 fps is plenty for a slow spin

/** Graticule (lat/long grid) on the unit sphere as one LineSegments buffer. */
function buildGraticule(): THREE.BufferGeometry {
  const verts: number[] = [];
  const push = (lat: number, lon: number) => {
    const phi = (lat * Math.PI) / 180;
    const theta = (lon * Math.PI) / 180;
    verts.push(Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta));
  };
  const half = LINE_SEGMENTS / 2;
  for (let m = 0; m < MERIDIANS; m++) {
    const lon = (360 / MERIDIANS) * m;
    for (let i = 0; i < half; i++) {
      push(-90 + (180 / half) * i, lon);
      push(-90 + (180 / half) * (i + 1), lon);
    }
  }
  for (const lat of PARALLELS) {
    for (let i = 0; i < LINE_SEGMENTS; i++) {
      push(lat, (360 / LINE_SEGMENTS) * i);
      push(lat, (360 / LINE_SEGMENTS) * (i + 1));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return geo;
}

/**
 * Lightweight stylised 3D globe (ambient backdrop for the non-news tabs).
 * An orthographic camera keeps the whole sphere visible and centred in its
 * host and follows resizes. Purely decorative — no pointer
 * events, throttled to 30 fps, paused while the tab is hidden and static
 * for reduced-motion users.
 */
export const RadarGlobe3D: React.FC<RadarGlobe3DProps> = ({
  isDark,
  intensity = 1,
  className = 'fixed inset-0 z-0',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    // Unit-radius sphere; the frustum is fitted in fit().
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.set(0, 0, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const lineColor = isDark ? 0x7dd3fc : 0x0e7490;
    const fillColor = isDark ? 0x38bdf8 : 0x67e8f9;

    const group = new THREE.Group();
    group.rotation.x = 0.35; // slight axial tilt so parallels read as curves
    scene.add(group);

    // Soft body tint (very low-poly; the fill hides any faceting). It writes
    // depth and renders first so the far-side grid stays hidden.
    const bodyGeo = new THREE.SphereGeometry(0.99, 24, 16);
    const bodyMat = new THREE.MeshBasicMaterial({
      color: fillColor,
      transparent: true,
      opacity: (isDark ? 0.05 : 0.08) * intensity,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.renderOrder = -1;
    group.add(body);

    const gridGeo = buildGraticule();
    const gridMat = new THREE.LineBasicMaterial({
      color: lineColor,
      transparent: true,
      opacity: (isDark ? 0.22 : 0.18) * intensity,
      depthWrite: false,
    });
    group.add(new THREE.LineSegments(gridGeo, gridMat));

    // Sparse "station" points evenly spread on the surface (Fibonacci sphere).
    const positions = new Float32Array(POINT_COUNT * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < POINT_COUNT; i++) {
      const y = 1 - (2 * (i + 0.5)) / POINT_COUNT;
      const r = Math.sqrt(1 - y * y);
      positions[i * 3] = Math.cos(golden * i) * r * 1.002;
      positions[i * 3 + 1] = y * 1.002;
      positions[i * 3 + 2] = Math.sin(golden * i) * r * 1.002;
    }
    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pointsMat = new THREE.PointsMaterial({
      color: isDark ? 0xbae6fd : 0x0e7490,
      size: 3,
      sizeAttenuation: false,
      transparent: true,
      opacity: (isDark ? 0.5 : 0.4) * intensity,
      depthWrite: false,
    });
    group.add(new THREE.Points(pointsGeo, pointsMat));

    // Limb outline: a flat circle facing the camera marks the silhouette.
    const limbGeo = new THREE.RingGeometry(0.996, 1, 96);
    const limbMat = new THREE.MeshBasicMaterial({
      color: lineColor,
      transparent: true,
      opacity: (isDark ? 0.35 : 0.25) * intensity,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(limbGeo, limbMat));

    const fit = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      // "Contain" fit: the whole sphere is visible and centred.
      const margin = 1.1;
      const aspect = width / height;
      camera.top = aspect >= 1 ? margin : margin / aspect;
      camera.bottom = -camera.top;
      camera.right = aspect >= 1 ? margin * aspect : margin;
      camera.left = -camera.right;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.render(scene, camera);
    };
    fit();

    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(container);

    let frameId = 0;
    let last = 0;
    const clock = new THREE.Clock();
    const render = (now: number) => {
      frameId = requestAnimationFrame(render);
      if (document.visibilityState !== 'visible' || now - last < FRAME_INTERVAL_MS) return;
      last = now;
      group.rotation.y = clock.getElapsedTime() * 0.06;
      renderer.render(scene, camera);
    };
    if (!prefersReducedMotion) frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      bodyGeo.dispose();
      bodyMat.dispose();
      gridGeo.dispose();
      gridMat.dispose();
      pointsGeo.dispose();
      pointsMat.dispose();
      limbGeo.dispose();
      limbMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isDark, intensity]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none overflow-hidden ${className}`}
      style={{ mixBlendMode: isDark ? 'screen' : 'multiply' }}
    />
  );
};
