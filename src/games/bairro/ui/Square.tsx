import { useBairroText } from './useBairroText';
import { money } from './text';
import { useLang } from '../../../i18n/LangProvider';
import type { SquareInfo } from './squareInfo';

const ICONS: Record<string, string> = {
  start: '🚌', luck: '🎲', iptu: '🧾', jail: '🚓', pracinha: '🌳', 'go-to-jail': '👮', bolao: '🎟️',
  kombi: '🚐', mototaxi: '🛵', 'carro-do-ovo': '🥚', 'caminhao-do-gas': '🛢️', sorveteiro: '🍦', 'van-escolar': '🚌',
};

interface Props {
  info: SquareInfo;
  size: 'ring' | 'strip';
  /** CSS color per seat. */
  colors: string[];
  /** Player names per seat. */
  names: string[];
  onOpen: (pos: number) => void;
}

export function Square({ info, size, colors, names, onOpen }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  const name = text.square(info.pos);
  const icon = ICONS[info.name];
  const buyable = info.price !== null;
  const ownerName = info.owner === null ? null : (names[info.owner] || text.ui('ownerFallback'));
  const housesLabel = info.houses === 0 ? null
    : info.houses === 5 ? text.ui('predio')
    : info.houses === 1 ? text.ui('houseOne') : text.ui('houses', { n: info.houses });
  const label = [
    name,
    buyable ? (ownerName ?? text.ui('forSale')) : null,
    housesLabel,
    info.mortgaged ? text.ui('mortgagedTag') : null,
  ].filter(Boolean).join(', ');

  const cls = `bsq bsq--${size} bsq--${info.kind}${info.mortgaged ? ' bsq--mortgaged' : ''}`;
  return (
    <button type="button" className={cls} aria-label={label} onClick={() => onOpen(info.pos)}>
      {info.ruaColor && <span className="bsq__awning" style={{ backgroundColor: info.ruaColor }} aria-hidden="true" />}
      <span className="bsq__name">{name}</span>
      {icon && <span className="bsq__icon" aria-hidden="true">{icon}</span>}
      {buyable && info.owner === null && <span className="bsq__price">{money(tr.lang, info.price!)}</span>}
      {info.owner !== null && <span className="bsq__owner" style={{ backgroundColor: colors[info.owner] }} aria-hidden="true" />}
      {info.houses > 0 && (
        <span className="bsq__houses" aria-hidden="true">{info.houses === 5 ? '▮' : '⌂'.repeat(info.houses)}</span>
      )}
      {info.tokens.length > 0 && (
        <span className="bsq__tokens" aria-hidden="true">
          {info.tokens.map(i => <span key={i} className="bsq__token" style={{ backgroundColor: colors[i] }} />)}
        </span>
      )}
    </button>
  );
}
