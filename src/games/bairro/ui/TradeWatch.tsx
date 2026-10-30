import { useLang } from '../../../i18n/LangProvider';
import type { OfferSide } from '../types';
import type { BairroView } from '../view';
import { money } from './text';
import { HideButton } from './TradePill';
import { AssetPrice, SideTotal } from './TradeValues';
import { useBairroText } from './useBairroText';

interface Props {
  view: BairroView;
  names: string[];
  /** Tucked away to show the board (see TradePill). */
  hidden?: boolean;
  onHide?(): void;
}

/** With open trades, everyone else sees the offer on the table, read-only, while the two players decide. */
export function TradeWatch({ view, names, hidden = false, onHide }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  const offer = view.offer;
  if (hidden || !offer || !view.openTrades || offer.from === view.you || offer.to === view.you) return null;
  const name = (seat: number) => names[seat] || text.ui('ownerFallback');

  const side = (who: number, s: OfferSide) => (
    <section className="btrade__col">
      <h3>{text.ui('watchGives', { name: name(who) })}</h3>
      <ul className="btrade__lines">
        {s.assets.map(pos => (
          <li key={pos}>
            {text.square(pos)}
            <AssetPrice view={view} pos={pos} />
          </li>
        ))}
        {s.cash > 0 && <li>{money(tr.lang, s.cash)}</li>}
        {s.lawyerCards > 0 && <li>{s.lawyerCards === 1 ? text.ui('tradeCardsOne') : text.ui('tradeCardsMany', { n: s.lawyerCards })}</li>}
        {s.assets.length === 0 && s.cash === 0 && s.lawyerCards === 0 && <li className="muted">{text.ui('tradeNothing')}</li>}
      </ul>
      <SideTotal view={view} side={s} />
    </section>
  );

  return (
    <aside className="panel btradewatch" role="status" aria-label={text.ui('watchTitle')}>
      <h2>{text.ui('watchTitle')}</h2>
      <p className="muted">{text.ui(offer.counters > 0 ? 'watchCounter' : 'watchIntro', { from: name(offer.from), to: name(offer.to) })}</p>
      <div className="btrade__cols">
        {side(offer.from, offer.give)}
        {side(offer.to, offer.get)}
      </div>
      {onHide && (
        <div className="besc__actions">
          <HideButton onHide={onHide} />
        </div>
      )}
    </aside>
  );
}
