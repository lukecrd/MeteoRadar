import type { CSSProperties } from 'react';

// Recharts styling from one place: axes, grid, tooltip and semantic series
// colours, tuned per theme so series and labels stay legible (AA on text).

export interface ChartTheme {
  axis: string;
  grid: string;
  text: string;
  tooltip: CSSProperties;
  series: { temp: string; rain: string; humidity: string; cape: string };
  font: string;
}

export function chartTheme(isDark: boolean): ChartTheme {
  return isDark
    ? {
        axis: '#8fa3bc',
        grid: 'rgba(148, 197, 255, 0.12)',
        text: '#e6eef9',
        tooltip: { backgroundColor: '#111a2d', border: '1px solid rgba(148,197,255,0.22)', borderRadius: 10, fontSize: 12, color: '#e6eef9' },
        series: { temp: '#f59e0b', rain: '#38bdf8', humidity: '#22d3ee', cape: '#a78bfa' },
        font: 'JetBrains Mono, ui-monospace, monospace',
      }
    : {
        axis: '#5b6b80',
        grid: 'rgba(15, 23, 42, 0.10)',
        text: '#0b1220',
        tooltip: { backgroundColor: '#ffffff', border: '1px solid rgba(15,23,42,0.16)', borderRadius: 10, fontSize: 12, color: '#0b1220' },
        series: { temp: '#c2410c', rain: '#0369a1', humidity: '#0e7490', cape: '#6d28d9' },
        font: 'JetBrains Mono, ui-monospace, monospace',
      };
}

/** Weather-phenomenon colours for the 24 h strip (distinct hues for rain / snow / fog). */
export const PHENOMENON_COLORS = {
  clear: '#f5b301',
  cloudy: '#94a3b8',
  rain: '#2f80d6',
  storm: '#8b5cf6',
  fog: '#c8b99a',
  snow: '#bfdbfe',
} as const;
