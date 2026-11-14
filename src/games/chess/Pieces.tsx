import type { PieceType } from './rules';

/** Drawn pieces (45×45), so every phone shows the same shapes and both colors; font glyphs vary by device. */
const BASE = <rect x="10.5" y="35" width="24" height="5.5" rx="2" />;

const SHAPES: Record<PieceType, React.ReactNode> = {
  p: (
    <>
      {BASE}
      <path d="M15.5 35.5c.8-5 2.6-9.2 4.6-12.2h4.8c2 3 3.8 7.2 4.6 12.2z" />
      <circle cx="22.5" cy="16.5" r="6" />
    </>
  ),
  r: (
    <>
      {BASE}
      <path d="M14.5 35.5l1.5-17h13l1.5 17z" />
      <path d="M12.5 18.5v-8h4.2v3.2h3.6v-3.2h4.4v3.2h3.6v-3.2h4.2v8z" />
    </>
  ),
  b: (
    <>
      {BASE}
      <path d="M15 35.5c1.4-5.2 2.2-8.6 2.2-12.6 0-5.4 3.2-9.4 5.3-11.4 2.1 2 5.3 6 5.3 11.4 0 4 .8 7.4 2.2 12.6z" />
      <circle cx="22.5" cy="8.5" r="2.6" />
      <path className="chessman__line" d="M25.8 15.5l-4.6 5.4M18.5 28.5h8" fill="none" />
    </>
  ),
  n: (
    <>
      {BASE}
      <path d="M14 35.5c-.2-5.6 2.4-9.4 6.8-12.6-2.6-.4-5.2.6-7.4 2.4-1.6-1.2-2-3.2-.8-5.4 2-3.6 5.4-7 9.2-8.6l.8-3.6 2.6 3.4c5.6 1.6 8.8 6.6 8.8 13.4 0 5.6-1 9-2.2 11z" />
      <circle className="chessman__eye" cx="20.5" cy="15.5" r="1.4" />
    </>
  ),
  q: (
    <>
      {BASE}
      <path d="M13.5 35.5L11 14.5l6.2 9.2.9-12.4 4.4 11.2 4.4-11.2.9 12.4 6.2-9.2-2.5 21z" />
      <circle cx="11" cy="13" r="2.4" />
      <circle cx="18" cy="10" r="2.4" />
      <circle cx="27" cy="10" r="2.4" />
      <circle cx="34" cy="13" r="2.4" />
      <path className="chessman__line" d="M15 30.5h15" fill="none" />
    </>
  ),
  k: (
    <>
      {BASE}
      <path d="M14.5 35.5c-1.4-5.4-4.6-8.6-4.6-12.8 0-4.4 4.4-6.6 8.4-5.4 2.2.6 3.6 2.4 4.2 4.4.6-2 2-3.8 4.2-4.4 4-1.2 8.4 1 8.4 5.4 0 4.2-3.2 7.4-4.6 12.8z" />
      <path d="M21.3 4h2.4v4h3.6v2.4h-3.6v6h-2.4v-6h-3.6V8h3.6z" />
      <path className="chessman__line" d="M15 30.5h15" fill="none" />
    </>
  ),
};

export function PieceSvg({ type, side }: { type: PieceType; side: 'w' | 'b' }) {
  return (
    <svg className={`chessman chessman--${side}`} viewBox="0 0 45 45" aria-hidden="true">
      {SHAPES[type]}
    </svg>
  );
}
