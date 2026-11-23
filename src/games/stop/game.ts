import { createRng, shuffle } from '../../engine/rng';
import type { ClockInput, ClockKind } from '../../net/turnClock';
import type { ApplyResult, GameInstance, GameModule, SeatInfo } from '../module';

/**
 * Stop (Adedonha): each round draws a letter and everyone writes one word per category starting with it, all at once.
 * The first to fill every category shouts STOP, which locks everybody's sheet after a short grace; the round also ends when its time runs out.
 * Then the answers are shown and the players themselves strike the ones that don't count. A valid answer nobody else gave scores 10, a repeated one 5.
 *
 * Everyone plays at the same time, so the room's turn timer does not apply. The game keeps its own deadlines on the host's wall clock:
 * every intent first settles any deadline that has passed, and the players' screens send a `tick` when their countdown reaches zero.
 */

export const CATEGORIES = ['nome', 'animal', 'cor', 'comida', 'cep', 'objeto', 'profissao', 'marca', 'corpo', 'filme', 'famoso', 'esporte', 'sogra'] as const;
export type CategoryId = (typeof CATEGORIES)[number];
export const DEFAULT_CATEGORIES: CategoryId[] = ['nome', 'animal', 'cor', 'comida', 'cep', 'objeto', 'profissao', 'marca'];
export const MIN_CATEGORIES = 3;

/** The alphabet without the letters that leave most categories empty in Portuguese: K, Q, W, X, Y. */
export const LETTERS = 'ABCDEFGHIJLMNOPRSTUVZ'.split('');

export const ROUND_OPTIONS = [3, 5, 7, 10] as const;
export const TIME_OPTIONS = [60, 90, 120, 180] as const;
export const MAX_ANSWER = 30;
/** After STOP, everyone has this long to finish the word they were typing. */
export const GRACE_MS = 3000;
/** The letter takes this long to be drawn on screen; the writing time only starts after it. */
export const INTRO_MS = 2400;
/** The review closes by itself after this long, so a player who walked away cannot hold the room. */
export const REVIEW_MS = 90_000;
export const POINTS_UNIQUE = 10;
export const POINTS_SHARED = 5;

export interface StopOptions {
  rounds: number;
  /** Seconds to write each round. */
  seconds: number;
  categories: CategoryId[];
  /** Letters never drawn, on top of the ones already left out. */
  excluded?: string[];
}

export type StopPhase = 'writing' | 'review' | 'scores';

/** Why an answer scores what it does. `letter`: it does not start with the round's letter. `struck`: the others voted it out. */
export type Mark = 'empty' | 'letter' | 'struck' | 'shared' | 'unique';

export type StopLog =
  | { k: 'letter'; round: number; letter: string }
  | { k: 'stop'; seat: number }
  | { k: 'lock'; timeout: boolean }
  | { k: 'round'; round: number; points: number[] };

export interface SamePair {
  /** a < b */
  a: number;
  b: number;
  cat: number;
  voters: number[];
}

export interface StopState {
  players: SeatInfo[];
  options: StopOptions;
  /** One letter per round, drawn without repeats when the match starts. */
  letters: string[];
  round: number;
  phase: StopPhase;
  /** Host wall-clock time (ms) when the current phase ends by itself; null while the scores are shown. */
  deadline: number | null;
  /** Host wall-clock time (ms) when the letter has been drawn and writing may begin. */
  writeFrom: number;
  stopBy: number | null;
  /** [seat][category] */
  answers: string[][];
  /** [seat][category]: the seats that voted this answer out. */
  rejects: number[][][];
  /** Answers the players say are the same word, with who said so; a pair counts once more than half agree. */
  sames: SamePair[];
  ready: boolean[];
  /** Totals of the rounds already scored. */
  scores: number[];
  /** Points of the round just scored, per seat. */
  roundPoints: number[] | null;
  /** Set after the last round; more than one seat on a tie. */
  winners: number[] | null;
  log: StopLog[];
}

export type StopIntent =
  | { type: 'answers'; answers: string[] }
  | { type: 'stop'; answers?: string[] }
  | { type: 'tick' }
  | { type: 'vote'; seat: number; cat: number }
  /** Toggles my vote that the answers of seats `a` and `b` in category `cat` are the same word. */
  | { type: 'same'; a: number; b: number; cat: number }
  | { type: 'ready' }
  | { type: 'next'; round: number };

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

/** What is stored for a typed answer: single spaces, no edges, at most MAX_ANSWER characters. Cleaning twice changes nothing. */
export function cleanAnswer(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return [...raw.replace(/\s+/g, ' ').trim()].slice(0, MAX_ANSWER).join('').trim();
}

/** The form answers are compared in: no accents, lower case, punctuation as spaces. "São-Paulo" and "sao paulo" are the same answer. */
export function normalize(answer: string): string {
  return answer.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function startsWithLetter(answer: string, letter: string): boolean {
  return normalize(answer).startsWith(letter.toLowerCase());
}

/** Votes that strike an answer: more than half of the other players (the one other player in a game of two). */
export function votesNeeded(players: number): number {
  return Math.floor((players - 1) / 2) + 1;
}

/** Votes that link two answers as the same word ("gato" and "gata", synonyms): more than half of all the players. */
export function sameVotesNeeded(players: number): number {
  return Math.floor(players / 2) + 1;
}

export function pointsFor(mark: Mark): number {
  return mark === 'unique' ? POINTS_UNIQUE : mark === 'shared' ? POINTS_SHARED : 0;
}

export function createStop(seats: SeatInfo[], options: StopOptions, seed: number, now: number): StopState {
  const rng = createRng(seed);
  const s: StopState = {
    players: seats,
    options,
    letters: shuffle(rng, LETTERS.filter(l => !options.excluded?.includes(l))).slice(0, options.rounds),
    round: -1,
    phase: 'writing',
    deadline: null,
    writeFrom: 0,
    stopBy: null,
    answers: [],
    rejects: [],
    ready: [],
    sames: [],
    scores: seats.map(() => 0),
    roundPoints: null,
    winners: null,
    log: [],
  };
  startRound(s, now);
  return s;
}

function startRound(s: StopState, now: number): void {
  s.round++;
  s.phase = 'writing';
  s.writeFrom = now + INTRO_MS;
  s.deadline = s.writeFrom + s.options.seconds * 1000;
  s.stopBy = null;
  s.answers = s.players.map(() => s.options.categories.map(() => ''));
  s.rejects = s.players.map(() => s.options.categories.map(() => []));
  s.ready = s.players.map(() => false);
  s.sames = [];
  s.roundPoints = null;
  s.log.push({ k: 'letter', round: s.round, letter: s.letters[s.round]! });
}

/** Every answer of the round with the reason for its score. */
export function markRound(s: StopState): Mark[][] {
  const letter = s.letters[s.round]!.toLowerCase();
  const need = votesNeeded(s.players.length);
  const marks: Mark[][] = s.players.map(() => []);
  s.options.categories.forEach((_, c) => {
    const keys = s.answers.map(a => normalize(a[c] ?? ''));
    const valid = keys.map((key, seat) => key !== '' && key.startsWith(letter) && s.rejects[seat]![c]!.length < need);
    // Answers that are written alike, or that the players agreed are the same word, share a group.
    const group = keys.map((_, i) => i);
    const root = (i: number): number => (group[i] === i ? i : (group[i] = root(group[i]!)));
    const link = (a: number, b: number) => void (group[root(a)] = root(b));
    keys.forEach((key, a) => keys.forEach((other, b) => b > a && valid[a] && valid[b] && other === key && link(a, b)));
    for (const pair of s.sames) {
      if (pair.cat === c && pair.voters.length >= sameVotesNeeded(s.players.length) && valid[pair.a] && valid[pair.b]) link(pair.a, pair.b);
    }
    keys.forEach((key, seat) => {
      if (key === '') marks[seat]![c] = 'empty';
      else if (!key.startsWith(letter)) marks[seat]![c] = 'letter';
      else if (!valid[seat]) marks[seat]![c] = 'struck';
      else marks[seat]![c] = keys.some((_, i) => i !== seat && valid[i] && root(i) === root(seat)) ? 'shared' : 'unique';
    });
  });
  return marks;
}

function roundPoints(s: StopState): number[] {
  return markRound(s).map(row => row.reduce((sum, m) => sum + pointsFor(m), 0));
}

function lock(s: StopState, now: number): void {
  s.log.push({ k: 'lock', timeout: s.stopBy === null });
  s.phase = 'review';
  s.deadline = now + REVIEW_MS;
}

function closeReview(s: StopState): void {
  const points = roundPoints(s);
  points.forEach((p, seat) => (s.scores[seat]! += p));
  s.roundPoints = points;
  s.phase = 'scores';
  s.deadline = null;
  s.log.push({ k: 'round', round: s.round, points });
  if (s.round === s.letters.length - 1) {
    const best = Math.max(...s.scores);
    s.winners = s.scores.flatMap((score, seat) => (score === best ? [seat] : []));
  }
}

/** Settles a deadline that has passed: writing locks into the review, the review closes into the scores. */
export function settle(s: StopState, now: number): void {
  if (s.deadline === null || now < s.deadline) return;
  if (s.phase === 'writing') lock(s, now);
  else if (s.phase === 'review') closeReview(s);
}

function setAnswers(s: StopState, seat: number, raw: unknown): void {
  if (!Array.isArray(raw)) return;
  s.answers[seat] = s.options.categories.map((_, c) => cleanAnswer(raw[c]));
}

function complete(s: StopState, seat: number): boolean {
  return s.answers[seat]!.every(a => startsWithLetter(a, s.letters[s.round]!));
}

/**
 * A move that arrives just after its phase closed (answers, STOP, a vote, a tick) is accepted and changes nothing:
 * the player gets the new phase instead of an error for something they could not have known.
 */
export function applyStop(s: StopState, seat: number, intent: StopIntent, now: number): ApplyResult {
  if (seat < 0 || seat >= s.players.length) return fail('Not a player');
  if (!intent || typeof intent !== 'object') return fail('Bad move');
  if (s.winners !== null) return fail('The game is over');
  switch (intent.type) {
    case 'answers':
      // What was typed before the sheet locked still counts, even if it reaches the host a moment after the deadline.
      if (s.phase === 'writing') setAnswers(s, seat, intent.answers);
      settle(s, now);
      return ok();
    case 'stop': {
      settle(s, now);
      if (s.phase !== 'writing') return ok();
      if (intent.answers !== undefined) setAnswers(s, seat, intent.answers);
      if (s.stopBy !== null) return ok();
      if (!complete(s, seat)) return fail('Fill every category first');
      s.stopBy = seat;
      s.deadline = Math.min(s.deadline ?? Infinity, now + GRACE_MS);
      s.log.push({ k: 'stop', seat });
      return ok();
    }
    case 'tick':
      settle(s, now);
      return ok();
    case 'vote': {
      settle(s, now);
      if (s.phase !== 'review') return ok();
      const { seat: target, cat } = intent;
      if (!Number.isInteger(target) || !Number.isInteger(cat) || !s.rejects[target]?.[cat]) return fail('Bad move');
      if (target === seat) return fail('You cannot vote on your own answer');
      const mark = markRound(s)[target]![cat]!;
      if (mark === 'empty' || mark === 'letter') return fail('That answer is already invalid');
      const votes = s.rejects[target]![cat]!;
      const at = votes.indexOf(seat);
      if (at >= 0) votes.splice(at, 1);
      else votes.push(seat);
      return ok();
    }
    case 'same': {
      settle(s, now);
      if (s.phase !== 'review') return ok();
      const { a, b, cat } = intent;
      if (![a, b, cat].every(Number.isInteger) || !s.rejects[a]?.[cat] || !s.rejects[b]?.[cat]) return fail('Bad move');
      if (a === b) return fail('Pick two different answers');
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const marks = markRound(s);
      const counts = (m: Mark) => m === 'unique' || m === 'shared';
      if (!counts(marks[lo]![cat]!) || !counts(marks[hi]![cat]!)) return fail('That answer is already invalid');
      let pair = s.sames.find(x => x.a === lo && x.b === hi && x.cat === cat);
      if (!pair) s.sames.push((pair = { a: lo, b: hi, cat, voters: [] }));
      const at = pair.voters.indexOf(seat);
      if (at >= 0) pair.voters.splice(at, 1);
      else pair.voters.push(seat);
      if (pair.voters.length === 0) s.sames = s.sames.filter(x => x !== pair);
      return ok();
    }
    case 'ready':
      settle(s, now);
      if (s.phase !== 'review') return ok();
      s.ready[seat] = true;
      if (s.ready.every(Boolean)) closeReview(s);
      return ok();
    case 'next':
      // Two players pressing "next" together must not skip a round.
      if (intent.round !== s.round) return ok();
      if (s.phase !== 'scores') return fail('The round is still going');
      startRound(s, now);
      return ok();
    default:
      return fail('Bad move');
  }
}

export interface StopView {
  players: { id: string; name: string }[];
  me: number;
  round: number;
  rounds: number;
  letter: string;
  categories: CategoryId[];
  phase: StopPhase;
  /** Time left in this phase when the view was made; null when nothing is counting down. */
  endsInMs: number | null;
  /** How long the letter is still being drawn, with the countdown held until then. */
  introMs: number;
  /** The full length of the running countdown, for the timer bar. */
  totalMs: number;
  stopBy: number | null;
  /** How many categories each player has filled. Nobody else's words leave the host while the round is open. */
  filled: number[];
  /** My own answers as the host has them. */
  mine: string[];
  /** Everyone's answers, [seat][category]; null while writing. */
  answers: string[][] | null;
  marks: Mark[][] | null;
  /** [seat][category]: who voted the answer out; null while writing. */
  rejects: number[][][] | null;
  votesNeeded: number;
  /** Answers voted to be the same word, and how many votes link them. */
  sames: SamePair[] | null;
  sameNeeded: number;
  ready: boolean[];
  /** Totals of the rounds already scored. */
  scores: number[];
  /** This round's points per seat: provisional during the review, final on the scores; null while writing. */
  roundPoints: number[] | null;
  winners: number[] | null;
  log: StopLog[];
  logTotal: number;
}

export function stopView(s: StopState, seat: number, now: number): StopView {
  const open = s.phase !== 'writing';
  return {
    players: s.players.map(p => ({ id: p.id, name: p.name })),
    me: seat,
    round: s.round,
    rounds: s.letters.length,
    letter: s.letters[s.round]!,
    categories: s.options.categories,
    phase: s.phase,
    endsInMs: s.deadline === null ? null : Math.max(0, s.deadline - now),
    introMs: s.phase === 'writing' && s.stopBy === null ? Math.max(0, s.writeFrom - now) : 0,
    totalMs: s.phase === 'review' ? REVIEW_MS : s.stopBy !== null ? GRACE_MS : s.options.seconds * 1000,
    stopBy: s.stopBy,
    filled: s.answers.map(row => row.filter(a => a !== '').length),
    mine: s.answers[seat]!,
    answers: open ? s.answers : null,
    marks: open ? markRound(s) : null,
    rejects: open ? s.rejects : null,
    votesNeeded: votesNeeded(s.players.length),
    sames: open ? s.sames : null,
    sameNeeded: sameVotesNeeded(s.players.length),
    ready: s.ready,
    scores: s.scores,
    roundPoints: s.phase === 'scores' ? s.roundPoints : open ? roundPoints(s) : null,
    winners: s.winners,
    log: s.log,
    logTotal: s.log.length,
  };
}

export class StopInstance implements GameInstance {
  private readonly turn = {};
  constructor(readonly state: StopState, private readonly now: () => number = Date.now) {}

  private seat(id: string): number {
    return this.state.players.findIndex(p => p.id === id);
  }

  apply(playerId: string, intent: unknown): ApplyResult {
    return applyStop(this.state, this.seat(playerId), intent as StopIntent, this.now());
  }

  viewFor(playerId: string): StopView {
    const seat = this.seat(playerId);
    if (seat < 0) throw new Error(`Unknown player: ${playerId}`);
    return stopView(this.state, seat, this.now());
  }

  /** Nobody has "the turn": the room's turn timer never runs here. */
  clockInput(): ClockInput {
    return { turn: this.turn, currentPlayer: 0, pending: null, over: true };
  }

  get over(): boolean {
    return this.state.winners !== null;
  }

  expire(_kind: ClockKind, _seed: number): void {
    settle(this.state, this.now());
  }
}

export function defaultStopOptions(): StopOptions {
  return { rounds: 5, seconds: 90, categories: [...DEFAULT_CATEGORIES] };
}

export const stopModule: GameModule<StopOptions> = {
  id: 'stop',
  minPlayers: 2,
  maxPlayers: 8,
  defaultOptions: defaultStopOptions,
  parseOptions(raw) {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const d = defaultStopOptions();
    const rounds = (ROUND_OPTIONS as readonly unknown[]).includes(o.rounds) ? (o.rounds as number) : d.rounds;
    const seconds = (TIME_OPTIONS as readonly unknown[]).includes(o.seconds) ? (o.seconds as number) : d.seconds;
    const excluded = Array.isArray(o.excluded) ? LETTERS.filter(l => (o.excluded as unknown[]).includes(l)) : [];
    if (LETTERS.length - excluded.length < rounds) return { error: 'Not enough letters left for that many rounds' };
    const extra = excluded.length > 0 ? { excluded } : {};
    if (o.categories === undefined) return { rounds, seconds, categories: d.categories, ...extra };
    const picked = Array.isArray(o.categories) ? o.categories : [];
    // Kept in the list's own order, whatever order they were ticked in.
    const categories = CATEGORIES.filter(c => picked.includes(c));
    if (categories.length < MIN_CATEGORIES) return { error: `Pick at least ${MIN_CATEGORIES} categories` };
    return { rounds, seconds, categories, ...extra };
  },
  create: (seats, options, seed) => new StopInstance(createStop(seats, options, seed, Date.now())),
};

export function asStopView(v: unknown): StopView {
  return v as StopView;
}
