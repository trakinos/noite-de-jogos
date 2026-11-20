import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../../i18n/LangProvider';
import type { LocalClock } from '../../net/guest';
import { Avatar } from '../../ui/components/Avatar';
import { Icon } from '../../ui/components/Icon';
import { playerColor } from '../../ui/playerColor';
import { EndActions, GameFrame, RulesSheet, useGameText, useReason, type GameScreenProps, type Texts, type TextFn } from '../shared/GameFrame';
import { SimpleLobby, type LobbyProps } from '../shared/SimpleLobby';
import { playSound } from '../shared/sound';
import {
  asStopView, CATEGORIES, cleanAnswer, defaultStopOptions, GRACE_MS, MAX_ANSWER, MIN_CATEGORIES, pointsFor, POINTS_SHARED, POINTS_UNIQUE, REVIEW_MS,
  ROUND_OPTIONS, startsWithLetter, stopModule, TIME_OPTIONS, type StopOptions, type StopView,
} from './game';

export const STOP_RULES = ['rules1', 'rules2', 'rules3', 'rules4'];

export const STOP_TEXT: Texts = {
  pt: {
    rulesTitle: 'Regras do Stop',
    rules1: 'Cada rodada sorteia uma letra. Todo mundo escreve, ao mesmo tempo e em segredo, uma palavra por categoria começando com essa letra. Acentos e maiúsculas não importam.',
    rules2: `Quem preencher todas as categorias pode gritar STOP: os outros têm ${GRACE_MS / 1000} segundos para terminar a palavra e as folhas travam. Se ninguém gritar, a rodada acaba quando o tempo termina.`,
    rules3: `Depois as respostas aparecem e o grupo confere: toque em "Não vale" na resposta de outro jogador para votar contra ela. A resposta é anulada quando mais da metade dos outros jogadores vota contra (com 2 jogadores, o outro decide). Resposta que não começa com a letra já não vale. Se duas respostas são a mesma palavra, mas escritas diferente, toque em "Igual a outra?": quando mais da metade dos jogadores concorda, as duas valem como repetidas. A conferência fecha quando todos marcam "Pronto" ou depois de ${REVIEW_MS / 1000} segundos.`,
    rules4: `Resposta válida que só você deu vale ${POINTS_UNIQUE} pontos; igual à de outra pessoa vale ${POINTS_SHARED}; vazia ou anulada vale 0. Depois da última rodada, vence quem tiver mais pontos.`,
    lobbyRounds: 'Rodadas',
    lobbyTime: 'Tempo por rodada',
    lobbyCategories: 'Categorias',
    lobbyMin: 'Escolha pelo menos {n}.',
    seconds: '{n} s',
    cat_nome: 'Nome',
    cat_animal: 'Animal',
    cat_cor: 'Cor',
    cat_comida: 'Fruta ou comida',
    cat_cep: 'CEP (cidade, estado ou país)',
    cat_objeto: 'Objeto',
    cat_profissao: 'Profissão',
    cat_marca: 'Marca',
    cat_corpo: 'Parte do corpo',
    cat_filme: 'Filme ou série',
    cat_famoso: 'Famoso(a)',
    cat_esporte: 'Esporte ou time',
    cat_sogra: 'Minha sogra é…',
    round: 'Rodada {n} de {total}',
    letter: 'Letra {letter}',
    timeLeft: '{n} s',
    stop: 'STOP!',
    stopHint: 'Preencha todas as categorias com a letra {letter} para gritar STOP.',
    stopReady: 'Tudo preenchido: grite STOP!',
    youStopped: 'Você gritou STOP! As folhas travam em {n}…',
    theyStopped: '{name} gritou STOP! Termine a palavra: {n}…',
    locked: 'Canetas na mesa!',
    notLetter: 'Não começa com {letter}',
    filled: '{n}/{total}',
    reviewTitle: 'Conferência',
    reviewHint: 'Toque em "Não vale" para votar contra uma resposta. Ela é anulada com {n} voto(s).',
    veto: 'Não vale',
    same: 'Igual a outra?',
    sameCancel: 'Cancelar',
    samePick: 'É igual à de {name}',
    sameLinked: '≈ {name} {n}/{need}',
    sameHint: 'Palavras iguais ou quase iguais (gato/gata, sinônimos)? Toque em "Igual a outra?" e escolha com qual. Vale quando mais da metade dos jogadores concorda: as duas valem {n} pontos.',
    'reason:Pick two different answers': 'Escolha duas respostas diferentes.',
    votes: '{n}/{need}',
    mark_empty: 'em branco',
    mark_letter: 'letra errada',
    mark_struck: 'anulada',
    mark_shared: 'repetida',
    mark_unique: 'única',
    ready: 'Pronto',
    readyWait: 'Esperando os outros: {n} de {total} prontos',
    readyCount: '{n} de {total} prontos',
    closesIn: 'Fecha em {n} s',
    scoresTitle: 'Placar da rodada {n}',
    finalTitle: 'Placar final',
    next: 'Próxima rodada',
    win: '{name} venceu!',
    tie: 'Empate: {names}',
    points: '{n} pts',
    plus: '+{n}',
    answersTitle: 'Respostas da rodada',
    playAgain: 'Jogar de novo',
    'reason:Fill every category first': 'Preencha todas as categorias com a letra da rodada.',
    'reason:You cannot vote on your own answer': 'Você não pode votar na própria resposta.',
    'reason:That answer is already invalid': 'Essa resposta já não vale.',
    'reason:The round is still going': 'A rodada ainda não acabou.',
    'reason:The game is over': 'O jogo acabou.',
  },
  en: {
    rulesTitle: 'Stop rules',
    rules1: "Each round draws a letter. Everyone writes, at the same time and in secret, one word per category starting with that letter. Accents and capitals don't matter.",
    rules2: `Whoever fills every category can shout STOP: the others get ${GRACE_MS / 1000} seconds to finish their word and the sheets lock. If nobody shouts, the round ends when the time runs out.`,
    rules3: `Then the answers are shown and the group checks them: tap "Doesn't count" on another player's answer to vote against it. The answer is struck when more than half of the other players vote against it (with 2 players, the other one decides). An answer that doesn't start with the letter never counts. If two answers are the same word written differently, tap "Same as another?": when more than half of the players agree, both count as repeated. The check closes when everyone taps "Ready" or after ${REVIEW_MS / 1000} seconds.`,
    rules4: `A valid answer only you gave scores ${POINTS_UNIQUE} points; the same as someone else's scores ${POINTS_SHARED}; empty or struck scores 0. After the last round, the most points wins.`,
    lobbyRounds: 'Rounds',
    lobbyTime: 'Time per round',
    lobbyCategories: 'Categories',
    lobbyMin: 'Pick at least {n}.',
    seconds: '{n} s',
    cat_nome: 'Name',
    cat_animal: 'Animal',
    cat_cor: 'Color',
    cat_comida: 'Fruit or food',
    cat_cep: 'Place (city, state or country)',
    cat_objeto: 'Object',
    cat_profissao: 'Job',
    cat_marca: 'Brand',
    cat_corpo: 'Body part',
    cat_filme: 'Film or series',
    cat_famoso: 'Famous person',
    cat_esporte: 'Sport or team',
    cat_sogra: 'My mother-in-law is…',
    round: 'Round {n} of {total}',
    letter: 'Letter {letter}',
    timeLeft: '{n} s',
    stop: 'STOP!',
    stopHint: 'Fill every category with the letter {letter} to shout STOP.',
    stopReady: 'All filled: shout STOP!',
    youStopped: 'You shouted STOP! Sheets lock in {n}…',
    theyStopped: '{name} shouted STOP! Finish your word: {n}…',
    locked: 'Pens down!',
    notLetter: "Doesn't start with {letter}",
    filled: '{n}/{total}',
    reviewTitle: 'Checking the answers',
    reviewHint: 'Tap "Doesn\'t count" to vote against an answer. It is struck with {n} vote(s).',
    veto: "Doesn't count",
    same: 'Same as another?',
    sameCancel: 'Cancel',
    samePick: "Same as {name}'s",
    sameLinked: '≈ {name} {n}/{need}',
    sameHint: 'Same or near-same words (cat/cats, synonyms)? Tap "Same as another?" and pick which one. It counts when more than half of the players agree: both score {n} points.',
    'reason:Pick two different answers': 'Pick two different answers.',
    votes: '{n}/{need}',
    mark_empty: 'blank',
    mark_letter: 'wrong letter',
    mark_struck: 'struck',
    mark_shared: 'repeated',
    mark_unique: 'unique',
    ready: 'Ready',
    readyWait: 'Waiting for the others: {n} of {total} ready',
    readyCount: '{n} of {total} ready',
    closesIn: 'Closes in {n} s',
    scoresTitle: 'Round {n} scores',
    finalTitle: 'Final scores',
    next: 'Next round',
    win: '{name} wins!',
    tie: 'Tie: {names}',
    points: '{n} pts',
    plus: '+{n}',
    answersTitle: "This round's answers",
    playAgain: 'Play again',
    'reason:Fill every category first': "Fill every category with the round's letter.",
    'reason:You cannot vote on your own answer': "You can't vote on your own answer.",
    'reason:That answer is already invalid': 'That answer already does not count.',
    'reason:The round is still going': 'The round is not over yet.',
    'reason:The game is over': 'The game is over.',
  },
};

/** The lobby with Stop's settings: rounds, time per round and which categories are on the sheet. */
export function StopLobby(props: LobbyProps) {
  const t = useGameText(STOP_TEXT);
  const parsed = stopModule.parseOptions(props.lobby.options);
  const o: StopOptions = 'error' in parsed ? defaultStopOptions() : parsed;
  const host = props.host;
  const set = (patch: Partial<StopOptions>) => host?.setOptions({ ...o, ...patch });
  const options = host ? (
    <>
      <div className="bsetting">
        <label className="bsetting__select">
          <span>{t('lobbyRounds')}</span>
          <select value={o.rounds} onChange={e => set({ rounds: Number(e.target.value) })}>
            {ROUND_OPTIONS.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="bsetting__select">
          <span>{t('lobbyTime')}</span>
          <select value={o.seconds} onChange={e => set({ seconds: Number(e.target.value) })}>
            {TIME_OPTIONS.map(n => (
              <option key={n} value={n}>{t('seconds', { n })}</option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="bsetting stop__cats">
        <legend>
          {t('lobbyCategories')} <span className="muted">{t('lobbyMin', { n: MIN_CATEGORIES })}</span>
        </legend>
        {CATEGORIES.map(c => {
          const on = o.categories.includes(c);
          return (
            <label key={c} className="bsetting__switch">
              <input
                type="checkbox"
                checked={on}
                disabled={on && o.categories.length <= MIN_CATEGORIES}
                onChange={() => set({ categories: on ? o.categories.filter(x => x !== c) : [...o.categories, c] })}
              />
              <span>{t(`cat_${c}`)}</span>
            </label>
          );
        })}
      </fieldset>
    </>
  ) : (
    <div className="bsetting stop__summary">
      <b>
        {t('lobbyRounds')}: {o.rounds} · {t('lobbyTime')}: {t('seconds', { n: o.seconds })}
      </b>
      <span>
        {t('lobbyCategories')}: {o.categories.map(c => t(`cat_${c}`)).join(', ')}
      </span>
    </div>
  );
  return <SimpleLobby {...props} options={options} rules={{ title: t('rulesTitle'), paragraphs: STOP_RULES.map(k => t(k)) }} />;
}

/** How long after its own countdown ends a screen asks the host to close the phase: time for the last words to arrive first. */
const TICK_LAG_MS = 600;
/** Each seat waits a little longer than the one before, so the screens don't all ask at once. */
const TICK_STAGGER_MS = 120;
/** Typing is sent to the host after this pause, so the sheet that locks is the one on screen. */
const SEND_PAUSE_MS = 350;

export function StopScreen(props: GameScreenProps) {
  const view = asStopView(props.view);
  const t = useGameText(STOP_TEXT);
  const reason = useReason(t);
  const { tr } = useLang();
  const [rules, setRules] = useState(false);
  const { lobby, awaiting, onIntent } = props;
  const over = view.winners !== null;
  const writing = view.phase === 'writing';
  const total = view.categories.length;

  // The host says how long is left; the countdown runs on this device's clock from the moment the view arrived.
  const deadline = useMemo(() => (view.endsInMs === null ? null : Date.now() + view.endsInMs), [props.view]);
  const now = useNow(deadline !== null);
  const secs = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
  const timeUp = deadline !== null && now >= deadline;
  const clock: LocalClock | null = deadline === null ? null : { kind: 'turn', totalMs: view.totalMs, deadline };

  // What I typed this round. A new round (or a reload) starts from what the host has.
  const [draft, setDraft] = useState({ round: view.round, answers: view.mine });
  const local = draft.round === view.round ? draft.answers : view.mine;
  const cleaned = local.map(cleanAnswer);
  const dirty = writing && cleaned.some((a, i) => a !== (view.mine[i] ?? ''));
  const complete = cleaned.every(a => startsWithLetter(a, view.letter));
  const locked = !writing || timeUp;
  const [wantStop, setWantStop] = useState(false);
  /** An answer whose twin is being picked in the review. */
  const [pick, setPick] = useState<{ cat: number; seat: number } | null>(null);
  useEffect(() => setPick(null), [view.round, view.phase]);
  const fields = useRef<(HTMLInputElement | null)[]>([]);

  // Only one move can be on its way to the host at a time: STOP first, then whatever was typed since the last send.
  const sheet = cleaned.join('\n');
  useEffect(() => {
    if (!writing || awaiting) return;
    if (wantStop) {
      setWantStop(false);
      onIntent({ type: 'stop', answers: cleaned });
      return;
    }
    if (!dirty) return;
    const timer = setTimeout(() => onIntent({ type: 'answers', answers: cleaned }), timeUp ? 0 : SEND_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [writing, awaiting, wantStop, dirty, timeUp, sheet]);

  // The host only looks at its clock when a move arrives, so every screen nudges it once its own countdown is over.
  const late = deadline !== null && now >= deadline + TICK_LAG_MS + view.me * TICK_STAGGER_MS;
  useEffect(() => {
    if (late && !awaiting && !dirty) onIntent({ type: 'tick' });
  }, [late, awaiting, dirty, props.view]);

  useStopSounds(view, writing ? secs : 0);

  const ranking = view.players
    .map((p, i) => ({ p, i, score: view.scores[i]! + (view.phase === 'review' ? view.roundPoints?.[i] ?? 0 : 0) }))
    .sort((a, b) => b.score - a.score);
  const readyCount = view.ready.filter(Boolean).length;

  return (
    <GameFrame
      title={tr.t('gameStopName')}
      code={props.code}
      clock={clock}
      error={props.error}
      reason={reason}
      onDismissError={props.onDismissError}
      onEndGame={over ? undefined : props.onEndGame}
      onRules={() => setRules(true)}
      className="stop"
    >
      <div className="stop__table">
        <div className="stop__main">
          <section className="panel stop__head">
            <div className="stop__letter" key={view.round} aria-label={t('letter', { letter: view.letter })}>
              {view.letter}
            </div>
            <div className="stop__headtext">
              <p className="muted">{t('round', { n: view.round + 1, total: view.rounds })}</p>
              {writing ? (
                <p className={`stop__time${secs <= 10 ? ' is-low' : ''}`} role="timer">
                  {t('timeLeft', { n: secs })}
                </p>
              ) : (
                <h2>{view.phase === 'review' ? t('reviewTitle') : over ? t('finalTitle') : t('scoresTitle', { n: view.round + 1 })}</h2>
              )}
            </div>
          </section>

          {writing && (
            <section className="panel stop__sheet">
              {view.stopBy !== null ? (
                <p className="stop__shout" role="status">
                  {timeUp ? t('locked') : view.stopBy === view.me ? t('youStopped', { n: secs }) : t('theyStopped', { name: view.players[view.stopBy]!.name, n: secs })}
                </p>
              ) : (
                timeUp && (
                  <p className="stop__shout" role="status">
                    {t('locked')}
                  </p>
                )
              )}
              <form className="stop__fields" onSubmit={e => e.preventDefault()}>
                {view.categories.map((c, i) => {
                  const value = local[i] ?? '';
                  const typed = cleaned[i] !== '';
                  const good = typed && startsWithLetter(cleaned[i]!, view.letter);
                  return (
                    <label key={c} className={`stop__field${typed ? (good ? ' is-good' : ' is-bad') : ''}`}>
                      <span className="stop__cat">{t(`cat_${c}`)}</span>
                      <input
                        ref={el => {
                          fields.current[i] = el;
                        }}
                        value={value}
                        maxLength={MAX_ANSWER}
                        disabled={locked}
                        placeholder={`${view.letter}…`}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="words"
                        spellCheck={false}
                        enterKeyHint={i === total - 1 ? 'done' : 'next'}
                        onChange={e => {
                          const answers = view.categories.map((_, j) => (j === i ? e.target.value : local[j] ?? ''));
                          setDraft({ round: view.round, answers });
                        }}
                        onKeyDown={e => {
                          if (e.key !== 'Enter') return;
                          const next = fields.current[i + 1];
                          if (next) next.focus();
                          else e.currentTarget.blur();
                        }}
                      />
                      {typed && !good && <small>{t('notLetter', { letter: view.letter })}</small>}
                    </label>
                  );
                })}
              </form>
              <div className="stop__go">
                <button type="button" className="stop__btn" disabled={!complete || locked || view.stopBy !== null || wantStop} onClick={() => setWantStop(true)}>
                  {t('stop')}
                </button>
                <p className="muted">{complete ? t('stopReady') : t('stopHint', { letter: view.letter })}</p>
              </div>
            </section>
          )}

          {view.phase === 'scores' && (
            <section className="panel stop__result">
              {over && <h2 className="stop__winner">{winnerLine(view, t)}</h2>}
              <ol className="stop__ranking">
                {ranking.map(({ p, i, score }) => (
                  <li key={p.id} className={view.winners?.includes(i) ? 'is-winner' : ''}>
                    <Avatar name={p.name} color={playerColor(lobby, p.id)} />
                    <b>{p.name}</b>
                    <span className="stop__plus">{t('plus', { n: view.roundPoints?.[i] ?? 0 })}</span>
                    <span className="stop__pts">{t('points', { n: score })}</span>
                  </li>
                ))}
              </ol>
              {over ? (
                <EndActions isHost={props.isHost} onPlayAgain={props.onPlayAgain} onBackToLobby={props.onBackToLobby} onLeave={props.onLeave} playAgain={t('playAgain')} />
              ) : (
                <div className="actions actions--center">
                  <button type="button" className="primary lg" disabled={awaiting} onClick={() => onIntent({ type: 'next', round: view.round })}>
                    {t('next')}
                  </button>
                </div>
              )}
            </section>
          )}

          {view.answers && view.marks && view.rejects && (
            <section className="panel stop__review">
              {view.phase === 'review' ? (
                <p className="muted stop__hint">
                  {t('reviewHint', { n: view.votesNeeded })} {t('sameHint', { n: POINTS_SHARED })}
                </p>
              ) : <h3 className="stop__answers">{t('answersTitle')}</h3>}
              {view.categories.map((c, ci) => (
                <div key={c} className="stop__group">
                  <h3>{t(`cat_${c}`)}</h3>
                  <ul>
                    {view.players.map((p, seat) => {
                      const mark = view.marks![seat]![ci]!;
                      const answer = view.answers![seat]![ci]!;
                      const votes = view.rejects![seat]![ci]!;
                      const canVote = view.phase === 'review' && seat !== view.me && mark !== 'empty' && mark !== 'letter';
                      const mine = votes.includes(view.me);
                      const counts = mark === 'unique' || mark === 'shared';
                      const twins = view.phase === 'review' ? view.players.filter((_, o) => o !== seat && ['unique', 'shared'].includes(view.marks![o]![ci]!)).length : 0;
                      const links = (view.sames ?? []).filter(x => x.cat === ci && (x.a === seat || x.b === seat));
                      return (
                        <li key={p.id} className={`stop__ans is-${mark}`}>
                          <Avatar name={p.name} color={playerColor(lobby, p.id)} />
                          <span className="stop__who">{p.name}</span>
                          <b className="stop__word">{answer || '—'}</b>
                          <span className="stop__mark">{t(`mark_${mark}`)}</span>
                          <span className="stop__plus">{t('plus', { n: pointsFor(mark) })}</span>
                          {links.map(x => {
                            const other = x.a === seat ? x.b : x.a;
                            return (
                              <button
                                key={other}
                                type="button"
                                className={`stop__same is-link${x.voters.includes(view.me) ? ' is-on' : ''}`}
                                aria-pressed={x.voters.includes(view.me)}
                                disabled={awaiting}
                                onClick={() => onIntent({ type: 'same', a: x.a, b: x.b, cat: ci })}
                              >
                                {t('sameLinked', { name: view.players[other]!.name, n: x.voters.length, need: view.sameNeeded })}
                              </button>
                            );
                          })}
                          {view.phase === 'review' && counts && twins > 0 && (
                            pick && pick.cat === ci ? (
                              pick.seat === seat ? (
                                <button type="button" className="stop__same is-on" onClick={() => setPick(null)}>
                                  {t('sameCancel')}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="stop__same is-pick"
                                  disabled={awaiting}
                                  onClick={() => {
                                    onIntent({ type: 'same', a: pick.seat, b: seat, cat: ci });
                                    setPick(null);
                                  }}
                                >
                                  {t('samePick', { name: view.players[pick.seat]!.name })}
                                </button>
                              )
                            ) : (
                              <button type="button" className="stop__same" onClick={() => setPick({ cat: ci, seat })}>
                                {t('same')}
                              </button>
                            )
                          )}
                          {canVote ? (
                            <button
                              type="button"
                              className={`stop__veto${mine ? ' is-on' : ''}`}
                              aria-pressed={mine}
                              disabled={awaiting}
                              onClick={() => onIntent({ type: 'vote', seat, cat: ci })}
                            >
                              <Icon name="x" />
                              <span>{t('veto')}</span>
                              <span className="stop__count">{t('votes', { n: votes.length, need: view.votesNeeded })}</span>
                            </button>
                          ) : (
                            votes.length > 0 && (
                              <span className="stop__count" title={t('veto')}>
                                <Icon name="x" />
                                {t('votes', { n: votes.length, need: view.votesNeeded })}
                              </span>
                            )
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {view.phase === 'review' && (
                <div className="stop__readybar">
                  {view.ready[view.me] ? (
                    <b>{t('readyWait', { n: readyCount, total: view.players.length })}</b>
                  ) : (
                    <button type="button" className="primary lg" disabled={awaiting} onClick={() => onIntent({ type: 'ready' })}>
                      <Icon name="check" />
                      {t('ready')}
                    </button>
                  )}
                  <span className="muted">
                    {t('readyCount', { n: readyCount, total: view.players.length })} · {t('closesIn', { n: secs })}
                  </span>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="panel stop__scores">
          {ranking.map(({ p, i, score }) => (
            <div key={p.id} className={`stop__player${view.stopBy === i ? ' is-stopper' : ''}`}>
              <Avatar name={p.name} color={playerColor(lobby, p.id)} />
              <b>{p.name}</b>
              {writing && <span className="stop__filled">{t('filled', { n: view.filled[i]!, total })}</span>}
              {view.phase === 'review' && view.ready[i] && (
                <span className="stop__isready" title={t('ready')}>
                  <Icon name="check" />
                </span>
              )}
              <span className="stop__pts">{t('points', { n: score })}</span>
            </div>
          ))}
        </aside>
      </div>
      {rules && <RulesSheet title={t('rulesTitle')} paragraphs={STOP_RULES.map(k => t(k))} onClose={() => setRules(false)} />}
    </GameFrame>
  );
}

function winnerLine(view: StopView, t: TextFn): string {
  const names = (view.winners ?? []).map(i => view.players[i]!.name);
  return names.length === 1 ? t('win', { name: names[0]! }) : t('tie', { names: names.join(', ') });
}

/** The current time, refreshed a few times a second while something is counting down. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/** A sound for the letter draw, the STOP, the lock and the scores, plus a tick for each of the last five seconds of writing. */
function useStopSounds(view: StopView, writingSecs: number) {
  const seen = useRef(view.logTotal);
  useEffect(() => {
    const added = view.logTotal - seen.current;
    seen.current = view.logTotal;
    if (added <= 0) return;
    const last = view.log.at(-1);
    if (!last) return;
    if (view.winners !== null) playSound(view.winners.includes(view.me) ? 'win' : 'lose');
    else if (last.k === 'letter') playSound('spin');
    else if (last.k === 'stop') playSound('alert');
    else if (last.k === 'lock') playSound(last.timeout ? 'wrong' : 'card');
    else if (last.k === 'round') playSound('coin');
  }, [view.logTotal]);

  useEffect(() => {
    if (writingSecs >= 1 && writingSecs <= 5) playSound('click');
  }, [writingSecs]);
}
