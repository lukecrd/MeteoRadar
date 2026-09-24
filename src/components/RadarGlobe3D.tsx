import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface RadarGlobe3DProps {
  isDark: boolean;
  /** 0-1, lets callers dial the ambient intensity down on busy tabs */
  intensity?: number;
}

/**
 * Ambient full-viewport 3D backdrop: a slowly rotating wireframe tracking
 * globe with orbit rings and a sparse point field, evoking a satellite /
 * radar console. Purely decorative — fixed, non-interactive, and dialed
 * down (or paused) automatically for light theme / reduced-motion users.
 */
export const RadarGlobe3D: React.FC<RadarGlobe3DProps> = ({ isDark, intensity = 1 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = container.clientWidth;
    let height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.3, 7.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    // Positioned toward the upper-right so it reads as an ambient corner
    // instrument rather than competing with foreground content.
    group.position.set(2.1, 0.6, 0);
    scene.add(group);

    const cyan = isDark ? 0x22d3ee : 0x0891b2;
    const teal = isDark ? 0x2dd4bf : 0x0d9488;
    const baseOpacity = (isDark ? 0.34 : 0.16) * intensity;

    const wireGeo = new THREE.IcosahedronGeometry(1.7, 2);
    const wireMat = new THREE.MeshBasicMaterial({ color: cyan, wireframe: true, transparent: true, opacity: baseOpacity });
    const wireSphere = new THREE.Mesh(wireGeo, wireMat);
    group.add(wireSphere);

    function makeRing(radius: number, color: number, opacity: number, rx: number, rz: number) {
      const geo = new THREE.TorusGeometry(radius, 0.004, 8, 128);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity * intensity });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = rx;
      ring.rotation.z = rz;
      return ring;
    }
    const ringA = makeRing(2.25, teal, isDark ? 0.5 : 0.22, Math.PI / 2.3, 0.35);
    const ringB = makeRing(2.55, cyan, isDark ? 0.3 : 0.14, Math.PI / 2.7, -0.5);
    group.add(ringA, ringB);

    // Sparse tracking-point field on the sphere surface
    const count = 90;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const r = 1.72;
      positions[i * 3] = r * Math.cos(theta) * Math.sin(phi);
      positions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pointsMat = new THREE.PointsMaterial({ color: isDark ? 0xbaf3ff : 0x0e7490, size: 0.018, transparent: true, opacity: baseOpacity * 1.4 });
    group.add(new THREE.Points(pointsGeo, pointsMat));

    let frameId = 0;
    const clock = new THREE.Clock();

    const render = () => {
      const t = clock.getElapsedTime();
      if (!prefersReducedMotion) {
        group.rotation.y = t * 0.09;
        group.rotation.x = Math.sin(t * 0.12) * 0.08;
        ringA.rotation.z += 0.0009;
        ringB.rotation.z -= 0.0006;
      }
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };
    render();

    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      wireGeo.dispose();
      wireMat.dispose();
      pointsGeo.dispose();
      pointsMat.dispose();
      ringA.geometry.dispose();
      (ringA.material as THREE.Material).dispose();
      ringB.geometry.dispose();
      (ringB.material as THREE.Material).dispose();
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
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ mixBlendMode: isDark ? 'screen' : 'multiply' }}
    />
  );
};
