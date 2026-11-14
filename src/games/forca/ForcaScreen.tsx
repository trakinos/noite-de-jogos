import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n/LangProvider';
import { Avatar } from '../../ui/components/Avatar';
import { playerColor } from '../../ui/playerColor';
import { EndActions, GameFrame, RulesSheet, useGameText, useReason, type GameScreenProps, type Texts, type TextFn } from '../shared/GameFrame';
import { playSound } from '../shared/sound';
import { ALPHABET, asForcaView, LAST_LETTER_BONUS, MAX_MISSES, ROUNDS, SOLVE_BONUS, type ForcaLog, type ForcaView } from './game';

export const FORCA_RULES = ['rules1', 'rules2', 'rules3'];

export const FORCA_TEXT: Texts = {
  pt: {
    rulesTitle: 'Regras da Forca',
    rules1: `São ${ROUNDS} palavras, cada uma com sua categoria. Na sua vez, escolha uma letra: cada vez que ela aparece na palavra vale 1 ponto e você joga de novo. Letra errada desenha mais uma parte do boneco e a vez passa. Acentos não importam: A abre também Á, Ã e À.`,
    rules2: `Você pode chutar a palavra inteira na sua vez: acertou, ganha ${SOLVE_BONUS} pontos por letra que ainda faltava, mais ${LAST_LETTER_BONUS}; errou, conta como letra errada. Quem completa a palavra com a última letra também ganha +${LAST_LETTER_BONUS}.`,
    rules3: `Com ${MAX_MISSES} erros o boneco é enforcado e a rodada acaba sem bônus. No fim, vence quem tiver mais pontos. Com o relógio ligado, quem deixa o tempo acabar perde a vez.`,
    lobbyWords: 'Palavras',
    words_pt: 'Português',
    words_en: 'Inglês',
    category: 'Categoria: {c}',
    round: 'Palavra {n} de {total}',
    yourTurn: 'Sua vez: escolha uma letra',
    theirTurn: 'Vez de {name}',
    misses: 'Erros: {n} de {max}',
    solve: 'Chutar a palavra',
    solveGo: 'Chutar',
    solvedBy: '{name} acertou: {word}',
    hanged: 'Enforcado! Era {word}',
    next: 'Próxima palavra',
    win: '{name} venceu!',
    points: '{n} pts',
    log_letter: '{name} tentou {letter}: {hits}',
    log_hits: '{n} acerto(s)',
    log_miss: 'errou',
    log_solveRight: '{name} acertou a palavra (+{n})',
    log_solveWrong: '{name} chutou {word} e errou',
    log_timeout: 'O tempo de {name} acabou',
    playAgain: 'Jogar de novo',
    'reason:That letter was already tried': 'Essa letra já foi tentada.',
    'reason:Not your turn': 'Não é a sua vez.',
    'reason:The round is over': 'A rodada acabou.',
    'reason:Type the word': 'Digite a palavra.',
  },
  en: {
    rulesTitle: 'Hangman rules',
    rules1: `There are ${ROUNDS} words, each with its category. On your turn, pick a letter: each time it appears in the word scores 1 point and you go again. A wrong letter draws another part of the figure and the turn passes. Accents don't matter: A also opens Á, Ã and À.`,
    rules2: `You may guess the whole word on your turn: right scores ${SOLVE_BONUS} points per letter still missing, plus ${LAST_LETTER_BONUS}; wrong counts as a wrong letter. Whoever completes the word with the last letter also gets +${LAST_LETTER_BONUS}.`,
    rules3: `With ${MAX_MISSES} misses the figure is hanged and the round ends with no bonus. At the end, the most points wins. With the timer on, running out of time loses the turn.`,
    lobbyWords: 'Words',
    words_pt: 'Portuguese',
    words_en: 'English',
    category: 'Category: {c}',
    round: 'Word {n} of {total}',
    yourTurn: 'Your turn: pick a letter',
    theirTurn: "{name}'s turn",
    misses: 'Misses: {n} of {max}',
    solve: 'Guess the word',
    solveGo: 'Guess',
    solvedBy: '{name} got it: {word}',
    hanged: 'Hanged! It was {word}',
    next: 'Next word',
    win: '{name} wins!',
    points: '{n} pts',
    log_letter: '{name} tried {letter}: {hits}',
    log_hits: '{n} hit(s)',
    log_miss: 'miss',
    log_solveRight: '{name} guessed the word (+{n})',
    log_solveWrong: '{name} guessed {word}, wrong',
    log_timeout: "{name}'s time ran out",
    playAgain: 'Play again',
    'reason:That letter was already tried': 'That letter was already tried.',
    'reason:Not your turn': "It's not your turn.",
    'reason:The round is over': 'The round is over.',
    'reason:Type the word': 'Type the word.',
  },
};

export function ForcaScreen(props: GameScreenProps) {
  const view = asForcaView(props.view);
  const t = useGameText(FORCA_TEXT);
  const reason = useReason(t);
  const [rules, setRules] = useState(false);
  const [solving, setSolving] = useState('');
  const { lobby, awaiting, onIntent } = props;
  const over = view.winner !== null;
  const myTurn = !over && !view.roundOver && view.current === view.me;
  useForcaSounds(view);

  const ranking = view.players.map((p, i) => ({ p, i, score: view.scores[i]! })).sort((a, b) => b.score - a.score);

  return (
    <GameFrame
      title={useLang().tr.t('gameForcaName')}
      code={props.code}
      clock={over || view.roundOver ? null : props.clock}
      error={props.error}
      reason={reason}
      onDismissError={props.onDismissError}
      onEndGame={over ? undefined : props.onEndGame}
      onRules={() => setRules(true)}
      className="forca"
    >
      <div className="forca__table">
        <section className="panel forca__stage">
          <p className="muted forca__meta">
            {t('round', { n: view.round + 1, total: view.rounds })} · <b>{t('category', { c: view.category })}</b>
          </p>
          <Gallows misses={view.misses} />
          <p className="forca__misses">{t('misses', { n: view.misses, max: MAX_MISSES })}</p>
          <div className="forca__word" aria-label={view.pattern.map(c => c ?? '_').join('')}>
            {view.pattern.map((ch, i) =>
              ch === ' ' ? (
                <span key={i} className="forca__gap" />
              ) : ch === '-' ? (
                <span key={i} className="forca__dash">-</span>
              ) : (
                <span key={i} className={`forca__tile${ch ? ' is-open' : ''}`}>
                  {ch ?? ''}
                </span>
              ),
            )}
          </div>

          {view.roundOver ? (
            <div className="forca__roundover">
              <b>
                {view.roundOver.solvedBy === null
                  ? t('hanged', { word: view.roundOver.word })
                  : t('solvedBy', { name: view.players[view.roundOver.solvedBy]!.name, word: view.roundOver.word })}
              </b>
              {over ? (
                <>
                  <h2>{t('win', { name: view.players[view.winner!]!.name })}</h2>
                  <EndActions isHost={props.isHost} onPlayAgain={props.onPlayAgain} onBackToLobby={props.onBackToLobby} onLeave={props.onLeave} playAgain={t('playAgain')} />
                </>
              ) : (
                <button type="button" className="primary lg" disabled={awaiting} onClick={() => onIntent({ type: 'next' })}>
                  {t('next')}
                </button>
              )}
            </div>
          ) : (
            <>
              <p className={`forca__status${myTurn ? ' is-mine' : ''}`}>
                {myTurn ? t('yourTurn') : t('theirTurn', { name: view.players[view.current]!.name })}
              </p>
              <div className="forca__keys">
                {ALPHABET.map(l => {
                  const tried = view.guessed.includes(l);
                  const wrong = view.wrong.includes(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      className={`forca__key${tried ? (wrong ? ' is-wrong' : ' is-right') : ''}`}
                      disabled={!myTurn || tried || awaiting}
                      onClick={() => onIntent({ type: 'letter', letter: l })}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
              {myTurn && (
                <form
                  className="forca__solve"
                  onSubmit={e => {
                    e.preventDefault();
                    if (!solving.trim() || awaiting) return;
                    onIntent({ type: 'solve', word: solving });
                    setSolving('');
                  }}
                >
                  <input value={solving} onChange={e => setSolving(e.target.value)} placeholder={t('solve')} aria-label={t('solve')} autoCapitalize="characters" />
                  <button type="submit" disabled={!solving.trim() || awaiting}>
                    {t('solveGo')}
                  </button>
                </form>
              )}
            </>
          )}
        </section>

        <aside className="forca__side">
          <section className="panel forca__scores">
            {ranking.map(({ p, i, score }) => (
              <div key={p.id} className={`forca__player${!view.roundOver && view.current === i ? ' is-turn' : ''}`}>
                <Avatar name={p.name} color={playerColor(lobby, p.id)} />
                <b>{p.name}</b>
                <span className="forca__pts">{t('points', { n: score })}</span>
              </div>
            ))}
          </section>
          <section className="panel forca__log">
            <ol>
              {view.log.slice(-10).reverse().map((e, i) => (
                <li key={i}>{logLine(e, view, t)}</li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
      {rules && <RulesSheet title={t('rulesTitle')} paragraphs={FORCA_RULES.map(k => t(k))} onClose={() => setRules(false)} />}
    </GameFrame>
  );
}

function logLine(e: ForcaLog, view: ForcaView, t: TextFn): string {
  switch (e.k) {
    case 'letter':
      return t('log_letter', { name: view.players[e.seat]!.name, letter: e.letter, hits: e.hits > 0 ? t('log_hits', { n: e.hits }) : t('log_miss') });
    case 'solve':
      return e.right ? t('log_solveRight', { name: view.players[e.seat]!.name, n: e.points }) : t('log_solveWrong', { name: view.players[e.seat]!.name, word: e.word });
    case 'timeout':
      return t('log_timeout', { name: view.players[e.seat]!.name });
    case 'round':
      return e.winner === null ? t('hanged', { word: e.word }) : t('solvedBy', { name: view.players[e.winner]!.name, word: e.word });
  }
}

function useForcaSounds(view: ForcaView) {
  const seen = useRef(view.logTotal);
  useEffect(() => {
    const added = view.logTotal - seen.current;
    seen.current = view.logTotal;
    if (added <= 0) return;
    const last = view.log.at(-1);
    if (!last) return;
    if (view.winner !== null) playSound(view.winner === view.me ? 'win' : 'lose');
    else if (last.k === 'round') playSound(last.winner === null ? 'lose' : 'coin');
    else if (last.k === 'letter') playSound(last.hits > 0 ? 'pop' : 'wrong');
    else if (last.k === 'solve') playSound(last.right ? 'coin' : 'wrong');
  }, [view.logTotal]);
}

/** The gallows, with one more part of the figure for each miss. */
function Gallows({ misses }: { misses: number }) {
  const parts = [
    <circle key="head" cx="140" cy="62" r="16" />,
    <path key="body" d="M140 78v52" />,
    <path key="armL" d="M140 92l-22 20" />,
    <path key="armR" d="M140 92l22 20" />,
    <path key="legL" d="M140 130l-20 30" />,
    <path key="legR" d="M140 130l20 30" />,
  ];
  return (
    <svg className={`forca__gallows${misses >= MAX_MISSES ? ' is-hanged' : ''}`} viewBox="0 0 200 200" aria-hidden="true">
      <path className="forca__wood" d="M30 190h110M60 190V18h80v28M60 50l32-32" />
      <g className="forca__figure">{parts.slice(0, misses)}</g>
    </svg>
  );
}
