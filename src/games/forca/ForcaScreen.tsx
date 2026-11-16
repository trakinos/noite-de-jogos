import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n/LangProvider';
import { Avatar } from '../../ui/components/Avatar';
import { playerColor } from '../../ui/playerColor';
import { EndActions, GameFrame, RulesSheet, useGameText, useReason, type GameScreenProps, type Texts, type TextFn } from '../shared/GameFrame';
import { SimpleLobby, type LobbyProps } from '../shared/SimpleLobby';
import { playSound } from '../shared/sound';
import {
  asForcaView, forcaModule, KEY_ROWS, LAST_LETTER_BONUS, MAX_HINT_LEN, MAX_MISSES, MAX_SECRET_LEN, MAX_SECRET_PART, MIN_SECRET_LETTERS, ROUNDS,
  SOLVE_BONUS, WRITE_SKIP_MS, WRITER_HANG_BONUS, WRITER_MISS_POINTS, type ForcaLog, type ForcaView,
} from './game';

export const FORCA_RULES = ['rules1', 'rules2', 'rules3', 'rules4', 'rules5'];

const skipSecs = WRITE_SKIP_MS / 1000;

export const FORCA_TEXT: Texts = {
  pt: {
    rulesTitle: 'Regras da Forca',
    rules1: `São ${ROUNDS} palavras, cada uma com sua categoria. Na sua vez, escolha uma letra: cada vez que ela aparece na palavra vale 1 ponto e você joga de novo. Letra errada desenha mais uma parte do boneco e a vez passa. Acentos não importam: A abre também Á, Ã e À. Espaços e hífens já aparecem desde o começo.`,
    rules2: `Você pode chutar a palavra inteira na sua vez: acertou, ganha ${SOLVE_BONUS} pontos por letra que ainda faltava, mais ${LAST_LETTER_BONUS}; errou, conta como letra errada. Quem completa a palavra com a última letra também ganha +${LAST_LETTER_BONUS}.`,
    rules3: `Com ${MAX_MISSES} erros o boneco é enforcado e a rodada acaba sem bônus. No fim, vence quem tiver mais pontos. Com o relógio ligado, quem deixa o tempo acabar perde a vez.`,
    rules4: 'A categoria CEP traz países, os estados do Brasil (e o Distrito Federal) e as capitais, com nomes de várias palavras como Rio Grande do Sul.',
    rules5: `Modo "Um jogador escreve": a cada rodada um jogador, em rodízio, escreve a palavra secreta (${MIN_SECRET_LETTERS} a ${MAX_SECRET_LEN} caracteres, só letras, espaços e hífens) e, se quiser, uma dica. Ele não chuta: ganha ${WRITER_MISS_POINTS} ponto por erro dos outros e +${WRITER_HANG_BONUS} se o boneco for enforcado. Todos escrevem o mesmo número de vezes. Se quem escreve passar a vez, demorar demais (relógio ou ${skipSecs} s) ou não responder, a rodada usa uma palavra da lista e ele joga junto, sem pontos de quem escreve.`,
    lobbyWords: 'Palavras',
    words_pt: 'Português',
    words_en: 'Inglês',
    lobbyMode: 'Modo',
    mode_list: 'Palavras da lista',
    mode_written: 'Um jogador escreve',
    category: 'Categoria: {c}',
    hint: 'Dica: {c}',
    noHint: 'Sem dica',
    round: 'Palavra {n} de {total}',
    yourTurn: 'Sua vez: escolha uma letra',
    theirTurn: 'Vez de {name}',
    misses: 'Erros: {n} de {max}',
    left: 'Restam {n} erro(s)',
    wrongTitle: 'Letras erradas',
    wrongNone: 'Nenhuma ainda',
    wrongWords: 'Chutes errados: {w}',
    solve: 'Chutar a palavra',
    solveGo: 'Chutar',
    solvedBy: '{name} acertou: {word}',
    hanged: 'Enforcado! Era {word}',
    next: 'Próxima palavra',
    win: '{name} venceu!',
    points: '{n} pts',
    writer: 'escreve',
    writeTitle: 'Sua vez de escrever a palavra secreta',
    writeHelp: `${MIN_SECRET_LETTERS} a ${MAX_SECRET_LEN} caracteres: letras (acentos valem), espaços e hífens. Os outros vão adivinhar.`,
    writeWord: 'Palavra secreta',
    writeHint: 'Dica ou categoria (opcional)',
    writeGo: 'Enviar palavra',
    writePass: 'Usar uma palavra da lista',
    writing: '{name} está escrevendo a palavra…',
    skip: 'Usar uma palavra da lista',
    skipIn: 'Se demorar, em {n} s dá para usar uma palavra da lista.',
    yourSecret: 'Sua palavra: {w}',
    watching: 'Você escreveu esta palavra: só assista.',
    log_letter: '{name} tentou {letter}: {hits}',
    log_hits: '{n} acerto(s)',
    log_miss: 'errou',
    log_solveRight: '{name} acertou a palavra (+{n})',
    log_solveWrong: '{name} chutou {word} e errou',
    log_timeout: 'O tempo de {name} acabou',
    log_wrote: '{name} escreveu a palavra',
    log_fallback: '{name} não escreveu: palavra da lista',
    playAgain: 'Jogar de novo',
    'reason:That letter was already tried': 'Essa letra já foi tentada.',
    'reason:Not your turn': 'Não é a sua vez.',
    'reason:The round is over': 'A rodada acabou.',
    'reason:Type the word': 'Digite a palavra.',
    'reason:The word is too long': `Palavra longa demais (máximo ${MAX_SECRET_LEN} caracteres, ${MAX_SECRET_PART} por palavra).`,
    'reason:The word is too short': `Palavra curta demais (mínimo ${MIN_SECRET_LETTERS} letras).`,
    'reason:Use only letters, spaces and hyphens': 'Use só letras, espaços e hífens (um de cada vez, entre letras).',
    'reason:The hint is too long': `Dica longa demais (máximo ${MAX_HINT_LEN} caracteres).`,
    'reason:The writer still has time': 'Quem escreve ainda tem tempo.',
    'reason:Wait for the word': 'Espere a palavra ser escrita.',
    'reason:You wrote this word': 'Você escreveu esta palavra.',
  },
  en: {
    rulesTitle: 'Hangman rules',
    rules1: `There are ${ROUNDS} words, each with its category. On your turn, pick a letter: each time it appears in the word scores 1 point and you go again. A wrong letter draws another part of the figure and the turn passes. Accents don't matter: A also opens Á, Ã and À. Spaces and hyphens are shown from the start.`,
    rules2: `You may guess the whole word on your turn: right scores ${SOLVE_BONUS} points per letter still missing, plus ${LAST_LETTER_BONUS}; wrong counts as a wrong letter. Whoever completes the word with the last letter also gets +${LAST_LETTER_BONUS}.`,
    rules3: `With ${MAX_MISSES} misses the figure is hanged and the round ends with no bonus. At the end, the most points wins. With the timer on, running out of time loses the turn.`,
    rules4: 'The Geography category has countries, the Brazilian states (and the Federal District) and their capitals, with multi-word names such as Rio Grande do Sul.',
    rules5: `"A player writes" mode: each round one player, in turn, writes the secret word (${MIN_SECRET_LETTERS} to ${MAX_SECRET_LEN} characters: letters, spaces and hyphens) and, optionally, a hint. They don't guess: they score ${WRITER_MISS_POINTS} point for every miss by the others and +${WRITER_HANG_BONUS} if the figure is hanged. Everyone writes the same number of times. If the writer passes, takes too long (the timer, or ${skipSecs} s) or doesn't answer, the round uses a list word and they guess along, with no writer points.`,
    lobbyWords: 'Words',
    words_pt: 'Portuguese',
    words_en: 'English',
    lobbyMode: 'Mode',
    mode_list: 'List words',
    mode_written: 'A player writes',
    category: 'Category: {c}',
    hint: 'Hint: {c}',
    noHint: 'No hint',
    round: 'Word {n} of {total}',
    yourTurn: 'Your turn: pick a letter',
    theirTurn: "{name}'s turn",
    misses: 'Misses: {n} of {max}',
    left: '{n} miss(es) left',
    wrongTitle: 'Wrong letters',
    wrongNone: 'None yet',
    wrongWords: 'Wrong guesses: {w}',
    solve: 'Guess the word',
    solveGo: 'Guess',
    solvedBy: '{name} got it: {word}',
    hanged: 'Hanged! It was {word}',
    next: 'Next word',
    win: '{name} wins!',
    points: '{n} pts',
    writer: 'writes',
    writeTitle: 'Your turn to write the secret word',
    writeHelp: `${MIN_SECRET_LETTERS} to ${MAX_SECRET_LEN} characters: letters (accents are fine), spaces and hyphens. The others will guess it.`,
    writeWord: 'Secret word',
    writeHint: 'Hint or category (optional)',
    writeGo: 'Send word',
    writePass: 'Use a list word',
    writing: '{name} is writing the word…',
    skip: 'Use a list word',
    skipIn: 'If it takes too long, in {n} s you can use a list word.',
    yourSecret: 'Your word: {w}',
    watching: 'You wrote this word: just watch.',
    log_letter: '{name} tried {letter}: {hits}',
    log_hits: '{n} hit(s)',
    log_miss: 'miss',
    log_solveRight: '{name} guessed the word (+{n})',
    log_solveWrong: '{name} guessed {word}, wrong',
    log_timeout: "{name}'s time ran out",
    log_wrote: '{name} wrote the word',
    log_fallback: "{name} didn't write: list word",
    playAgain: 'Play again',
    'reason:That letter was already tried': 'That letter was already tried.',
    'reason:Not your turn': "It's not your turn.",
    'reason:The round is over': 'The round is over.',
    'reason:Type the word': 'Type the word.',
    'reason:The word is too long': `Too long (at most ${MAX_SECRET_LEN} characters, ${MAX_SECRET_PART} per word).`,
    'reason:The word is too short': `Too short (at least ${MIN_SECRET_LETTERS} letters).`,
    'reason:Use only letters, spaces and hyphens': 'Use only letters, spaces and hyphens (one at a time, between letters).',
    'reason:The hint is too long': `The hint is too long (at most ${MAX_HINT_LEN} characters).`,
    'reason:The writer still has time': 'The writer still has time.',
    'reason:Wait for the word': 'Wait for the word to be written.',
    'reason:You wrote this word': 'You wrote this word.',
  },
};

/** Forca's lobby: the language of the words and where they come from (the lists, or a player each round). */
export function ForcaLobby(props: LobbyProps) {
  const t = useGameText(FORCA_TEXT);
  const parsed = forcaModule.parseOptions(props.lobby.options);
  const { words, mode } = 'error' in parsed ? forcaModule.defaultOptions() : parsed;
  const set = (patch: Record<string, string>) => props.host!.setOptions({ words, mode, ...patch });
  const options = (
    <>
      <div className="bsetting">
        {props.host ? (
          <label className="bsetting__select">
            <span>{t('lobbyMode')}</span>
            <select value={mode} onChange={e => set({ mode: e.target.value })}>
              <option value="list">{t('mode_list')}</option>
              <option value="written">{t('mode_written')}</option>
            </select>
          </label>
        ) : (
          <b>
            {t('lobbyMode')}: {t(`mode_${mode}`)}
          </b>
        )}
      </div>
      <div className="bsetting">
        {props.host ? (
          <label className="bsetting__select">
            <span>{t('lobbyWords')}</span>
            <select value={words} onChange={e => set({ words: e.target.value })}>
              <option value="pt">{t('words_pt')}</option>
              <option value="en">{t('words_en')}</option>
            </select>
          </label>
        ) : (
          <b>
            {t('lobbyWords')}: {t(`words_${words}`)}
          </b>
        )}
      </div>
    </>
  );
  return <SimpleLobby {...props} options={options} rules={{ title: t('rulesTitle'), paragraphs: FORCA_RULES.map(k => t(k)) }} />;
}

export function ForcaScreen(props: GameScreenProps) {
  const view = asForcaView(props.view);
  const t = useGameText(FORCA_TEXT);
  const reason = useReason(t);
  const [rules, setRules] = useState(false);
  const [solving, setSolving] = useState('');
  const [solveOpen, setSolveOpen] = useState(false);
  const { lobby, awaiting, onIntent } = props;
  const over = view.winner !== null;
  const writing = view.phase === 'write';
  const amWriter = view.writer === view.me;
  const myTurn = !over && !view.roundOver && !writing && view.current === view.me && !amWriter;
  useForcaSounds(view);
  useEffect(() => {
    setSolveOpen(false);
    setSolving('');
  }, [view.round]);

  const ranking = view.players.map((p, i) => ({ p, i, score: view.scores[i]! })).sort((a, b) => b.score - a.score);
  const clue = view.mode === 'written' && view.writer !== null ? (view.category ? t('hint', { c: view.category }) : t('noHint')) : t('category', { c: view.category });

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
          {writing ? (
            <WritePhase view={view} t={t} awaiting={awaiting} onIntent={onIntent} />
          ) : (
            <>
              <p className="muted forca__meta">
                {t('round', { n: view.round + 1, total: view.rounds })} · <b>{clue}</b>
              </p>
              <div className="forca__hang">
                <Gallows misses={view.misses} />
                <WrongLetters view={view} t={t} />
              </div>
              <div className="forca__word" aria-label={view.pattern.map(c => c ?? '_').join('')}>
                {splitWords(view.pattern).map((part, w) => (
                  <span key={w} className="forca__part">
                    {part.map(({ ch, i }) =>
                      ch === '-' ? (
                        <span key={i} className="forca__dash">-</span>
                      ) : (
                        <span key={i} className={`forca__tile${ch ? ' is-open' : ''}`}>
                          {ch ?? ''}
                        </span>
                      ),
                    )}
                  </span>
                ))}
              </div>
              {amWriter && view.secret && !view.roundOver && <p className="forca__secret">{t('yourSecret', { w: view.secret })} · {t('watching')}</p>}

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
                  <div className="forca__keys" role="group" aria-label={t('yourTurn')}>
                    {KEY_ROWS.map((row, r) => (
                      <div key={r} className="forca__keyrow">
                        {row.map(l => {
                          const tried = view.guessed.includes(l);
                          const wrong = view.wrong.includes(l);
                          const state = tried ? (wrong ? 'is-wrong' : 'is-right') : '';
                          return (
                            <button
                              key={l}
                              type="button"
                              className={`forca__key ${state}`}
                              disabled={!myTurn || tried || awaiting}
                              aria-label={tried ? `${l}: ${wrong ? t('log_miss') : '✓'}` : l}
                              onClick={() => onIntent({ type: 'letter', letter: l })}
                            >
                              {l}
                              {tried && <span className="forca__keymark" aria-hidden="true">{wrong ? '✕' : '✓'}</span>}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {myTurn &&
                    (solveOpen ? (
                      <form
                        className="forca__solve"
                        onSubmit={e => {
                          e.preventDefault();
                          if (!solving.trim() || awaiting) return;
                          onIntent({ type: 'solve', word: solving });
                          setSolving('');
                          setSolveOpen(false);
                        }}
                      >
                        <input value={solving} onChange={e => setSolving(e.target.value)} maxLength={MAX_SECRET_LEN} placeholder={t('solve')} aria-label={t('solve')} autoCapitalize="characters" autoComplete="off" autoFocus />
                        <button type="submit" disabled={!solving.trim() || awaiting}>
                          {t('solveGo')}
                        </button>
                      </form>
                    ) : (
                      <button type="button" className="forca__solveopen" onClick={() => setSolveOpen(true)}>
                        {t('solve')}…
                      </button>
                    ))}
                </>
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
                {view.writer === i && <span className="forca__badge">✎ {t('writer')}</span>}
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

/** The pattern cut at spaces, so a long name wraps between its words, never inside one. */
function splitWords(pattern: (string | null)[]): { ch: string | null; i: number }[][] {
  const parts: { ch: string | null; i: number }[][] = [[]];
  pattern.forEach((ch, i) => {
    if (ch === ' ') parts.push([]);
    else parts.at(-1)!.push({ ch, i });
  });
  return parts.filter(p => p.length > 0);
}

/** Big struck-through letters already tried and missed, and how many misses are left. */
function WrongLetters({ view, t }: { view: ForcaView; t: TextFn }) {
  return (
    <div className="forca__wrong" aria-live="polite">
      <b className="forca__wrongtitle">{t('wrongTitle')}</b>
      {view.wrong.length === 0 ? (
        <span className="muted">{t('wrongNone')}</span>
      ) : (
        <div className="forca__wrongletters">
          {view.wrong.map(l => (
            <s key={l} className="forca__wrongletter">
              {l}
            </s>
          ))}
        </div>
      )}
      {view.wrongWords.length > 0 && <p className="forca__wrongwords">{t('wrongWords', { w: view.wrongWords.join(', ') })}</p>}
      <p className="forca__misses">
        {t('misses', { n: view.misses, max: MAX_MISSES })} · <span className={MAX_MISSES - view.misses <= 2 ? 'forca__danger' : ''}>{t('left', { n: MAX_MISSES - view.misses })}</span>
      </p>
    </div>
  );
}

/** The writer's form, or what the others see while they wait. */
function WritePhase({ view, t, awaiting, onIntent }: { view: ForcaView; t: TextFn; awaiting: boolean; onIntent(intent: unknown): void }) {
  const [word, setWord] = useState('');
  const [hint, setHint] = useState('');
  const canSkip = useCountdown(view.skipInMs, view.round);
  const writer = view.players[view.writer ?? 0]!.name;
  const meta = (
    <p className="muted forca__meta">
      {t('round', { n: view.round + 1, total: view.rounds })}
    </p>
  );
  if (view.writer === view.me) {
    return (
      <form
        className="forca__write"
        onSubmit={e => {
          e.preventDefault();
          if (!word.trim() || awaiting) return;
          onIntent({ type: 'write', word, hint });
        }}
      >
        {meta}
        <h2>{t('writeTitle')}</h2>
        <p className="muted">{t('writeHelp')}</p>
        <input value={word} onChange={e => setWord(e.target.value)} maxLength={MAX_SECRET_LEN} placeholder={t('writeWord')} aria-label={t('writeWord')} autoCapitalize="characters" autoComplete="off" />
        <input value={hint} onChange={e => setHint(e.target.value)} maxLength={MAX_HINT_LEN} placeholder={t('writeHint')} aria-label={t('writeHint')} autoComplete="off" />
        <div className="actions actions--center">
          <button type="submit" className="primary lg" disabled={!word.trim() || awaiting}>
            {t('writeGo')}
          </button>
          <button type="button" className="ghost" disabled={awaiting} onClick={() => onIntent({ type: 'skip' })}>
            {t('writePass')}
          </button>
        </div>
      </form>
    );
  }
  return (
    <div className="forca__write">
      {meta}
      <h2>{t('writing', { name: writer })}</h2>
      {canSkip.left > 0 ? (
        <p className="muted">{t('skipIn', { n: canSkip.left })}</p>
      ) : (
        <button type="button" disabled={awaiting} onClick={() => onIntent({ type: 'skip' })}>
          {t('skip')}
        </button>
      )}
    </div>
  );
}

/** Seconds left from a host-given delay, counted down on this device; restarts each round. */
function useCountdown(ms: number | null, round: number): { left: number } {
  const [deadline, setDeadline] = useState(() => Date.now() + (ms ?? 0));
  const [now, setNow] = useState(Date.now());
  useEffect(() => setDeadline(Date.now() + (ms ?? 0)), [round, ms === null]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return { left: Math.max(0, Math.ceil((deadline - now) / 1000)) };
}

function logLine(e: ForcaLog, view: ForcaView, t: TextFn): string {
  const name = (seat: number) => view.players[seat]!.name;
  switch (e.k) {
    case 'letter':
      return t('log_letter', { name: name(e.seat), letter: e.letter, hits: e.hits > 0 ? t('log_hits', { n: e.hits }) : t('log_miss') });
    case 'solve':
      return e.right ? t('log_solveRight', { name: name(e.seat), n: e.points }) : t('log_solveWrong', { name: name(e.seat), word: e.word });
    case 'timeout':
      return t('log_timeout', { name: name(e.seat) });
    case 'wrote':
      return t('log_wrote', { name: name(e.seat) });
    case 'fallback':
      return t('log_fallback', { name: name(e.seat) });
    case 'round':
      return e.winner === null ? t('hanged', { word: e.word }) : t('solvedBy', { name: name(e.winner), word: e.word });
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
