import { useState } from 'react';
import { useLang } from '../../../i18n/LangProvider';
import type { LocalClock } from '../../../net/guest';
import { TimerBar } from '../../../ui/components/TimerBar';
import type { BairroIntent, OfferSide } from '../types';
import type { BairroView } from '../view';
import { MAX_COUNTERS } from '../trades';
import { BairroDialog } from './BairroDialog';
import { HideButton } from './TradePill';
import { money } from './text';
import { isEmptySide, tradeOptions } from './trade';
import { Column } from './TradeDialog';
import { AssetPrice, SideTotal, TradeBalance } from './TradeValues';
import { useBairroText } from './useBairroText';

interface Props {
  view: BairroView;
  names: string[];
  clock: LocalClock | null;
  awaiting: boolean;
  onIntent(intent: BairroIntent): void;
  /** Tucks the dialog away to show the board (see TradePill). */
  hidden?: boolean;
  onHide?(): void;
}

/**
 * Opens by itself when someone offers you a trade: what you get, what you give, Accept, Decline or a counter-offer.
 * It can't be dismissed. A new offer (a counter to your counter) starts it fresh, since it is keyed by the offer.
 */
export function TradeAnswerDialog(props: Props) {
  const offer = props.view.offer;
  return offer ? <Answer key={JSON.stringify(offer)} {...props} /> : null;
}

function Answer({ view, names, clock, awaiting, onIntent, hidden, onHide }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  const offer = view.offer!;
  const from = names[offer.from] || text.ui('ownerFallback');
  // A counter-offer starts from the terms on the table, seen from your side.
  const [countering, setCountering] = useState(false);
  const [give, setGive] = useState<OfferSide>(() => structuredClone(offer.get));
  const [get, setGet] = useState<OfferSide>(() => structuredClone(offer.give));

  if (countering) {
    const opts = tradeOptions(view, offer.from);
    return (
      <BairroDialog key="counter" title={text.ui('counterTitle')} onClose={() => undefined} dismissable={false} className="btrade" hidden={hidden}>
        <p className="btrade__who">{text.ui('counterIntro', { name: from })}</p>
        {clock && <TimerBar clock={clock} />}
        <div className="btrade__cols">
          <Column view={view} title={text.ui('tradeIGive')} options={opts.give} side={give} onChange={setGive} />
          <Column view={view} title={text.ui('tradeIGet')} options={opts.get} side={get} onChange={setGet} />
        </div>
        <TradeBalance view={view} give={give} get={get} />
        <div className="besc__actions">
          <button
            type="button"
            className="primary"
            disabled={awaiting || (isEmptySide(give) && isEmptySide(get))}
            onClick={() => onIntent({ type: 'counterTrade', offer: { give, get } })}
          >
            {text.ui('counterSend')}
          </button>
          <button type="button" disabled={awaiting} onClick={() => setCountering(false)}>
            {text.ui('counterBack')}
          </button>
          {onHide && <HideButton onHide={onHide} />}
        </div>
      </BairroDialog>
    );
  }

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
    <BairroDialog key="answer" title={text.ui(offer.counters > 0 ? 'answerCounterTitle' : 'answerTitle')} onClose={() => undefined} dismissable={false} className="btrade" hidden={hidden}>
      <p className="btrade__who">{text.ui(offer.counters > 0 ? 'answerCounterIntro' : 'answerIntro', { name: from })}</p>
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
        {offer.counters < MAX_COUNTERS && (
          <button type="button" disabled={awaiting} onClick={() => setCountering(true)}>
            {text.ui('answerCounter')}
          </button>
        )}
        {onHide && <HideButton onHide={onHide} />}
      </div>
    </BairroDialog>
  );
}
