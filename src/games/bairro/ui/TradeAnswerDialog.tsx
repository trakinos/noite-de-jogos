import { useLang } from '../../../i18n/LangProvider';
import type { LocalClock } from '../../../net/guest';
import { TimerBar } from '../../../ui/components/TimerBar';
import type { BairroIntent, OfferSide } from '../types';
import type { BairroView } from '../view';
import { BairroDialog } from './BairroDialog';
import { money } from './text';
import { AssetPrice, SideTotal, TradeBalance } from './TradeValues';
import { useBairroText } from './useBairroText';

interface Props {
  view: BairroView;
  names: string[];
  clock: LocalClock | null;
  awaiting: boolean;
  onIntent(intent: BairroIntent): void;
}

/** Opens by itself when someone offers you a trade: what you get, what you give, Accept or Decline. It can't be dismissed. */
export function TradeAnswerDialog({ view, names, clock, awaiting, onIntent }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  const offer = view.offer;
  if (!offer) return null;

  // Escrituras by name with their price, then cash and lawyer cards.
  const list = (side: OfferSide) => {
    const extras = [
      ...(side.cash > 0 ? [money(tr.lang, side.cash)] : []),
      ...(side.lawyerCards > 0 ? [side.lawyerCards === 1 ? text.ui('tradeCardsOne') : text.ui('tradeCardsMany', { n: side.lawyerCards })] : []),
    ];
    return side.assets.length + extras.length === 0 ? (
      <p className="muted">{text.ui('tradeNothing')}</p>
    ) : (
      <>
        <ul className="btrade__lines">
          {side.assets.map(pos => (
            <li key={pos}>
              {text.square(pos)}
              <AssetPrice view={view} pos={pos} />
            </li>
          ))}
          {extras.map((l, i) => (
            <li key={`x${i}`}>{l}</li>
          ))}
        </ul>
        <SideTotal view={view} side={side} />
      </>
    );
  };

  return (
    <BairroDialog title={text.ui('answerTitle')} onClose={() => undefined} dismissable={false} className="btrade">
      <p className="btrade__who">{text.ui('answerIntro', { name: names[offer.from] || text.ui('ownerFallback') })}</p>
      {clock && <TimerBar clock={clock} />}
      <div className="btrade__cols">
        <section className="btrade__col">
          <h3>{text.ui('answerYouGet')}</h3>
          {list(offer.give)}
        </section>
        <section className="btrade__col">
          <h3>{text.ui('answerYouGive')}</h3>
          {list(offer.get)}
        </section>
      </div>
      <TradeBalance view={view} give={offer.get} get={offer.give} />
      <div className="besc__actions">
        <button type="button" className="primary" disabled={awaiting} onClick={() => onIntent({ type: 'answerTrade', accept: true })}>
          {text.ui('answerAccept')}
        </button>
        <button type="button" disabled={awaiting} onClick={() => onIntent({ type: 'answerTrade', accept: false })}>
          {text.ui('answerDecline')}
        </button>
      </div>
    </BairroDialog>
  );
}
