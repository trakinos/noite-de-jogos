import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n/LangProvider';
import { Avatar } from '../../ui/components/Avatar';
import { playerColor } from '../../ui/playerColor';
import { EndActions, GameFrame, RulesSheet, useGameText, useReason, type GameScreenProps, type Texts } from '../shared/GameFrame';
import { playSound } from '../shared/sound';
import { asVelhaView, WINS_NEEDED } from './game';

export const VELHA_RULES = ['rules1', 'rules2'];

export const VELHA_TEXT: Texts = {
  pt: {
    rulesTitle: 'Regras do Jogo da Velha',
    rules1: 'Dois jogadores se revezam marcando X e O num tabuleiro 3×3. Quem fizer três em linha (na horizontal, vertical ou diagonal) vence a rodada; tabuleiro cheio sem linha é velha (empate).',
    rules2: `A partida vai até alguém vencer ${WINS_NEEDED} rodadas. Quem começa alterna a cada rodada e sempre joga com o X. Com o relógio ligado, quem deixa o tempo acabar marca uma casa sorteada.`,
    yourTurn: 'Sua vez',
    theirTurn: 'Vez de {name}',
    round: 'Rodada {n}',
    roundWin: '{name} venceu a rodada!',
    roundDraw: 'Deu velha!',
    next: 'Próxima rodada',
    draws: 'velhas: {n}',
    win: '{name} venceu a partida!',
    firstTo: 'Quem vencer {n} rodadas leva',
    playAgain: 'Jogar de novo',
    'reason:That square is taken': 'Essa casa já está marcada.',
    'reason:Not your turn': 'Não é a sua vez.',
    'reason:The round is over': 'A rodada acabou.',
  },
  en: {
    rulesTitle: 'Tic-tac-toe rules',
    rules1: 'Two players take turns marking X and O on a 3×3 grid. Three in a row (across, down or diagonal) wins the round; a full grid with no line is a draw.',
    rules2: `The match goes on until someone wins ${WINS_NEEDED} rounds. Whoever starts alternates each round and always plays X. With the timer on, running out of time marks a random square.`,
    yourTurn: 'Your turn',
    theirTurn: "{name}'s turn",
    round: 'Round {n}',
    roundWin: '{name} wins the round!',
    roundDraw: "It's a draw!",
    next: 'Next round',
    draws: 'draws: {n}',
    win: '{name} wins the match!',
    firstTo: 'First to {n} rounds wins',
    playAgain: 'Play again',
    'reason:That square is taken': 'That square is taken.',
    'reason:Not your turn': "It's not your turn.",
    'reason:The round is over': 'The round is over.',
  },
};

/** Where a winning line's ends sit, in the 0–300 board drawing. */
function lineEnds(line: number[]): [number, number, number, number] {
  const c = (i: number) => [50 + (i % 3) * 100, 50 + Math.floor(i / 3) * 100] as const;
  const [x1, y1] = c(line[0]!);
  const [x2, y2] = c(line[2]!);
  return [x1, y1, x2, y2];
}

export function VelhaScreen(props: GameScreenProps) {
  const view = asVelhaView(props.view);
  const t = useGameText(VELHA_TEXT);
  const reason = useReason(t);
  const [rules, setRules] = useState(false);
  const { lobby, awaiting, onIntent } = props;
  const over = view.winner !== null;
  const myTurn = !over && !view.roundEnd && view.current === view.me;
  const them = view.players[1 - view.me]!;
  const marks = view.cells.filter(c => c !== null).length;

  const heard = useRef({ marks, round: view.round });
  useEffect(() => {
    const before = heard.current;
    heard.current = { marks, round: view.round };
    if (view.round !== before.round || marks <= before.marks) return;
    playSound('pop');
    if (view.roundEnd) {
      const timer = setTimeout(() => playSound(view.roundEnd!.winner === null ? 'alert' : view.roundEnd!.winner === view.me ? 'win' : 'lose'), 450);
      return () => clearTimeout(timer);
    }
  }, [marks, view.round]);

  let status: string;
  if (over) status = t('win', { name: view.players[view.winner!]!.name });
  else if (view.roundEnd) status = view.roundEnd.winner === null ? t('roundDraw') : t('roundWin', { name: view.players[view.roundEnd.winner]!.name });
  else status = myTurn ? t('yourTurn') : t('theirTurn', { name: them.name });

  return (
    <GameFrame
      title={useLang().tr.t('gameVelhaName')}
      code={props.code}
      clock={over || view.roundEnd ? null : props.clock}
      error={props.error}
      reason={reason}
      onDismissError={props.onDismissError}
      onEndGame={over ? undefined : props.onEndGame}
      onRules={() => setRules(true)}
      className="velha"
    >
      <div className="velha__table">
        <div className="velha__score">
          {view.players.map((p, i) => (
            <div key={p.id} className={`velha__player${!view.roundEnd && !over && view.current === i ? ' is-turn' : ''}`}>
              <Avatar name={p.name} color={playerColor(lobby, p.id)} />
              <b>{p.name}</b>
              <span className={`velha__sym velha__sym--${view.symbols[i]}`}>{view.symbols[i]}</span>
              <span className="velha__pts">{view.score[i]}</span>
            </div>
          ))}
        </div>
        <p className="muted velha__meta">
          {t('round', { n: view.round })} · {t('firstTo', { n: WINS_NEEDED })} · {t('draws', { n: view.draws })}
        </p>
        <p className={`velha__status${myTurn ? ' is-mine' : ''}`}>{status}</p>
        <div className="velha__board">
          {view.cells.map((c, i) => (
            <button
              key={i}
              type="button"
              className="velha__cell"
              disabled={!myTurn || c !== null || awaiting}
              onClick={() => onIntent({ type: 'mark', cell: i })}
              aria-label={c === null ? `${i + 1}` : `${i + 1} ${view.symbols[c]}`}
            >
              {c !== null && <Mark symbol={view.symbols[c]} color={playerColor(lobby, view.players[c]!.id)} />}
            </button>
          ))}
          {view.roundEnd?.line && (
            <svg className="velha__line" viewBox="0 0 300 300" aria-hidden="true">
              {(() => {
                const [x1, y1, x2, y2] = lineEnds(view.roundEnd.line);
                return <line x1={x1} y1={y1} x2={x2} y2={y2} />;
              })()}
            </svg>
          )}
        </div>
        {view.roundEnd && !over && (
          <div className="actions actions--center">
            <button type="button" className="primary lg" disabled={awaiting} onClick={() => onIntent({ type: 'next' })}>
              {t('next')}
            </button>
          </div>
        )}
        {over && <EndActions isHost={props.isHost} onPlayAgain={props.onPlayAgain} onBackToLobby={props.onBackToLobby} onLeave={props.onLeave} playAgain={t('playAgain')} />}
      </div>
      {rules && <RulesSheet title={t('rulesTitle')} paragraphs={VELHA_RULES.map(k => t(k))} onClose={() => setRules(false)} />}
    </GameFrame>
  );
}

/** An X or O drawn as strokes that animate in. */
function Mark({ symbol, color }: { symbol: 'X' | 'O'; color: string }) {
  return (
    <svg className="velha__mark" viewBox="0 0 100 100" style={{ color }} aria-hidden="true">
      {symbol === 'X' ? (
        <>
          <path d="M22 22L78 78" pathLength={1} />
          <path d="M78 22L22 78" pathLength={1} className="is-second" />
        </>
      ) : (
        <circle cx="50" cy="50" r="29" pathLength={1} />
      )}
    </svg>
  );
}
