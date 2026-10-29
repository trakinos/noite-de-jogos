import { useEffect, useState } from 'react';
import { useLang } from '../../../i18n/LangProvider';
import type { LocalClock } from '../../../net/guest';
import { TimerBar } from '../../../ui/components/TimerBar';
import { HIDDEN_BID, bidders } from '../auction';
import { BOARD } from '../board';
import type { PontoSquare, ServicoSquare } from '../board';
import type { BairroIntent } from '../types';
import type { BairroView } from '../view';
import { BairroDialog } from './BairroDialog';
import { RUA_COLORS } from './geometry';
import { PieceDot } from './PlayersPanel';
import { money } from './text';
import { clampCount } from './trade';
import { useBairroText } from './useBairroText';

interface Props {
  view: BairroView;
  names: string[];
  colors: string[];
  pieces: (string | undefined)[];
  clock: LocalClock | null;
  awaiting: boolean;
  onIntent(intent: BairroIntent): void;
}

/**
 * The Prefeitura's auction, for everyone while it lasts: the escritura on the block, who has bid (never how much)
 * and how the last one went. Whoever still has to bid types an amount and bids, or passes. It can't be dismissed.
 */
export function AuctionDialog({ view, names, colors, pieces, clock, awaiting, onIntent }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  const a = view.auction!;
  const pos = a.lots[0]!;
  const sq = BOARD[pos] as PontoSquare | ServicoSquare;
  const cash = view.players[view.you]?.cash ?? 0;
  const mine = a.bids[view.you] ?? null;
  const [amount, setAmount] = useState(0);
  // A new escritura on the block starts from zero.
  useEffect(() => setAmount(0), [pos, a.lots.length]);
  const name = (seat: number) => names[seat] || text.ui('ownerFallback');
  const $ = (n: number) => money(tr.lang, n);
  const last = [...view.log].reverse().find(e => e.key === 'auctionWon' || e.key === 'auctionUnsold');
  const left = a.lots.length - 1;
  const rent = sq.kind === 'ponto' ? text.ui('auctionRent', { amount: $(sq.rent[0]) }) : text.ui('auctionRentDice', { n: sq.multiplier });

  return (
    <BairroDialog title={text.ui('auctionTitle')} onClose={() => undefined} dismissable={false} className="bauction">
      <p className="muted">{text.ui('auctionIntro', { name: name(a.from) })}</p>
      {clock && <TimerBar clock={clock} />}
      <div className="bauction__lot">
        {sq.kind === 'ponto' && <span className="bauction__swatch" style={{ backgroundColor: RUA_COLORS[sq.rua] }} aria-hidden="true" />}
        <div>
          <b className="bauction__name">{text.square(pos)}</b>
          <span className="muted">
            {text.ui('auctionPrice', { amount: $(sq.price) })} · {rent}
          </span>
        </div>
      </div>
      <ul className="bauction__bidders">
        {bidders(view).map(i => {
          const b = a.bids[i];
          return (
            <li key={i}>
              <PieceDot color={colors[i]} piece={pieces[i]} />
              <span className="bauction__who">{i === view.you ? text.ui('youName', { name: name(i) }) : name(i)}</span>
              <span className={`bauction__state${b === null ? ' is-thinking' : ''}`}>
                {b === null ? text.ui('auctionThinking') : b === HIDDEN_BID ? text.ui('auctionBidIn') : b === 0 ? text.ui('auctionPassed') : text.ui('auctionYourBid', { amount: $(b) })}
              </span>
            </li>
          );
        })}
      </ul>
      {last && <p className="bauction__last" role="status">{text.logLine(last, names)}</p>}
      {view.pending === 'bid' ? (
        <>
          <label className="btrade__cash">
            <span>{text.ui('auctionYourBidLabel', { max: $(cash) })}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={cash}
              step={10}
              value={amount}
              autoFocus
              onChange={e => setAmount(clampCount(e.target.valueAsNumber, cash))}
            />
          </label>
          <div className="besc__actions">
            <button type="button" className="primary" disabled={awaiting || amount <= 0} onClick={() => onIntent({ type: 'bid', amount })}>
              {text.ui('auctionSend', { amount: $(amount) })}
            </button>
            <button type="button" disabled={awaiting} onClick={() => onIntent({ type: 'bid', amount: 0 })}>
              {text.ui('auctionPass')}
            </button>
          </div>
        </>
      ) : (
        <p className="muted" role="status">
          {mine === null ? text.ui('auctionWatching') : text.ui('auctionWaiting')}
        </p>
      )}
      {left > 0 && <p className="muted bauction__left">{left === 1 ? text.ui('auctionLeftOne') : text.ui('auctionLeft', { n: left })}</p>}
    </BairroDialog>
  );
}
