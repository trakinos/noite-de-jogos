import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n/LangProvider';
import { Avatar } from '../../ui/components/Avatar';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { Icon } from '../../ui/components/Icon';
import { playerColor } from '../../ui/playerColor';
import { EndActions, GameFrame, RulesSheet, useGameText, useReason, type GameScreenProps } from '../shared/GameFrame';
import { playSound } from '../shared/sound';
import { asChessView, type ChessView } from './game';
import { PieceSvg } from './Pieces';
import type { Move, PieceType } from './rules';
import { CHESS_TEXT, RULE_KEYS } from './text';

const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
/** How long a piece takes to slide one square. */
export const SECONDS_PER_SQUARE = 0.6;
const FILES = 'abcdefgh';

export function ChessScreen(props: GameScreenProps) {
  const view = asChessView(props.view);
  const t = useGameText(CHESS_TEXT);
  const reason = useReason(t);
  const [rules, setRules] = useState(false);
  return (
    <GameFrame
      title={useLang().tr.t('gameChessName')}
      code={props.code}
      clock={view.result ? null : props.clock}
      error={props.error}
      reason={reason}
      onDismissError={props.onDismissError}
      onEndGame={view.result ? undefined : props.onEndGame}
      onRules={() => setRules(true)}
      className="chess"
    >
      <ChessTable {...props} view={view} />
      {rules && <RulesSheet game="chess" title={t('rulesTitle')} paragraphs={RULE_KEYS.map(k => t(k))} onClose={() => setRules(false)} />}
    </GameFrame>
  );
}

interface Slide {
  key: number;
  pieces: { piece: string; from: number; to: number }[];
  seconds: number;
}

function distance(a: number, b: number): number {
  return Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 3) - (b >> 3)));
}

/** The last move as pieces sliding (two for castling), timed at SECONDS_PER_SQUARE per square of the longest slide. */
function slideFor(view: ChessView): Slide | null {
  const last = view.history.at(-1);
  if (!last) return null;
  const piece = view.board[last.to]!;
  const pieces = [{ piece, from: last.from, to: last.to }];
  if (piece[1] === 'k' && Math.abs(last.to - last.from) === 2) {
    const kingside = last.to > last.from;
    const rookFrom = kingside ? last.from + 3 : last.from - 4;
    const rookTo = kingside ? last.from + 1 : last.from - 1;
    pieces.push({ piece: view.board[rookTo]!, from: rookFrom, to: rookTo });
  }
  return { key: view.history.length, pieces, seconds: Math.max(...pieces.map(p => distance(p.from, p.to))) * SECONDS_PER_SQUARE };
}

function ChessTable({ view, lobby, awaiting, onIntent, isHost, onPlayAgain, onBackToLobby, onLeave }: Omit<GameScreenProps, 'view'> & { view: ChessView }) {
  const t = useGameText(CHESS_TEXT);
  const [selected, setSelected] = useState<number | null>(null);
  const [promoting, setPromoting] = useState<Move | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [slide, setSlide] = useState<Slide | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const plies = view.history.length;
  const seen = useRef(plies);

  // A new position clears any half-made move and slides the piece that moved.
  useEffect(() => {
    setSelected(null);
    setPromoting(null);
    if (plies === seen.current) return;
    const grew = plies === seen.current + 1;
    seen.current = plies;
    const next = grew ? slideFor(view) : null;
    setSlide(next);
    if (!next) return;
    const last = view.history.at(-1)!;
    playSound(last.san.includes('#') ? 'win' : last.san.includes('+') ? 'alert' : last.san.includes('x') ? 'hit' : 'move');
    const timer = setTimeout(() => setSlide(null), next.seconds * 1000 + 60);
    return () => clearTimeout(timer);
  }, [plies]);

  // The result modal opens once the last slide has landed.
  const over = view.result !== null;
  useEffect(() => {
    if (!over) return setEndOpen(false);
    if (slide) return;
    const timer = setTimeout(() => {
      setEndOpen(true);
      const r = view.result!;
      playSound(r.winner === null ? 'alert' : r.winner === view.me ? 'win' : 'lose');
    }, 250);
    return () => clearTimeout(timer);
  }, [over, slide === null]);

  const flip = view.mySide === 'b';
  const myTurn = view.moves.length > 0 && !slide;
  const targets = selected === null ? [] : view.moves.filter(m => m.from === selected);
  const me = view.players[view.me]!;
  const them = view.players[1 - view.me]!;
  const side = (s: 'w' | 'b') => t(s === 'w' ? 'white' : 'black');

  function click(sq: number) {
    if (awaiting || !myTurn) return;
    const piece = view.board[sq];
    if (selected !== null) {
      const hits = targets.filter(m => m.to === sq);
      if (hits.length > 1) return setPromoting({ from: selected, to: sq });
      if (hits.length === 1) {
        onIntent({ type: 'move', from: selected, to: sq });
        return setSelected(null);
      }
    }
    setSelected(piece && piece[0] === view.mySide && view.moves.some(m => m.from === sq) ? (sq === selected ? null : sq) : null);
  }

  /** Where square `sq` sits on screen: column and row from the top-left, as this player sees the board. */
  const spot = (sq: number) => {
    const file = sq & 7;
    const rank = sq >> 3;
    return flip ? { col: 7 - file, row: rank } : { col: file, row: 7 - rank };
  };
  const squares = Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    return flip ? row * 8 + (7 - col) : (7 - row) * 8 + col;
  });
  const sliding = new Set(slide?.pieces.map(p => p.to) ?? []);

  const material = (who: 'w' | 'b') => view.captured[who].reduce((a, p) => a + VALUE[p], 0);
  const lead = (who: 'w' | 'b') => material(who) - material(who === 'w' ? 'b' : 'w');

  const playerRow = (p: ChessView['players'][number], bottom: boolean) => {
    const toMove = !view.result && view.turn === p.side;
    return (
      <div className={`chess__player${toMove ? ' is-turn' : ''}${bottom ? ' is-me' : ''}`}>
        <Avatar name={p.name} color={playerColor(lobby, p.id)} />
        <b>{p.name}</b>
        <span className="muted">{side(p.side)}</span>
        <span className="chess__taken" aria-hidden="true">
          {view.captured[p.side].map((pt, i) => (
            <PieceSvg key={i} type={pt} side={p.side === 'w' ? 'b' : 'w'} />
          ))}
          {lead(p.side) > 0 && <span className="muted"> +{lead(p.side)}</span>}
        </span>
      </div>
    );
  };

  const winner = view.result && view.result.winner !== null ? view.players[view.result.winner]! : null;
  const outcome = !view.result ? null : view.result.winner === null ? 'draw' : view.result.winner === view.me ? 'win' : 'lose';
  const pairs: string[][] = [];
  view.history.forEach((m, i) => {
    if (i % 2 === 0) pairs.push([m.san]);
    else pairs[pairs.length - 1]!.push(m.san);
  });
  const selectedName = selected === null ? null : `${FILES[selected & 7]!.toUpperCase()}${(selected >> 3) + 1}`;

  return (
    <div className="chess__table">
      <div className="chess__left">
        {playerRow(them, false)}
        <div className="chess__frame">
          <div className="chess__ranks" aria-hidden="true">
            {Array.from({ length: 8 }, (_, row) => (
              <span key={row}>{flip ? row + 1 : 8 - row}</span>
            ))}
          </div>
          <div className={`chess__board${flip ? ' is-flipped' : ''}`} role="grid">
            {squares.map(sq => {
              const piece = view.board[sq]!;
              const dark = ((sq >> 3) + (sq & 7)) % 2 === 0;
              const target = targets.some(m => m.to === sq);
              const last = view.lastMove && (view.lastMove.from === sq || view.lastMove.to === sq);
              const cls = [
                'chess__sq', dark ? 'is-dark' : 'is-light', sq === selected && 'is-selected', last && 'is-last', sq === view.check && 'is-check',
                target && (piece ? 'is-capture' : 'is-target'),
              ].filter(Boolean).join(' ');
              return (
                <button key={sq} type="button" className={cls} onClick={() => click(sq)} aria-label={squareLabel(sq, piece)}>
                  {piece && !sliding.has(sq) && <PieceSvg type={piece[1] as PieceType} side={piece[0] as 'w' | 'b'} />}
                </button>
              );
            })}
            {slide?.pieces.map(p => (
              <SlidingPiece key={`${slide.key}-${p.to}`} piece={p.piece} from={spot(p.from)} to={spot(p.to)} seconds={slide.seconds} />
            ))}
            {promoting && (
              <div className="chess__promo panel" role="dialog" aria-label={t('promoteTo')}>
                <b>{t('promoteTo')}</b>
                <div>
                  {(['q', 'r', 'b', 'n'] as PieceType[]).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        onIntent({ type: 'move', ...promoting, promo: p });
                        setPromoting(null);
                        setSelected(null);
                      }}
                    >
                      <PieceSvg type={p} side={view.mySide} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <span />
          <div className="chess__files" aria-hidden="true">
            {Array.from({ length: 8 }, (_, col) => (
              <span key={col}>{FILES[flip ? 7 - col : col]!.toUpperCase()}</span>
            ))}
          </div>
        </div>
        {playerRow(me, true)}
      </div>

      <aside className="chess__side panel">
        {view.result ? (
          <div className="chess__result">
            <h2>{winner ? t('win', { name: winner.name }) : t('draw')}</h2>
            <p>{t(`end_${view.result.reason}`)}</p>
            <EndActions isHost={isHost} onPlayAgain={onPlayAgain} onBackToLobby={onBackToLobby} onLeave={onLeave} playAgain={t('playAgain')} />
          </div>
        ) : (
          <>
            <p className={`chess__status${myTurn ? ' is-mine' : ''}`}>
              {myTurn ? t('yourTurn') : t('theirTurn', { name: them.name })}
              {view.check !== null && <b> {t('check')}</b>}
            </p>
            {selectedName && <p className="chess__picked">{t('selected', { square: selectedName })}</p>}
            {view.drawOffer !== null &&
              (view.drawOffer === view.me ? (
                <p className="banner">{t('drawPending')}</p>
              ) : (
                <div className="banner chess__offer">
                  <span>{t('drawOffered', { name: them.name })}</span>
                  <button type="button" className="primary" disabled={awaiting} onClick={() => onIntent({ type: 'answerDraw', accept: true })}>
                    {t('accept')}
                  </button>
                  <button type="button" disabled={awaiting} onClick={() => onIntent({ type: 'answerDraw', accept: false })}>
                    {t('decline')}
                  </button>
                </div>
              ))}
          </>
        )}
        <h3>{t('moves')}</h3>
        <ol className="chess__moves">
          {pairs.length === 0 && <li className="muted">{t('noMoves')}</li>}
          {pairs.map((pair, i) => (
            <li key={i}>
              <span className="muted">{i + 1}.</span> <span>{pair[0]}</span> <span>{pair[1] ?? ''}</span>
            </li>
          ))}
        </ol>
        {!view.result && (
          <div className="actions">
            <button type="button" disabled={awaiting || view.drawOffer !== null} onClick={() => onIntent({ type: 'offerDraw' })}>
              {t('offerDraw')}
            </button>
            <button type="button" className="danger" disabled={awaiting} onClick={() => setConfirmResign(true)}>
              {t('resign')}
            </button>
          </div>
        )}
      </aside>

      {endOpen && outcome && view.result && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t(`outcome_${outcome}`)} onClick={() => setEndOpen(false)}>
          <div className={`panel chess__endmodal is-${outcome}`} onClick={e => e.stopPropagation()}>
            <div className="chess__endicon" aria-hidden="true">
              {outcome === 'win' ? <Icon name="trophy" /> : <PieceSvg type="k" side={outcome === 'lose' ? view.mySide : 'w'} />}
            </div>
            <h2>{t(`outcome_${outcome}`)}</h2>
            <p>
              {winner ? t('win', { name: winner.name }) : t('draw')} · {t(`end_${view.result.reason}`)}
            </p>
            <EndActions isHost={isHost} onPlayAgain={onPlayAgain} onBackToLobby={onBackToLobby} onLeave={onLeave} playAgain={t('playAgain')} />
            <button type="button" className="ghost" onClick={() => setEndOpen(false)}>
              {t('seeBoard')}
            </button>
          </div>
        </div>
      )}

      {confirmResign && (
        <ConfirmDialog
          title={t('resignTitle')}
          body={t('resignBody')}
          cancel={t('keepPlaying')}
          confirm={t('resign')}
          onCancel={() => setConfirmResign(false)}
          onConfirm={() => {
            setConfirmResign(false);
            onIntent({ type: 'resign' });
          }}
        />
      )}
    </div>
  );
}

/** A piece drawn over the board that glides from one square to another. */
function SlidingPiece({ piece, from, to, seconds }: { piece: string; from: { col: number; row: number }; to: { col: number; row: number }; seconds: number }) {
  const [at, setAt] = useState(from);
  useLayoutEffect(() => {
    // Two frames: the browser must paint the start square before the move to the end square can transition.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setAt(to));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
  return (
    <span
      className="chess__slide"
      style={{ left: `${at.col * 12.5}%`, top: `${at.row * 12.5}%`, transitionDuration: `${seconds}s` }}
      aria-hidden="true"
    >
      <PieceSvg type={piece[1] as PieceType} side={piece[0] as 'w' | 'b'} />
    </span>
  );
}

function squareLabel(sq: number, piece: string): string {
  const name = FILES[sq & 7]!.toUpperCase() + String((sq >> 3) + 1);
  return piece ? `${name} ${piece}` : name;
}
