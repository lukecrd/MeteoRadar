import { useEffect, useRef, useState } from 'react';

export type CryptoId = 'BTCUSDT' | 'BTCEUR' | 'ETHUSDT';

export interface CryptoQuote {
  id: CryptoId;
  price: number;
  changePct: number; // 24h
  high: number | null;
  low: number | null;
  /** 24h quote-currency volume */
  volume: number | null;
  /** direction of the last tick, for the flash effect */
  tick: 'up' | 'down' | null;
  updatedAt: number;
}

export type CryptoSource = 'binance' | 'coingecko' | 'connecting' | 'offline';

export interface CryptoTickerState {
  quotes: Partial<Record<CryptoId, CryptoQuote>>;
  /** 24h price history (15 min candles) per pair */
  history: Partial<Record<CryptoId, number[]>>;
  source: CryptoSource;
}

const PAIRS: CryptoId[] = ['BTCUSDT', 'BTCEUR', 'ETHUSDT'];
const WS_URL = `wss://stream.binance.com:9443/stream?streams=${PAIRS.map((p) => `${p.toLowerCase()}@ticker`).join('/')}`;
const BINANCE_REST = 'https://api.binance.com/api/v3';
const COINGECKO = 'https://api.coingecko.com/api/v3';

/** No first message within this window → assume Binance is blocked here. */
const WS_FIRST_MESSAGE_MS = 8000;
const FLUSH_MS = 500;
const GECKO_POLL_MS = 30_000;
const HISTORY_REFRESH_MS = 5 * 60_000;

const GECKO_MAP: Record<CryptoId, { coin: 'bitcoin' | 'ethereum'; vs: 'usd' | 'eur' }> = {
  BTCUSDT: { coin: 'bitcoin', vs: 'usd' },
  BTCEUR: { coin: 'bitcoin', vs: 'eur' },
  ETHUSDT: { coin: 'ethereum', vs: 'usd' },
};

async function loadBinanceHistory(pair: CryptoId): Promise<number[]> {
  const res = await fetch(`${BINANCE_REST}/klines?symbol=${pair}&interval=15m&limit=96`);
  if (!res.ok) throw new Error(`klines HTTP ${res.status}`);
  const rows: unknown[][] = await res.json();
  return rows.map((r) => Number(r[4]));
}

async function loadGeckoHistory(pair: CryptoId): Promise<number[]> {
  const { coin, vs } = GECKO_MAP[pair];
  const res = await fetch(`${COINGECKO}/coins/${coin}/market_chart?vs_currency=${vs}&days=1`);
  if (!res.ok) throw new Error(`market_chart HTTP ${res.status}`);
  const json: { prices: [number, number][] } = await res.json();
  const prices = json.prices.map((p) => p[1]);
  // ~288 five-minute points → keep every third so both sources look alike.
  return prices.filter((_, i) => i % 3 === 0 || i === prices.length - 1);
}

/**
 * Live crypto prices straight from the browser: Binance's public WebSocket
 * when reachable (pushes every second), otherwise CoinGecko polling. Neither
 * needs an API key. Reconnects with backoff and switches back to Binance as
 * soon as it answers again.
 */
export function useCryptoTicker(): CryptoTickerState {
  const [state, setState] = useState<CryptoTickerState>({ quotes: {}, history: {}, source: 'connecting' });
  const pending = useRef<Partial<Record<CryptoId, Omit<CryptoQuote, 'tick'>>>>({});
  const sourceRef = useRef<CryptoSource>('connecting');

  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;
    let firstMsgTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let geckoTimer: ReturnType<typeof setInterval> | undefined;
    let attempts = 0;

    const setSource = (source: CryptoSource) => {
      if (sourceRef.current === source) return;
      sourceRef.current = source;
      setState((s) => ({ ...s, source }));
    };

    const loadHistory = async () => {
      const loader = sourceRef.current === 'coingecko' ? loadGeckoHistory : loadBinanceHistory;
      const results = await Promise.allSettled(PAIRS.map(loader));
      if (disposed) return;
      setState((s) => {
        const history = { ...s.history };
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value.length > 1) history[PAIRS[i]] = r.value;
        });
        return { ...s, history };
      });
    };

    // Batch socket ticks so three streams cause at most two renders a second.
    const flush = setInterval(() => {
      const batch = pending.current;
      if (Object.keys(batch).length === 0) return;
      pending.current = {};
      setState((s) => {
        const quotes = { ...s.quotes };
        const history = { ...s.history };
        for (const id of Object.keys(batch) as CryptoId[]) {
          const next = batch[id]!;
          const prev = quotes[id];
          const tick = prev && next.price !== prev.price ? (next.price > prev.price ? 'up' : 'down') : prev?.tick ?? null;
          quotes[id] = { ...next, tick };
          // Keep the sparkline's last point glued to the live price.
          const h = history[id];
          if (h && h.length) history[id] = [...h.slice(0, -1), next.price];
        }
        return { ...s, quotes, history };
      });
    }, FLUSH_MS);

    const pollGecko = async () => {
      try {
        const res = await fetch(`${COINGECKO}/simple/price?ids=bitcoin,ethereum&vs_currencies=usd,eur&include_24hr_change=true&include_24hr_vol=true`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: Record<string, Record<string, number>> = await res.json();
        const now = Date.now();
        for (const id of PAIRS) {
          const { coin, vs } = GECKO_MAP[id];
          const price = json[coin]?.[vs];
          if (typeof price !== 'number') continue;
          pending.current[id] = {
            id, price, changePct: json[coin][`${vs}_24h_change`] ?? 0,
            high: null, low: null, volume: json[coin][`${vs}_24h_vol`] ?? null, updatedAt: now,
          };
        }
        setSource('coingecko');
      } catch {
        if (sourceRef.current !== 'binance') setSource('offline');
      }
    };

    const startGecko = () => {
      if (geckoTimer || disposed) return;
      pollGecko().then(loadHistory);
      geckoTimer = setInterval(() => {
        if (document.visibilityState === 'visible') pollGecko();
      }, GECKO_POLL_MS);
    };

    const stopGecko = () => {
      clearInterval(geckoTimer);
      geckoTimer = undefined;
    };

    const connect = () => {
      if (disposed) return;
      try {
        ws = new WebSocket(WS_URL);
      } catch {
        startGecko();
        return;
      }
      let gotMessage = false;
      firstMsgTimer = setTimeout(() => {
        if (!gotMessage) startGecko();
      }, WS_FIRST_MESSAGE_MS);

      ws.onmessage = (ev) => {
        let msg: any;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        const d = msg?.data;
        if (!d?.s || !PAIRS.includes(d.s)) return;
        if (!gotMessage) {
          gotMessage = true;
          attempts = 0;
          clearTimeout(firstMsgTimer);
          stopGecko();
          setSource('binance');
          loadHistory();
        }
        pending.current[d.s as CryptoId] = {
          id: d.s,
          price: Number(d.c),
          changePct: Number(d.P),
          high: Number(d.h),
          low: Number(d.l),
          volume: Number(d.q),
          updatedAt: Number(d.E) || Date.now(),
        };
      };

      ws.onclose = () => {
        clearTimeout(firstMsgTimer);
        if (disposed) return;
        // Binance unreachable: keep prices flowing from CoinGecko meanwhile.
        startGecko();
        const delay = Math.min(60_000, 2000 * 2 ** attempts++);
        reconnectTimer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    const historyTimer = setInterval(() => {
      if (document.visibilityState === 'visible') loadHistory();
    }, HISTORY_REFRESH_MS);

    return () => {
      disposed = true;
      clearInterval(flush);
      clearInterval(historyTimer);
      clearTimeout(firstMsgTimer);
      clearTimeout(reconnectTimer);
      stopGecko();
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  return state;
}
