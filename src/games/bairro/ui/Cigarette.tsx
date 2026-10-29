import type { CSSProperties } from 'react';

const WISPS = 3;

/**
 * Pracinha scenery: a cigarette someone left burning on a park bench, the ember glowing and smoke curling up.
 * Pure decoration, hidden from screen readers. `small` drops the bench, for the phone's Pracinha corner.
 */
export function Cigarette({ small = false }: { small?: boolean }) {
  return (
    <div className={`bsmoke${small ? ' bsmoke--small' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 80 40" className="bsmoke__art">
        {!small && (
          <g className="bsmoke__bench">
            <rect x="4" y="16" width="72" height="5" rx="1.5" />
            <rect x="4" y="9" width="72" height="4" rx="1.5" />
            <rect x="10" y="21" width="4" height="15" />
            <rect x="66" y="21" width="4" height="15" />
          </g>
        )}
        <g transform={small ? 'translate(-14 3) scale(1.25)' : undefined}>
          <rect x="26" y="12" width="10" height="4" rx="0.8" fill="#d98a3a" />
          <rect x="36" y="12" width="26" height="4" fill="#f5f1e8" />
          <rect x="62" y="12" width="3" height="4" fill="#9a958c" />
          <circle className="bsmoke__ember" cx="65.6" cy="14" r="2.1" />
        </g>
      </svg>
      {Array.from({ length: WISPS }, (_, i) => (
        <span key={i} className="bsmoke__wisp" style={{ '--i': i } as CSSProperties} />
      ))}
    </div>
  );
}
