import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../../i18n/LangProvider';
import { MAX_TRADES_PER_TURN } from '../trades';
import type { BairroIntent, OfferSide } from '../types';
import type { BairroView } from '../view';
import { BairroDialog } from './BairroDialog';
import { money } from './text';
import { clampCount, emptySide, isEmptySide, sideLines, tradeOptions, tradePartners, tradesLeft } from './trade';
import type { TradeSideOptions } from './trade';
import { AssetPrice, SideTotal, TradeBalance } from './TradeValues';
import { useBairroText } from './useBairroText';

interface Props {
  view: BairroView;
  names: string[];
  awaiting: boolean;
  onIntent(intent: BairroIntent): void;
  onClose(): void;
}

interface ColumnProps {
  view: BairroView;
  title: string;
  options: TradeSideOptions;
  side: OfferSide;
  onChange(side: OfferSide): void;
}

/** One side of the offer: the escrituras that may go in, a cash amount and the lawyer cards. */
function Column({ view, title, options, side, onChange }: ColumnProps) {
  const { tr } = useLang();
  const text = useBairroText();
  const toggle = (pos: number) =>
    onChange({ ...side, assets: side.assets.includes(pos) ? side.assets.filter(p => p !== pos) : [...side.assets, pos] });

  return (
    <section className="btrade__col">
      <h3>{title}</h3>
      {options.assets.length === 0 ? (
        <p className="muted">{text.ui('tradeNoAssets')}</p>
      ) : (
        <ul className="btrade__assets">
          {options.assets.map(a => (
            <li key={a.pos}>
              <label className={a.enabled ? '' : 'is-off'}>
                <input type="checkbox" checked={side.assets.includes(a.pos)} disabled={!a.enabled} onChange={() => toggle(a.pos)} />
                <span>
                  {text.square(a.pos)}
                  <AssetPrice view={view} pos={a.pos} />
                  {a.reason && <small className="besc__reason">{text.reason(a.reason)}</small>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <label className="btrade__cash">
        <span>{text.ui('tradeCash', { max: money(tr.lang, options.cash) })}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={options.cash}
          step={10}
          value={side.cash}
          onChange={e => onChange({ ...side, cash: clampCount(e.target.valueAsNumber, options.cash) })}
        />
      </label>
      {options.lawyerCards > 0 && (
        <div className="btrade__cards" role="group" aria-label={text.ui('tradeCards')}>
          <span>{text.ui('tradeCards')}</span>
          <button type="button" aria-label={text.ui('tradeCardsMinus')} disabled={side.lawyerCards <= 0} onClick={() => onChange({ ...side, lawyerCards: side.lawyerCards - 1 })}>
            −
          </button>
          <b aria-live="polite">{side.lawyerCards}</b>
          <button type="button" aria-label={text.ui('tradeCardsPlus')} disabled={side.lawyerCards >= options.lawyerCards} onClick={() => onChange({ ...side, lawyerCards: side.lawyerCards + 1 })}>
            +
          </button>
        </div>
      )}
      <SideTotal view={view} side={side} />
    </section>
  );
}

/** Proposing a trade: pick a player and what each side puts up; then wait for the answer, with Cancel. */
export function TradeDialog({ view, names, awaiting, onIntent, onClose }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  const partners = tradePartners(view);
  const [to, setTo] = useState(partners[0] ?? 0);
  const [give, setGive] = useState<OfferSide>(emptySide);
  const [get, setGet] = useState<OfferSide>(emptySide);
  const name = (seat: number) => names[seat] || text.ui('ownerFallback');

  // The offer I sent is open: the dialog turns into the waiting state until it is answered or cancelled.
  const mine = view.offer?.from === view.you ? view.offer : null;
  const wasWaiting = useRef(false);
  useEffect(() => {
    if (mine) wasWaiting.current = true;
    else if (wasWaiting.current) onClose();
  }, [mine === null]);

  const shown = mine ?? { to, give, get };
  const opts = tradeOptions(view, shown.to);
  const lines = (side: OfferSide) => sideLines(side, text, tr.lang).join(', ') || text.ui('tradeNothing');
  const summary = text.ui('tradeSummary', { give: lines(shown.give), get: lines(shown.get) });

  if (mine) {
    return (
      <BairroDialog key="waiting" title={text.ui('tradeTitle')} onClose={() => undefined} dismissable={false} className="btrade">
        <p className="btrade__summary">{summary}</p>
        <TradeBalance view={view} give={mine.give} get={mine.get} />
        <p role="status" className="muted">{text.ui('tradeWaiting', { name: name(mine.to) })}</p>
        <div className="besc__actions">
          <button type="button" disabled={awaiting} onClick={() => onIntent({ type: 'cancelTrade' })}>
            {text.ui('tradeCancel')}
          </button>
        </div>
      </BairroDialog>
    );
  }

  const send = () => onIntent({ type: 'proposeTrade', offer: { to, give, get } });
  return (
    <BairroDialog key="compose" title={text.ui('tradeTitle')} onClose={onClose} className="btrade">
      {partners.length > 1 ? (
        <label className="btrade__who">
          <span>{text.ui('tradeWith')}</span>
          <select
            value={to}
            onChange={e => {
              setTo(Number(e.target.value));
              setGet(emptySide());
            }}
          >
            {partners.map(seat => (
              <option key={seat} value={seat}>
                {name(seat)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="btrade__who">
          {text.ui('tradeWith')} <b>{name(to)}</b>
        </p>
      )}
      <div className="btrade__cols">
        <Column view={view} title={text.ui('tradeIGive')} options={opts.give} side={give} onChange={setGive} />
        <Column view={view} title={text.ui('tradeIGet')} options={opts.get} side={get} onChange={setGet} />
      </div>
      <p className="btrade__summary" aria-live="polite">{summary}</p>
      <TradeBalance view={view} give={give} get={get} />
      <p className="muted btrade__used">{text.ui('tradeUsed', { n: view.tradesThisTurn, max: MAX_TRADES_PER_TURN })}</p>
      <div className="besc__actions">
        <button type="button" className="primary" disabled={awaiting || tradesLeft(view) === 0 || (isEmptySide(give) && isEmptySide(get))} onClick={send}>
          {text.ui('tradeSend')}
        </button>
      </div>
    </BairroDialog>
  );
}
