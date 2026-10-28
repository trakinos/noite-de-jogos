import type { CSSProperties } from 'react';
import { useBairroText } from './useBairroText';
import { money } from './text';
import { useLang } from '../../../i18n/LangProvider';
import type { Facing } from './geometry';
import type { SquareInfo } from './squareInfo';

const ICONS: Record<string, string> = {
  start: '🧦', luck: '🐯', iptu: '🧾', jail: '🚓', pracinha: '🌳', 'go-to-jail': '👮', bolao: '🎟️',
  kombi: '🚐', mototaxi: '🛵', 'carro-do-ovo': '🥚', 'caminhao-do-gas': '🛢️', 'carro-da-pamonha': '🌽', 'van-escolar': '🚌',
};

interface Props {
  info: SquareInfo;
  size: 'ring' | 'strip';
  /** CSS color per seat. */
  colors: string[];
  /** Player names per seat. */
  names: string[];
  /** The seat whose turn it is; its token is drawn bigger. */
  current: number;
  /** On the map, the side that faces the Pracinha: the rua color goes there. The strip keeps it on top. */
  facing?: Facing | null;
  onOpen: (pos: number) => void;
}

export function Square({ info, size, colors, names, current, facing, onOpen }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  const name = text.square(info.pos);
  const icon = ICONS[info.name];
  const buyable = info.price !== null;
  const ownerName = info.owner === null ? null : (names[info.owner] || text.ui('ownerFallback'));
  // The rent on the tile is short; the label spells it out.
  const rent = info.rent === null ? null
    : 'amount' in info.rent ? { short: money(tr.lang, info.rent.amount), long: money(tr.lang, info.rent.amount) }
    : { short: `${info.rent.perDice}×🎲`, long: text.ui('rentDice', { n: info.rent.perDice }) };
  const housesLabel = info.houses === 0 ? null
    : info.houses === 5 ? text.ui('predio')
    : info.houses === 1 ? text.ui('houseOne') : text.ui('houses', { n: info.houses });
  const label = [
    name,
    buyable ? (ownerName ?? text.ui('forSale')) : null,
    housesLabel,
    info.mortgaged ? text.ui('mortgagedTag') : null,
    rent && text.ui('rentTag', { rent: rent.long }),
    info.jailed.length > 0 && text.ui('jailedTag', { names: info.jailed.map(i => names[i] || text.ui('ownerFallback')).join(', ') }),
  ].filter(Boolean).join(', ');

  const visitors = info.tokens.filter(i => !info.jailed.includes(i));
  const token = (i: number) => (
    <span key={i} className={`bsq__token${i === current ? ' bsq__token--current' : ''}`} style={{ backgroundColor: colors[i] }} />
  );
  const cls = [
    'bsq', `bsq--${size}`, `bsq--${info.kind}`,
    facing ? `bsq--face-${facing}` : '',
    info.owner !== null ? 'bsq--owned' : '',
    info.mortgaged ? 'bsq--mortgaged' : '',
  ].filter(Boolean).join(' ');
  const style = info.owner !== null ? ({ '--owner': colors[info.owner] } as CSSProperties) : undefined;
  return (
    <button type="button" className={cls} style={style} data-sq={info.pos} aria-label={label} onClick={() => onOpen(info.pos)}>
      {info.ruaColor && <span className="bsq__awning" style={{ backgroundColor: info.ruaColor }} aria-hidden="true" />}
      <span className="bsq__name">{name}</span>
      {icon && <span className="bsq__icon" aria-hidden="true">{icon}</span>}
      {buyable && info.owner === null && <span className="bsq__price">{money(tr.lang, info.price!)}</span>}
      {rent && <span className="bsq__rent" aria-hidden="true">{rent.short}</span>}
      {info.houses > 0 && (
        <span className="bsq__houses" aria-hidden="true">{info.houses === 5 ? '▮' : '⌂'.repeat(info.houses)}</span>
      )}
      {visitors.length > 0 && <span className="bsq__tokens" aria-hidden="true">{visitors.map(token)}</span>}
      {/* Serving time: behind bars in the corner of the Papuda, apart from anyone just visiting. */}
      {info.jailed.length > 0 && <span className="bsq__cell" aria-hidden="true">{info.jailed.map(token)}</span>}
    </button>
  );
}
