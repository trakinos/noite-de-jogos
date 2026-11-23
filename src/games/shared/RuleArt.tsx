import type { ReactNode } from 'react';
import { PieceSvg } from '../chess/Pieces';
import type { PieceType } from '../chess/rules';
import { CardFace } from '../zerou/CardFace';
import type { Card } from '../zerou/game';

/** Small drawn pictures for the rulebooks. Wordless, so they work in both languages. */

const RED = '#c8372d';
const BLUE = '#2c4ba8';
const GREEN = '#2f8a4a';
const YELLOW = '#e0a526';
const INK = '#23201c';

function Figure({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <figure className="ruleart" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {children}
    </figure>
  );
}

const frame = { fill: 'var(--surface-2)', stroke: 'var(--border)', strokeWidth: 2 };

/** A playing card: color block with a symbol. */
function Card({ x, y, color, children, w = 44, h = 64 }: { x: number; y: number; color: string; children?: ReactNode; w?: number; h?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx="7" fill="#fff" stroke="var(--border)" strokeWidth="2" />
      <rect x="4" y="4" width={w - 8} height={h - 8} rx="5" fill={color} />
      <text x={w / 2} y={h / 2 + 8} textAnchor="middle" fontSize="22" fontWeight="800" fill="#fff" fontFamily="var(--font-display)">
        {children}
      </text>
    </g>
  );
}

function ChessArt() {
  const row: PieceType[] = ['k', 'q', 'r', 'b', 'n', 'p'];
  return (
    <Figure>
      <div className="ruleart__pieces">
        {(['w', 'b'] as const).map(side => (
          <div key={side} className="ruleart__prow">
            {row.map(t => (
              <span key={t} className={`ruleart__piece ruleart__piece--${side}`}>
                <PieceSvg type={t} side={side} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </Figure>
  );
}

function PistaArt() {
  // 25 words: 9 + 8 + 7 neutral + 1 bomb, laid out as the key card the chiefs see.
  const key = [
    'r', 'n', 'b', 'r', 'n', 'b', 'n', 'r', 'b', 'r', 'n', 'x', 'r', 'b', 'n', 'r', 'b', 'n', 'r', 'b', 'n', 'r', 'b', 'r', 'b',
  ];
  const fill = (k: string) => (k === 'r' ? RED : k === 'b' ? BLUE : k === 'x' ? INK : '#d8cdb4');
  return (
    <Figure>
      <svg viewBox="0 0 250 160" width="250">
        {key.map((k, i) => (
          <rect key={i} x={(i % 5) * 50 + 2} y={Math.floor(i / 5) * 32 + 2} width="46" height="28" rx="5" fill={fill(k)} />
        ))}
        <text x={1 * 50 + 25} y={2 * 32 + 22} textAnchor="middle" fontSize="18" fill="#fff">💣</text>
      </svg>
    </Figure>
  );
}

function NavalArt() {
  const N = 8;
  const cell = 26;
  const ships: [number, number, number, boolean][] = [[1, 1, 4, true], [3, 4, 3, false], [6, 2, 2, true]];
  const hits = new Set(['2,1', '3,1']);
  const misses = new Set(['5,6', '1,5', '6,0']);
  return (
    <Figure>
      <svg viewBox={`0 0 ${N * cell + 4} ${N * cell + 4}`} width="214">
        <rect x="2" y="2" width={N * cell} height={N * cell} rx="6" fill="#dfeaf5" stroke="var(--border)" strokeWidth="2" />
        {Array.from({ length: N + 1 }, (_, i) => (
          <g key={i} stroke="#a9c1d9" strokeWidth="1">
            <line x1={2 + i * cell} y1="2" x2={2 + i * cell} y2={2 + N * cell} />
            <line x1="2" y1={2 + i * cell} x2={2 + N * cell} y2={2 + i * cell} />
          </g>
        ))}
        {ships.map(([c, r, len, h], i) => (
          <rect
            key={i}
            x={2 + c * cell + 3}
            y={2 + r * cell + 3}
            width={(h ? len : 1) * cell - 6}
            height={(h ? 1 : len) * cell - 6}
            rx="9"
            fill="#5d6b7a"
          />
        ))}
        {[...hits].map(k => {
          const [c, r] = k.split(',').map(Number);
          return <circle key={k} cx={2 + c * cell + cell / 2} cy={2 + r * cell + cell / 2} r="8" fill={RED} />;
        })}
        {[...misses].map(k => {
          const [c, r] = k.split(',').map(Number);
          return <circle key={k} cx={2 + c * cell + cell / 2} cy={2 + r * cell + cell / 2} r="5" fill="#fff" stroke="#7a8fa6" strokeWidth="2" />;
        })}
      </svg>
    </Figure>
  );
}

let nextId = 0;
/** Real Zerou! cards, drawn by the game's own card component. */
function ZCards({ cards, plus }: { cards: [Card['color'], Card['value']][]; plus?: boolean }) {
  return (
    <Figure>
      <div className="ruleart__cards">
        {cards.map(([color, value], i) => (
          <span key={i} className="ruleart__zcard">
            {plus && i > 0 && <b className="ruleart__plus">+</b>}
            <CardFace card={{ id: nextId++, color, value }} />
          </span>
        ))}
      </div>
    </Figure>
  );
}

const zerou = (cards: [Card['color'], Card['value']][], plus?: boolean) => <ZCards cards={cards} plus={plus} />;

function VelhaArt() {
  return (
    <Figure>
      <svg viewBox="0 0 120 120" width="120">
        <g stroke="var(--border)" strokeWidth="4" strokeLinecap="round">
          <line x1="40" y1="8" x2="40" y2="112" />
          <line x1="80" y1="8" x2="80" y2="112" />
          <line x1="8" y1="40" x2="112" y2="40" />
          <line x1="8" y1="80" x2="112" y2="80" />
        </g>
        <g stroke={RED} strokeWidth="6" strokeLinecap="round">
          <path d="M14 14l20 20M34 14l-20 20" />
          <path d="M50 50l20 20M70 50l-20 20" />
          <path d="M90 90l20 20M110 90l-20 20" />
        </g>
        <circle cx="60" cy="20" r="11" fill="none" stroke={BLUE} strokeWidth="6" />
        <circle cx="20" cy="60" r="11" fill="none" stroke={BLUE} strokeWidth="6" />
        <line x1="14" y1="14" x2="106" y2="106" stroke={YELLOW} strokeWidth="4" strokeLinecap="round" opacity=".8" />
      </svg>
    </Figure>
  );
}

function ForcaArt() {
  return (
    <Figure>
      <svg viewBox="0 0 260 120" width="260">
        <g stroke="var(--text)" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M10 112h60M30 112V10h50v18" />
          <circle cx="80" cy="38" r="10" />
          <path d="M80 48v32M80 56l-14 14M80 56l14 14" />
        </g>
        {['A', '', 'R', '', 'A'].map((l, i) => (
          <g key={i}>
            <line x1={130 + i * 26} y1="100" x2={130 + i * 26 + 20} y2="100" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
            <text x={130 + i * 26 + 10} y="94" textAnchor="middle" fontSize="22" fontWeight="800" fill={BLUE} fontFamily="var(--font-display)">{l}</text>
          </g>
        ))}
      </svg>
    </Figure>
  );
}

function StopArt() {
  const rows = ['Nome', 'Cidade', 'Animal'];
  return (
    <Figure>
      <svg viewBox="0 0 260 130" width="260">
        <rect x="2" y="2" width="256" height="126" rx="8" {...frame} />
        <text x="22" y="40" fontSize="38" fontWeight="800" fill={RED} fontFamily="var(--font-display)">M</text>
        {rows.map((_, i) => (
          <g key={i}>
            <rect x="66" y={14 + i * 36} width="180" height="26" rx="5" fill="#fff" stroke="var(--border)" strokeWidth="2" />
            <text x="76" y={33 + i * 36} fontSize="16" fontWeight="700" fill={BLUE}>{['Maria', 'Manaus', 'Macaco'][i]}</text>
          </g>
        ))}
        <rect x="22" y="76" width="30" height="30" rx="15" fill={RED} />
        <text x="37" y="97" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">STOP</text>
      </svg>
    </Figure>
  );
}

function VidaArt() {
  const steps = [YELLOW, GREEN, BLUE, RED, GREEN, YELLOW];
  return (
    <Figure>
      <svg viewBox="0 0 300 70" width="300">
        <path d="M14 40H286" stroke="var(--border)" strokeWidth="6" strokeLinecap="round" />
        {steps.map((c, i) => (
          <circle key={i} cx={24 + i * 50} cy="40" r="14" fill={c} stroke="#fff" strokeWidth="3" />
        ))}
        <text x="24" y="46" textAnchor="middle" fontSize="16">🎓</text>
        <text x="124" y="46" textAnchor="middle" fontSize="16">💼</text>
        <text x="174" y="46" textAnchor="middle" fontSize="16">💍</text>
        <text x="274" y="46" textAnchor="middle" fontSize="16">🏖️</text>
        <text x="74" y="18" textAnchor="middle" fontSize="18">♟️</text>
      </svg>
    </Figure>
  );
}

function DominionArt() {
  const cards = [
    { c: '#b87333', t: '$1' },
    { c: '#9aa0a6', t: '$2' },
    { c: '#d4a62a', t: '$3' },
    { c: GREEN, t: '1★' },
    { c: '#7b8f3a', t: '3★' },
    { c: '#1f6b3a', t: '6★' },
  ];
  return (
    <Figure>
      <svg viewBox="0 0 330 80" width="330">
        {cards.map((k, i) => (
          <Card key={i} x={4 + i * 54} y={8} color={k.c}>{k.t}</Card>
        ))}
      </svg>
    </Figure>
  );
}

function DominionTurnArt() {
  const steps = [['A', BLUE], ['$', YELLOW], ['↻', GREEN]] as const;
  return (
    <Figure>
      <svg viewBox="0 0 300 60" width="300">
        {steps.map(([t, c], i) => (
          <g key={t} transform={`translate(${6 + i * 100} 6)`}>
            <rect width="88" height="48" rx="24" fill={c} />
            <text x="44" y="33" textAnchor="middle" fontSize="24" fontWeight="800" fill="#fff" fontFamily="var(--font-display)">{t}</text>
            {i < 2 && <text x="94" y="33" fontSize="20" fill="var(--muted)">›</text>}
          </g>
        ))}
      </svg>
    </Figure>
  );
}

function BairroArt() {
  // 12 squares around a 4×4 ring: corners and sides.
  const ring: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1]];
  const colors = [GREEN, RED, '#d8cdb4', RED, BLUE, '#d8cdb4', YELLOW, BLUE, '#d8cdb4', GREEN, RED, BLUE];
  return (
    <Figure>
      <svg viewBox="0 0 208 208" width="208">
        <rect x="2" y="2" width="204" height="204" rx="8" {...frame} />
        {ring.map(([c, r], i) => (
          <rect key={i} x={8 + c * 48} y={8 + r * 48} width="44" height="44" rx="5" fill={colors[i]} stroke="#fff" strokeWidth="2" />
        ))}
        <text x="104" y="118" textAnchor="middle" fontSize="44">🏠</text>
      </svg>
    </Figure>
  );
}

/** Pictures by game, each shown after the rule paragraph (or Dominion section) at `after`. */
export const RULE_ART: Record<string, { after: number; node: ReactNode }[]> = {
  chess: [{ after: 0, node: <ChessArt /> }],
  pista: [{ after: 0, node: <PistaArt /> }],
  naval: [{ after: 0, node: <NavalArt /> }],
  // after: rules1, rules2 (Pula, Inverte, +2, Coringa, +4), rulesSwap, rulesPairs, rulesCut, rulesNine
  zerou: [
    { after: 0, node: zerou([['r', '7'], ['r', '2'], ['b', '7']]) },
    { after: 1, node: zerou([['y', 'skip'], ['g', 'rev'], ['r', 'draw2'], [null, 'wild'], [null, 'wild4']]) },
    { after: 2, node: zerou([[null, 'swap']]) },
    { after: 3, node: zerou([['r', '7'], ['b', '7'], ['g', '7']], true) },
    { after: 4, node: zerou([['r', '5'], ['r', '5']]) },
    { after: 5, node: zerou([['y', '9']]) },
  ],
  velha: [{ after: 0, node: <VelhaArt /> }],
  forca: [{ after: 0, node: <ForcaArt /> }],
  stop: [{ after: 0, node: <StopArt /> }],
  vida: [{ after: 0, node: <VidaArt /> }],
  dominion: [{ after: 0, node: <DominionArt /> }, { after: 2, node: <DominionTurnArt /> }],
  bairro: [{ after: 0, node: <BairroArt /> }],
};

/** The pictures that go after item (or section) `index` of a game's rules. */
export function ruleArt(game: string | undefined, index: number): ReactNode[] {
  return (game ? RULE_ART[game] ?? [] : []).filter(a => a.after === index).map((a, i) => <span key={i}>{a.node}</span>);
}
