import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../../i18n/LangProvider';
import { MAX_TRADES_PER_TURN } from '../trades';
import { CORRETOR_TRADE, corretorOutside, feePayer } from '../skills';
import type { BairroIntent, Offer, OfferSide } from '../types';
import type { BairroView } from '../view';
import { BairroDialog } from './BairroDialog';
import { HideButton } from './TradePill';
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
  /** Tucks the dialog away to show the board (see TradePill). */
  hidden?: boolean;
  onHide?(): void;
}

export interface ColumnProps {
  view: BairroView;
  title: string;
  options: TradeSideOptions;
  side: OfferSide;
  onChange(side: OfferSide): void;
}

/** One side of the offer: the escrituras that may go in, a cash amount and the lawyer cards. */
export function Column({ view, title, options, side, onChange }: ColumnProps) {
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

type Fee = 'from' | 'to';

/** Who pays the Corretor's fee on the offer you're writing to `to`; nothing when no Corretor outside the trade gets one. */
export function FeePicker({ view, names, to, fee, onChange }: { view: BairroView; names: string[]; to: number; fee: Fee; onChange(fee: Fee): void }) {
  const { tr } = useLang();
  const text = useBairroText();
  const corretor = corretorOutside(view, view.you, to);
  if (corretor === null) return null;
  const label = text.ui('tradeFee', { amount: money(tr.lang, CORRETOR_TRADE), name: names[corretor] || text.ui('ownerFallback') });
  const choices: [Fee, string][] = [['from', text.ui('tradeFeeMine')], ['to', text.ui('tradeFeeTheirs', { name: names[to] || text.ui('ownerFallback') })]];
  return (
    <div className="btrade__fee" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      {choices.map(([value, name]) => (
        <button key={value} type="button" role="radio" aria-checked={fee === value} className={fee === value ? 'is-picked' : ''} onClick={() => onChange(value)}>
          {name}
        </button>
      ))}
    </div>
  );
}

/** Who pays the Corretor's fee on an open offer, in a line; nothing when there is no fee. */
export function FeeLine({ view, names, offer }: { view: BairroView; names: string[]; offer: Offer }) {
  const { tr } = useLang();
  const text = useBairroText();
  const corretor = corretorOutside(view, offer.from, offer.to);
  if (corretor === null) return null;
  const payer = feePayer(offer);
  const params = { amount: money(tr.lang, CORRETOR_TRADE), corretor: names[corretor] || text.ui('ownerFallback'), name: names[payer] || text.ui('ownerFallback') };
  return <p className="muted btrade__feeline">{text.ui(payer === view.you ? 'tradeFeeYou' : 'tradeFeeOther', params)}</p>;
}

/** Proposing a trade: pick a player and what each side puts up; then wait for the answer, with Cancel. */
export function TradeDialog({ view, names, awaiting, onIntent, onClose, hidden, onHide }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  const partners = tradePartners(view);
  const [to, setTo] = useState(partners[0] ?? 0);
  const [give, setGive] = useState<OfferSide>(emptySide);
  const [get, setGet] = useState<OfferSide>(emptySide);
  const [fee, setFee] = useState<Fee>('from');
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
      <BairroDialog key="waiting" title={text.ui('tradeTitle')} onClose={() => undefined} dismissable={false} className="btrade" hidden={hidden}>
        <p className="btrade__summary">{summary}</p>
        <TradeBalance view={view} give={mine.give} get={mine.get} />
        <FeeLine view={view} names={names} offer={mine} />
        <p role="status" className="muted">{text.ui('tradeWaiting', { name: name(mine.to) })}</p>
        <div className="besc__actions">
          <button type="button" disabled={awaiting} onClick={() => onIntent({ type: 'cancelTrade' })}>
            {text.ui('tradeCancel')}
          </button>
          {onHide && <HideButton onHide={onHide} />}
        </div>
      </BairroDialog>
    );
  }

  const send = () => onIntent({ type: 'proposeTrade', offer: { to, give, get, fee } });
  return (
    <BairroDialog key="compose" title={text.ui('tradeTitle')} onClose={onClose} className="btrade" hidden={hidden}>
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
      <FeePicker view={view} names={names} to={to} fee={fee} onChange={setFee} />
      <p className="muted btrade__used">{text.ui('tradeUsed', { n: view.tradesThisTurn, max: MAX_TRADES_PER_TURN })}</p>
      <div className="besc__actions">
        <button type="button" className="primary" disabled={awaiting || tradesLeft(view) === 0 || (isEmptySide(give) && isEmptySide(get))} onClick={send}>
          {text.ui('tradeSend')}
        </button>
        {onHide && <HideButton onHide={onHide} />}
      </div>
    </BairroDialog>
  );
}
