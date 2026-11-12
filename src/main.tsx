import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for Android PWA / Offline support
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  // A new deploy ships a new worker; when it takes over a page that an older
  // one was serving, reload once so the page and its assets match the build.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('ServiceWorker registration skipped or error:', err);
    });
  });
}

// 3D tilt and glare on .hub-module cards: index.css reads --rx/--ry/--mx/--my.
// Mouse only: on touch there is no hover, and reduced motion keeps cards flat.
if (matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) {
  let last: HTMLElement | null = null;
  const flatten = () => {
    last?.style.removeProperty('--rx');
    last?.style.removeProperty('--ry');
    last = null;
  };
  document.addEventListener('pointermove', (e) => {
    const target = e.target as Element;
    const card = target.closest<HTMLElement>('.hub-module');
    if (card !== last) flatten();
    if (!card) return;
    last = card;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    card.style.setProperty('--mx', `${x * 100}%`);
    card.style.setProperty('--my', `${y * 100}%`);
    // Maps stay flat: dragging a tilted map throws the pointer off.
    const k = target.closest('.leaflet-container') ? 0 : 3;
    card.style.setProperty('--rx', `${(0.5 - y) * k}deg`);
    card.style.setProperty('--ry', `${(x - 0.5) * k}deg`);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', flatten);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

