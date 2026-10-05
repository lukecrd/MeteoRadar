import React from 'react';
import { Bitcoin } from 'lucide-react';
import { CryptoId, CryptoSource, useCryptoTicker } from '../../hooks/useCryptoTicker';
import { formatNumber, formatPct, trendColor } from '../../services/hubApi';
import { Sparkline } from './HubWidgets';

const PAIR_META: Record<CryptoId, { label: string; symbol: string; currency: string; digits: number }> = {
  BTCUSDT: { label: 'Bitcoin', symbol: 'BTC / USD', currency: '$', digits: 2 },
  BTCEUR: { label: 'Bitcoin', symbol: 'BTC / EUR', currency: '€', digits: 2 },
  ETHUSDT: { label: 'Ethereum', symbol: 'ETH / USD', currency: '$', digits: 2 },
};

const SOURCE_LABEL: Record<CryptoSource, string> = {
  binance: 'Binance · WebSocket live',
  coingecko: 'CoinGecko · ogni 30 s',
  connecting: 'Connessione…',
  offline: 'Feed non raggiungibile',
};

function compact(v: number): string {
  return new Intl.NumberFormat('it-IT', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

export const CryptoDeck: React.FC = () => {
  const { quotes, history, source } = useCryptoTicker();
  const btc = quotes.BTCUSDT;

  return (
    <section className="hub-panel hub-panel--glow p-4 sm:p-5" aria-labelledby="hub-crypto-title">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        {/* Headline BTC */}
        <div className="flex items-center gap-4 min-w-0 lg:w-[380px] shrink-0">
          <div className="w-12 h-12 rounded-2xl grid place-items-center shrink-0 bg-[#f7931a]/15 border border-[#f7931a]/40 shadow-[0_0_24px_-6px_#f7931a]">
            <Bitcoin className="w-7 h-7 text-[#f7931a]" />
          </div>
          <div className="min-w-0">
            <div className="hub-label flex items-center gap-2">
              <span className={source === 'binance' ? 'hub-live-dot' : 'w-[7px] h-[7px] rounded-full bg-[var(--hub-amber)]'} />
              <span id="hub-crypto-title">Bitcoin live</span> · {SOURCE_LABEL[source]}
            </div>
            {btc ? (
              <div className="flex items-baseline gap-3 flex-wrap">
                <span
                  key={btc.price}
                  className={`font-hud text-3xl sm:text-4xl font-bold tabular-nums ${btc.tick === 'up' ? 'hub-tick-up' : btc.tick === 'down' ? 'hub-tick-down' : ''}`}
                >
                  ${formatNumber(btc.price, 2)}
                </span>
                <span className="font-hud text-sm font-bold" style={{ color: trendColor(btc.changePct) }}>
                  {formatPct(btc.changePct)} <span className="opacity-60 font-normal">24h</span>
                </span>
              </div>
            ) : (
              <div className="hub-skeleton h-9 w-56 mt-1" />
            )}
            {btc?.high != null && btc.low != null && (
              <div className="font-hud text-[11px] text-[var(--hub-dim)] mt-0.5">
                Max {formatNumber(btc.high, 0)} · Min {formatNumber(btc.low, 0)}
                {btc.volume != null && ` · Vol ${compact(btc.volume)} $`}
              </div>
            )}
          </div>
        </div>

        <Sparkline values={history.BTCUSDT ?? []} width={260} height={56} className="hidden xl:block shrink-0" />

        {/* Secondary pairs */}
        <div className="grid grid-cols-2 gap-3 flex-1 min-w-0">
          {(['BTCEUR', 'ETHUSDT'] as CryptoId[]).map((id) => {
            const q = quotes[id];
            const meta = PAIR_META[id];
            return (
              <div key={id} className="rounded-xl border border-[var(--hub-line)] px-3 py-2.5 flex items-center justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <div className="hub-label">{meta.symbol}</div>
                  {q ? (
                    <>
                      <div
                        key={q.price}
                        className={`font-hud text-lg font-bold tabular-nums truncate ${q.tick === 'up' ? 'hub-tick-up' : q.tick === 'down' ? 'hub-tick-down' : ''}`}
                      >
                        {meta.currency}{formatNumber(q.price, meta.digits)}
                      </div>
                      <div className="font-hud text-[11px] font-bold" style={{ color: trendColor(q.changePct) }}>
                        {formatPct(q.changePct)}
                      </div>
                    </>
                  ) : (
                    <div className="hub-skeleton h-6 w-24 mt-1" />
                  )}
                </div>
                <Sparkline values={history[id] ?? []} width={72} height={30} className="shrink-0 hidden sm:block" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
