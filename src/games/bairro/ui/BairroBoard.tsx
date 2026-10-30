import { useEffect, useRef, useState } from 'react';
import type { LocalClock } from '../../../net/guest';
import type { LobbyState } from '../../../net/protocol';
import { useLang } from '../../../i18n/LangProvider';
import { ConfirmDialog } from '../../../ui/components/ConfirmDialog';
import { Icon } from '../../../ui/components/Icon';
import { TimerBar } from '../../../ui/components/TimerBar';
import { playerColor } from '../../../ui/playerColor';
import { pieceEmoji } from '../../../theme/playerPieces';
import { JAIL_FINE, JAIL_POS } from '../board';
import { DECK } from '../deck';
import type { BairroIntent } from '../types';
import type { BairroView } from '../view';
import { AuctionDialog } from './AuctionDialog';
import { DebtDialog } from './DebtDialog';
import { EscrituraDialog } from './EscrituraDialog';
import { escrituraFor } from './escritura';
import { MapBoard } from './MapBoard';
import { StreetBoard } from './StreetBoard';
import { TradeAnswerDialog } from './TradeAnswerDialog';
import { TradeDialog } from './TradeDialog';
import { TradePill } from './TradePill';
import { TradeWatch } from './TradeWatch';
import { BARS_AT_MS, useBoardMotion, useMortgages, useReleases } from './useBairroMotion';
import { playArrest, playJailedScreen, playRelease } from './jailScenes';
import { playLuckCard } from './luckScene';
import { playBonus } from './bonusScene';
import { playMortgage } from './mortgageScene';
import { useMediaQuery } from './useMediaQuery';
import { useBairroText } from './useBairroText';
import { money } from './text';

/** Computers get the neighborhood map; narrower screens get the street in focus. */
const WIDE = '(min-width: 900px)';
/** Refused-move toasts dismiss themselves after this long, as in Dominion. */
const TOAST_MS = 5000;

export interface BairroBoardProps {
  view: BairroView;
  lobby: LobbyState;
  code: string;
  error: string | null;
  /** The running turn or response clock, if the room has a turn timer. */
  clock: LocalClock | null;
  /** True while an intent is on its way to the host. */
  awaiting: boolean;
  onIntent(intent: BairroIntent): void;
  onDismissError(): void;
  /** Only passed to the host: ends the game for everyone. */
  onEndGame?(): void;
  /** Shows the Rules button when given. */
  onRules?(): void;
}

export function BairroBoard({ view: live, lobby, code, error, clock, awaiting, onIntent, onDismissError, onEndGame, onRules }: BairroBoardProps) {
  const { tr, lang } = useLang();
  const text = useBairroText();
  const wide = useMediaQuery(WIDE);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const names = live.players.map(p => p.name);
  const colors = live.players.map(p => playerColor(lobby, p.id));
  const pieces = live.players.map(p => pieceEmoji(lobby.players.find(l => l.id === p.id)?.piece));
  const colorOf = (player: number) => colors[player] ?? 'currentColor';

  // The tokens and dice follow the live view; everything else shows `view`, which waits for them to finish.
  const { positions, settled: view } = useBoardMotion(live, {
    onArrest: m => {
      playArrest(m.arrestAt!, m.to, colorOf(m.player), pieces[m.player]);
      if (m.player === live.you) setTimeout(() => playJailedScreen(text.ui('jailedTitle'), text.ui('jailedSub')), BARS_AT_MS);
    },
    onCard: m => {
      const tone = DECK.find(c => c.id === m.card!.id)?.tone ?? 'bom';
      playLuckCard(m.card!.pos, tone, {
        title: text.ui(tone === 'bom' ? 'luckGood' : 'luckBad'),
        who: m.player === live.you ? text.ui('luckYouDrew') : text.ui('luckDrew', { name: names[m.player] ?? '' }),
        body: text.card(m.card!.id),
      });
    },
    onBonus: (_m, b) => playBonus(b.pos, b.kind, b.amount > 0, `${b.amount > 0 ? '+' : '-'}${money(lang, Math.abs(b.amount))}`),
  });
  const moving = view !== live;
  useReleases(live, r => {
    const label = r.kind === 'fine' ? `-${money(lang, JAIL_FINE)}` : '';
    playRelease(JAIL_POS, colorOf(r.player), r.kind, label, pieces[r.player]);
  });
  useMortgages(live, m => {
    const taken = m.kind === 'mortgaged';
    playMortgage(m.pos, taken, text.ui(taken ? 'stampMortgaged' : 'stampPaidOff'), `${taken ? '+' : '-'}${money(lang, m.amount)}`);
  });

  // Tapping a square or an escritura opens its escritura; squares that are not deeds do nothing.
  const [deedPos, setDeedPos] = useState<number | null>(null);
  // An escritura left open is closed by the next turn.
  useEffect(() => setDeedPos(null), [view.turnNumber]);
  const onOpenSquare = (pos: number) => {
    if (escrituraFor(view, pos)) setDeedPos(pos);
  };

  // The trade dialog follows the turn: it can't stay open once you can no longer propose, and it turns into a wait while your offer stands.
  const [tradeOpen, setTradeOpen] = useState(false);
  const proposing = view.pending === 'roll' || view.pending === 'manage';
  const myOffer = view.offer?.from === view.you;
  // The compose dialog closes when proposing stops being possible and as soon as the offer is sent, so it never flashes back after the answer.
  useEffect(() => {
    if (!proposing || myOffer) setTradeOpen(false);
  }, [proposing, myOffer]);
  // Any trade window can be tucked away to see the board; a new offer (or opening the compose dialog) brings it back.
  const [tradeHidden, setTradeHidden] = useState(false);
  const offerKey = view.offer ? JSON.stringify(view.offer) : '';
  useEffect(() => setTradeHidden(false), [offerKey, tradeOpen]);
  const composing = (tradeOpen && proposing) || myOffer;
  const answering = view.pending === 'tradeAnswer';
  const watching = !!view.offer && view.openTrades && view.offer.from !== view.you && view.offer.to !== view.you;
  const hideTrade = () => setTradeHidden(true);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(onDismissError, TOAST_MS);
    return () => clearTimeout(timer);
  }, [error]);

  const errorText = error && (text.hasReason(error) ? text.reason(error) : tr.reason(error));
  const layout = { view, live, moving, positions, names, colors, pieces, awaiting, onIntent, onOpenSquare, onTrade: () => setTradeOpen(true) };

  return (
    <main className={`bboard ${wide ? 'bboard--wide' : 'bboard--narrow'}`}>
      <header className="board__top bboard__top">
        <div className="brand">
          {tr.t('gameBairroName')}
          <span className="room">{code}</span>
        </div>
        {clock && <TimerBar clock={clock} />}
        {onRules && (
          <button type="button" className="rules-btn" onClick={onRules} title={tr.t('rules')}>
            <Icon name="book" />
            <span>{tr.t('rules')}</span>
          </button>
        )}
        {onEndGame && (
          <details className="menu" ref={menu}>
            <summary aria-label={tr.t('moreOptions')} title={tr.t('moreOptions')}>
              <Icon name="more" />
            </summary>
            <div className="menu__list">
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (menu.current) menu.current.open = false;
                  setConfirmEnd(true);
                }}
              >
                <Icon name="x" />
                {tr.t('endGame')}…
              </button>
            </div>
          </details>
        )}
      </header>

      {wide ? <MapBoard {...layout} /> : <StreetBoard {...layout} />}

      {deedPos !== null && (
        <EscrituraDialog view={view} pos={deedPos} names={names} awaiting={awaiting} onIntent={onIntent} onClose={() => setDeedPos(null)} />
      )}

      {view.auction && (
        <AuctionDialog view={view} names={names} colors={colors} pieces={pieces} clock={clock} awaiting={awaiting} onIntent={onIntent} />
      )}

      {!view.auction && view.pending === 'debt' && <DebtDialog view={view} names={names} awaiting={awaiting} onIntent={onIntent} />}

      {composing && (
        <TradeDialog view={view} names={names} awaiting={awaiting} onIntent={onIntent} onClose={() => setTradeOpen(false)} hidden={tradeHidden} onHide={hideTrade} />
      )}

      <TradeWatch view={view} names={names} hidden={tradeHidden} onHide={hideTrade} />

      {answering && (
        <TradeAnswerDialog view={view} names={names} clock={clock} awaiting={awaiting} onIntent={onIntent} hidden={tradeHidden} onHide={hideTrade} />
      )}
      {tradeHidden && (composing || answering || watching) && <TradePill onShow={() => setTradeHidden(false)} />}

      {errorText && (
        <div className="toast bboard__toast" role="alert">
          <span className="toast__ic">
            <Icon name="alert" />
          </span>
          <span>{errorText}</span>
          <button type="button" onClick={onDismissError} aria-label={tr.t('dismiss')}>
            <Icon name="x" />
          </button>
        </div>
      )}

      {confirmEnd && onEndGame && (
        <ConfirmDialog
          title={tr.t('endGameTitle')}
          body={tr.t('endGameConfirm')}
          cancel={tr.t('keepPlaying')}
          confirm={tr.t('endGame')}
          onCancel={() => setConfirmEnd(false)}
          onConfirm={() => {
            setConfirmEnd(false);
            onEndGame();
          }}
        />
      )}
    </main>
  );
}
