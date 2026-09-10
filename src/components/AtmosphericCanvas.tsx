import React, { useEffect, useRef } from 'react';

interface AtmosphericCanvasProps {
  weatherCode: number;
  isDay: boolean;
  windSpeed: number;
  windDirection: number;
  lightningTrigger: number; // incremented when strike occurs
  isDark: boolean;
}

export const AtmosphericCanvas: React.FC<AtmosphericCanvasProps> = ({
  weatherCode,
  isDay,
  windSpeed,
  windDirection,
  lightningTrigger,
  isDark
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const flashOpacityRef = useRef<number>(0);

  // Trigger flash on lightning event
  useEffect(() => {
    if (lightningTrigger > 0) {
      flashOpacityRef.current = 0.85;
    }
  }, [lightningTrigger]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    // Particle system
    const isRain = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode);
    const isSnow = [71, 73, 75].includes(weatherCode);
    const particleCount = isRain ? Math.min(120, Math.floor(windSpeed * 3 + 40)) : isSnow ? 60 : 30;

    interface Particle {
      x: number;
      y: number;
      length: number;
      speed: number;
      opacity: number;
      size: number;
      angle: number;
    }

    const particles: Particle[] = [];
    const rad = (windDirection * Math.PI) / 180;
    const windDx = Math.sin(rad) * (windSpeed / 15);

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        length: isRain ? 12 + Math.random() * 18 : 2 + Math.random() * 4,
        speed: isRain ? 15 + Math.random() * 15 : isSnow ? 1 + Math.random() * 2 : 0.8 + Math.random() * 1.5,
        opacity: 0.15 + Math.random() * 0.4,
        size: isSnow ? 2 + Math.random() * 2.5 : 1 + Math.random() * 1.5,
        angle: Math.PI / 2 + windDx * 0.15,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Flash layer
      if (flashOpacityRef.current > 0.01) {
        ctx.fillStyle = `rgba(230, 240, 255, ${flashOpacityRef.current})`;
        ctx.fillRect(0, 0, width, height);
        flashOpacityRef.current *= 0.88; // decay
      }

      // Draw particles
      if (isRain) {
        ctx.strokeStyle = isDark ? 'rgba(186, 230, 253, 0.45)' : 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const endX = p.x + Math.cos(p.angle) * p.length;
          const endY = p.y + Math.sin(p.angle) * p.length;

          ctx.moveTo(p.x, p.y);
          ctx.lineTo(endX, endY);

          p.y += p.speed;
          p.x += windDx * 1.5;

          if (p.y > height) {
            p.y = -p.length;
            p.x = Math.random() * width;
          }
          if (p.x > width) p.x = 0;
          if (p.x < 0) p.x = width;
        }
        ctx.stroke();
      } else if (isSnow) {
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(200, 225, 255, 0.8)';
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();

          p.y += p.speed;
          p.x += Math.sin(p.y * 0.02) * 1.2 + windDx * 0.5;

          if (p.y > height) {
            p.y = -5;
            p.x = Math.random() * width;
          }
          if (p.x > width) p.x = 0;
          if (p.x < 0) p.x = width;
        }
      } else {
        // Floating atmospheric dust / breeze motes
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(100, 116, 139, 0.15)';
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();

          p.y -= p.speed * 0.3;
          p.x += windDx * 0.8 + Math.sin(p.y * 0.01) * 0.5;

          if (p.y < 0) {
            p.y = height + 5;
            p.x = Math.random() * width;
          }
          if (p.x > width) p.x = 0;
          if (p.x < 0) p.x = width;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [weatherCode, windSpeed, windDirection, isDark]);

  return (
    <canvas
      ref={canvasRef}
      id="atmospheric-ambient-canvas"
      className="absolute inset-0 pointer-events-none z-0 opacity-80"
    />
  );
};
