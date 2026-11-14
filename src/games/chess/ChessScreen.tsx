import { useEffect, useState } from 'react';
import { useLang } from '../../i18n/LangProvider';
import { Avatar } from '../../ui/components/Avatar';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { playerColor } from '../../ui/playerColor';
import { EndActions, GameFrame, RulesSheet, useGameText, useReason, type GameScreenProps } from '../shared/GameFrame';
import { asChessView, type ChessView } from './game';
import type { Move, PieceType } from './rules';
import { CHESS_TEXT, RULE_KEYS } from './text';

/** Solid glyphs for both sides (colored by CSS); the variation selector keeps phones from drawing emoji. */
const GLYPH: Record<PieceType, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const glyph = (t: PieceType) => `${GLYPH[t]}︎`;
const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

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
      {rules && <RulesSheet title={t('rulesTitle')} paragraphs={RULE_KEYS.map(k => t(k))} onClose={() => setRules(false)} />}
    </GameFrame>
  );
}

function ChessTable({ view, lobby, awaiting, onIntent, isHost, onPlayAgain, onBackToLobby, onLeave }: Omit<GameScreenProps, 'view'> & { view: ChessView }) {
  const t = useGameText(CHESS_TEXT);
  const [selected, setSelected] = useState<number | null>(null);
  const [promoting, setPromoting] = useState<Move | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const plies = view.history.length;
  // A new position clears any half-made move.
  useEffect(() => {
    setSelected(null);
    setPromoting(null);
  }, [plies]);

  const flip = view.mySide === 'b';
  const myTurn = view.moves.length > 0;
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

  const squares = Array.from({ length: 64 }, (_, i) => {
    // Rows top to bottom, files left to right, as the player sits.
    const row = Math.floor(i / 8);
    const col = i % 8;
    return flip ? row * 8 + (7 - col) : (7 - row) * 8 + col;
  });

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
            <span key={i} className={`chess__glyph chess__glyph--${p.side === 'w' ? 'b' : 'w'}`}>
              {glyph(pt)}
            </span>
          ))}
          {lead(p.side) > 0 && <span className="muted"> +{lead(p.side)}</span>}
        </span>
      </div>
    );
  };

  const winner = view.result && view.result.winner !== null ? view.players[view.result.winner]! : null;
  const pairs: string[][] = [];
  view.history.forEach((m, i) => {
    if (i % 2 === 0) pairs.push([m.san]);
    else pairs[pairs.length - 1]!.push(m.san);
  });

  return (
    <div className="chess__table">
      <div className="chess__left">
        {playerRow(them, false)}
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
                {piece && <span className={`chess__glyph chess__glyph--${piece[0]}`}>{glyph(piece[1] as PieceType)}</span>}
              </button>
            );
          })}
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
                    <span className={`chess__glyph chess__glyph--${view.mySide}`}>{glyph(p)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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

function squareLabel(sq: number, piece: string): string {
  const name = 'abcdefgh'[sq & 7]! + String((sq >> 3) + 1);
  return piece ? `${name} ${piece}` : name;
}
