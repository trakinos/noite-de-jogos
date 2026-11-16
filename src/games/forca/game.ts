import { createRng, nextInt, shuffle, type RngState } from '../../engine/rng';
import type { ClockInput, ClockKind } from '../../net/turnClock';
import type { ApplyResult, GameInstance, GameModule, SeatInfo } from '../module';
import { FORCA_EN, FORCA_PT } from './words';

/**
 * Forca: a few rounds, each with a secret word and its category. Players take turns guessing a letter:
 * each copy of a right letter scores a point and the player goes again; a wrong letter hangs another piece and passes the turn.
 * A player can try the whole word instead: right ends the round with a bonus for every letter still hidden, wrong hangs a piece.
 *
 * In the written mode the word comes from a player instead of the lists: each round one player (rotating) types a secret word
 * and the others guess it. The writer watches, scoring a point for every miss and a bonus when the group is hanged.
 * A writer who doesn't answer in time, or passes, gets a list word instead and guesses along with everyone.
 */

export const MAX_MISSES = 6;
export const ROUNDS = 5;
export const SOLVE_BONUS = 2;
export const LAST_LETTER_BONUS = 3;
/** Written mode: what the writer earns for each miss, and on top of that when the group is hanged. */
export const WRITER_MISS_POINTS = 1;
export const WRITER_HANG_BONUS = 2;
/** Written mode: limits of a player's word. Letters, spaces and hyphens only. */
export const MIN_SECRET_LETTERS = 3;
export const MAX_SECRET_LEN = 30;
export const MAX_SECRET_PART = 16;
export const MAX_HINT_LEN = 30;
/** Written mode: how long the others wait before they may swap a silent writer's turn for a list word. */
export const WRITE_SKIP_MS = 60_000;
/** The on-screen keyboard, the same on every device. */
export const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map(row => row.split(''));

export type ForcaLang = 'pt' | 'en';
export type ForcaMode = 'list' | 'written';

export type ForcaLog =
  | { k: 'letter'; seat: number; letter: string; hits: number }
  | { k: 'solve'; seat: number; word: string; right: boolean; points: number }
  | { k: 'timeout'; seat: number }
  | { k: 'wrote'; seat: number }
  | { k: 'fallback'; seat: number }
  | { k: 'round'; word: string; winner: number | null };

export interface ForcaWord {
  word: string;
  category: string;
}

export interface ForcaState {
  rng: RngState;
  players: SeatInfo[];
  mode: ForcaMode;
  /** One list word per round, never repeated. In the written mode these are the fallbacks. */
  words: ForcaWord[];
  /** Written mode: the word the writer typed for this round. */
  custom: ForcaWord | null;
  /** 'write' while the round's writer is typing the word. */
  phase: 'write' | 'guess';
  /** Written mode: who writes (or wrote) this round's word; null once the round fell back to a list word. */
  writer: number | null;
  firstWriter: number;
  round: number;
  guessed: string[];
  /** Whole-word tries that missed this round. */
  wrongWords: string[];
  misses: number;
  current: number;
  scores: number[];
  /** Set when the round ends, until someone starts the next one. */
  roundOver: { word: string; solvedBy: number | null } | null;
  winner: number | null;
  log: ForcaLog[];
  turns: number;
}

export type ForcaIntent =
  | { type: 'letter'; letter: string }
  | { type: 'solve'; word: string }
  | { type: 'next' }
  | { type: 'write'; word: string; hint?: string }
  | { type: 'skip' };

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

/** The plain capital letter a character counts as: Ã → A, Ç → C. Anything else (space, hyphen) is null. */
export function letterOf(ch: string): string | null {
  const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  return /^[A-Z]$/.test(base) ? base : null;
}

export function normalizeWord(w: string): string {
  return [...w.trim().toUpperCase()].map(ch => letterOf(ch) ?? (ch === ' ' || ch === '-' ? ch : '')).join('').replace(/\s+/g, ' ');
}

/** A player's secret word, tidied (capitals, single spaces, accents kept), or why it can't be used. */
export function cleanSecret(raw: unknown): { word: string } | { error: string } {
  if (typeof raw !== 'string') return { error: 'Type the word' };
  const word = raw.normalize('NFC').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!word) return { error: 'Type the word' };
  if (word.length > MAX_SECRET_LEN) return { error: 'The word is too long' };
  const chars = [...word];
  if (chars.some(ch => ch !== ' ' && ch !== '-' && letterOf(ch) === null)) return { error: 'Use only letters, spaces and hyphens' };
  // Separators only between letters, one at a time.
  if (/^[ -]|[ -]$|[ -]{2}/.test(word)) return { error: 'Use only letters, spaces and hyphens' };
  if (chars.filter(ch => letterOf(ch) !== null).length < MIN_SECRET_LETTERS) return { error: 'The word is too short' };
  if (word.split(/[ -]/).some(part => [...part].length > MAX_SECRET_PART)) return { error: 'The word is too long' };
  return { word };
}

/** The optional hint shown as the category of a written word. */
export function cleanHint(raw: unknown): { hint: string } | { error: string } {
  if (raw === undefined || raw === null) return { hint: '' };
  if (typeof raw !== 'string') return { error: 'Bad move' };
  // eslint-disable-next-line no-control-regex
  const hint = raw.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().replace(/\s+/g, ' ');
  if ([...hint].length > MAX_HINT_LEN) return { error: 'The hint is too long' };
  return { hint };
}

/** How many rounds a match has. Written mode: everyone writes the same number of times (twice in small groups). */
export function roundsFor(mode: ForcaMode, players: number): number {
  if (mode === 'list') return ROUNDS;
  return players <= 3 ? players * 2 : players;
}

/**
 * `count` different words, walking the categories in a shuffled order so a match mixes them
 * whatever their sizes. Words in `avoid` (played recently on this device) are left for later while others remain.
 */
export function pickWords(rng: RngState, bank: Record<string, readonly string[]>, count: number, avoid: ReadonlySet<string> = new Set()): ForcaWord[] {
  const categories = shuffle(rng, Object.keys(bank));
  const used = new Set<string>();
  const out: ForcaWord[] = [];
  for (let i = 0; out.length < count && i < count * categories.length; i++) {
    const category = categories[i % categories.length]!;
    const pool = bank[category]!.filter(w => !used.has(normalizeWord(w)));
    const fresh = pool.filter(w => !avoid.has(w));
    const from = fresh.length > 0 ? fresh : pool;
    if (from.length === 0) continue;
    const word = from[nextInt(rng, from.length)]!;
    used.add(normalizeWord(word));
    out.push({ word, category });
  }
  return out;
}

export function createForca(seats: SeatInfo[], seed: number, lang: ForcaLang, mode: ForcaMode = 'list', avoid: ReadonlySet<string> = new Set()): ForcaState {
  const rng = createRng(seed);
  const words = pickWords(rng, lang === 'en' ? FORCA_EN : FORCA_PT, roundsFor(mode, seats.length), avoid);
  const first = nextInt(rng, seats.length);
  const s: ForcaState = {
    rng, players: seats, mode, words, custom: null, phase: 'guess', writer: null, firstWriter: first, round: 0, guessed: [], wrongWords: [],
    misses: 0, current: first, scores: seats.map(() => 0), roundOver: null, winner: null, log: [], turns: 0,
  };
  if (mode === 'written') startWriting(s);
  return s;
}

function secretOf(s: ForcaState): ForcaWord {
  return s.custom ?? s.words[s.round]!;
}

function secret(s: ForcaState): string {
  return secretOf(s).word;
}

function lettersLeft(s: ForcaState): string[] {
  return [...new Set([...secret(s)].map(letterOf).filter((l): l is string => l !== null && !s.guessed.includes(l)))];
}

/** The turn goes to the next player who is guessing: never the round's writer. */
function pass(s: ForcaState): void {
  do s.current = (s.current + 1) % s.players.length;
  while (s.current === s.writer && s.players.length > 1);
  s.turns++;
}

/** Written mode: the round opens with its writer typing the word. */
function startWriting(s: ForcaState): void {
  s.writer = (s.firstWriter + s.round) % s.players.length;
  s.custom = null;
  s.phase = 'write';
  s.current = s.writer;
  s.turns++;
}

/** The writer didn't write: this round uses a list word and they guess along, earning nothing as writer. */
export function fallBack(s: ForcaState): void {
  if (s.phase !== 'write' || s.writer === null) return;
  s.log.push({ k: 'fallback', seat: s.writer });
  const after = s.writer;
  s.writer = null;
  s.custom = null;
  s.phase = 'guess';
  s.current = after;
  pass(s);
}

function endRound(s: ForcaState, solvedBy: number | null): void {
  s.roundOver = { word: secret(s), solvedBy };
  s.log.push({ k: 'round', word: secret(s), winner: solvedBy });
  s.turns++;
  if (s.round === s.words.length - 1) {
    const best = Math.max(...s.scores);
    s.winner = s.scores.indexOf(best);
  }
}

function miss(s: ForcaState): void {
  s.misses++;
  if (s.writer !== null) s.scores[s.writer]! += WRITER_MISS_POINTS;
  if (s.misses >= MAX_MISSES) {
    if (s.writer !== null) s.scores[s.writer]! += WRITER_HANG_BONUS;
    endRound(s, null);
  } else pass(s);
}

export function guessLetter(s: ForcaState, seat: number, letter: string): void {
  s.guessed.push(letter);
  const hits = [...secret(s)].filter(ch => letterOf(ch) === letter).length;
  s.log.push({ k: 'letter', seat, letter, hits });
  if (hits === 0) return miss(s);
  s.scores[seat]! += hits;
  if (lettersLeft(s).length === 0) {
    s.scores[seat]! += LAST_LETTER_BONUS;
    endRound(s, seat);
  }
  // A right letter keeps the turn: the clock restarts.
  else s.turns++;
}

/** `waitedMs`: how long the current writer has been typing, as the host measures it. */
export function applyForca(s: ForcaState, seat: number, intent: ForcaIntent, waitedMs = 0): ApplyResult {
  if (seat < 0 || seat >= s.players.length) return fail('Not a player');
  if (s.winner !== null) return fail('The game is over');
  if (!intent || typeof intent !== 'object') return fail('Bad move');
  if (intent.type === 'next') {
    if (!s.roundOver) return fail('The round is still going');
    s.round++;
    s.guessed = [];
    s.wrongWords = [];
    s.misses = 0;
    s.roundOver = null;
    s.custom = null;
    if (s.mode === 'written') startWriting(s);
    // The next round starts with the player after the one who started this turn.
    else pass(s);
    return ok();
  }
  if (s.roundOver) return fail('The round is over');
  if (s.phase === 'write') {
    if (intent.type === 'skip') {
      if (seat !== s.writer && waitedMs < WRITE_SKIP_MS) return fail('The writer still has time');
      fallBack(s);
      return ok();
    }
    if (intent.type !== 'write') return fail('Wait for the word');
    if (seat !== s.writer) return fail('Not your turn');
    const word = cleanSecret(intent.word);
    if ('error' in word) return fail(word.error);
    const hint = cleanHint(intent.hint);
    if ('error' in hint) return fail(hint.error);
    s.custom = { word: word.word, category: hint.hint };
    s.phase = 'guess';
    s.log.push({ k: 'wrote', seat });
    pass(s);
    return ok();
  }
  if (intent.type === 'write' || intent.type === 'skip') return fail('The word is already chosen');
  if (seat === s.writer) return fail('You wrote this word');
  if (seat !== s.current) return fail('Not your turn');
  if (intent.type === 'letter') {
    const letter = typeof intent.letter === 'string' ? letterOf(intent.letter) : null;
    if (!letter) return fail('Pick a letter');
    if (s.guessed.includes(letter)) return fail('That letter was already tried');
    guessLetter(s, seat, letter);
    return ok();
  }
  if (intent.type === 'solve') {
    const word = typeof intent.word === 'string' ? normalizeWord(intent.word).slice(0, MAX_SECRET_LEN) : '';
    if (!word) return fail('Type the word');
    if (word === normalizeWord(secret(s))) {
      const points = lettersLeft(s).length * SOLVE_BONUS + LAST_LETTER_BONUS;
      s.scores[seat]! += points;
      s.guessed.push(...lettersLeft(s));
      s.log.push({ k: 'solve', seat, word: secret(s), right: true, points });
      endRound(s, seat);
    } else {
      s.wrongWords.push(word);
      s.log.push({ k: 'solve', seat, word, right: false, points: 0 });
      miss(s);
    }
    return ok();
  }
  return fail('Bad move');
}

export interface ForcaView {
  players: { id: string; name: string }[];
  me: number;
  mode: ForcaMode;
  phase: 'write' | 'guess';
  /** Written mode: who writes or wrote this round's word; null for a list word. */
  writer: number | null;
  /** Only in the writer's own view while the others guess. */
  secret?: string;
  /** While the writer types: how long until the others may swap in a list word. */
  skipInMs: number | null;
  /** The word with unguessed letters as null; spaces and hyphens shown. Whole word once the round ends. Empty while it is being written. */
  pattern: (string | null)[];
  /** The list category, or the writer's hint ('' when they gave none). */
  category: string;
  round: number;
  rounds: number;
  guessed: string[];
  /** Letters tried that are not in the word. */
  wrong: string[];
  /** Whole-word tries that missed. */
  wrongWords: string[];
  misses: number;
  current: number;
  scores: number[];
  roundOver: ForcaState['roundOver'];
  winner: number | null;
  log: ForcaLog[];
  logTotal: number;
}

export function forcaView(s: ForcaState, seat: number, skipInMs: number | null = null): ForcaView {
  const writing = s.phase === 'write';
  // Nothing about the word leaves the host while it is being written: not even the list word kept as a fallback.
  const word = writing ? '' : secret(s);
  const reveal = s.roundOver !== null;
  const letters = new Set([...word].map(letterOf));
  const view: ForcaView = {
    players: s.players.map(p => ({ id: p.id, name: p.name })),
    me: seat,
    mode: s.mode,
    phase: s.phase,
    writer: s.writer,
    skipInMs: writing ? skipInMs : null,
    pattern: [...word].map(ch => {
      const l = letterOf(ch);
      return l === null || reveal || s.guessed.includes(l) ? ch : null;
    }),
    category: writing ? '' : secretOf(s).category,
    round: s.round,
    rounds: s.words.length,
    guessed: s.guessed,
    wrong: s.guessed.filter(l => !letters.has(l)),
    wrongWords: s.wrongWords,
    misses: s.misses,
    current: s.current,
    scores: s.scores,
    roundOver: s.roundOver,
    winner: s.winner,
    log: s.log,
    logTotal: s.log.length,
  };
  if (!writing && s.writer === seat) view.secret = word;
  return view;
}

export class ForcaInstance implements GameInstance {
  private key = -1;
  private obj: object = {};
  private writeRound = -1;
  private writeStart = 0;

  constructor(readonly state: ForcaState, private readonly now: () => number = Date.now) {
    this.track();
  }

  private seat(id: string): number {
    return this.state.players.findIndex(p => p.id === id);
  }

  /** Notes when a writer starts typing, so the others can move on if the word never comes. */
  private track(): void {
    const s = this.state;
    if (s.phase !== 'write' || this.writeRound === s.round) return;
    this.writeRound = s.round;
    this.writeStart = this.now();
  }

  /** How long the current writer has had to type the word. */
  private waited(): number {
    return this.state.phase === 'write' && this.writeRound === this.state.round ? this.now() - this.writeStart : 0;
  }

  apply(playerId: string, intent: unknown): ApplyResult {
    const result = applyForca(this.state, this.seat(playerId), intent as ForcaIntent, this.waited());
    this.track();
    return result;
  }

  viewFor(playerId: string): ForcaView {
    const seat = this.seat(playerId);
    if (seat < 0) throw new Error(`Unknown player: ${playerId}`);
    return forcaView(this.state, seat, Math.max(0, WRITE_SKIP_MS - this.waited()));
  }

  clockInput(): ClockInput {
    const s = this.state;
    if (s.turns !== this.key) {
      this.key = s.turns;
      this.obj = {};
    }
    return { turn: this.obj, currentPlayer: s.current, pending: null, over: s.winner !== null || s.roundOver !== null };
  }

  get over(): boolean {
    return this.state.winner !== null;
  }

  /** Time ran out: the turn passes without a guess, or the silent writer's round gets a list word. */
  expire(_kind: ClockKind, _seed: number): void {
    const s = this.state;
    if (s.winner !== null || s.roundOver) return;
    if (s.phase === 'write') fallBack(s);
    else {
      s.log.push({ k: 'timeout', seat: s.current });
      pass(s);
    }
    this.track();
  }
}

export interface ForcaOptions {
  words: ForcaLang;
  mode: ForcaMode;
}

/** How many recently played list words this device remembers, per language, to keep them out of the next matches. */
const RECENT_MAX = 240;
const memory: Partial<Record<ForcaLang, string[]>> = {};

function loadRecent(lang: ForcaLang): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(`forca.recent.${lang}`) ?? '[]') as unknown;
    if (Array.isArray(raw)) return raw.filter((w): w is string => typeof w === 'string').slice(-RECENT_MAX);
  } catch {
    // No storage (private mode, tests): this page's memory is enough.
  }
  return memory[lang] ?? [];
}

function saveRecent(lang: ForcaLang, words: string[]): void {
  const recent = words.slice(-RECENT_MAX);
  memory[lang] = recent;
  try {
    localStorage.setItem(`forca.recent.${lang}`, JSON.stringify(recent));
  } catch {
    // Kept in memory only.
  }
}

export const forcaModule: GameModule<ForcaOptions> = {
  id: 'forca',
  minPlayers: 2,
  maxPlayers: 8,
  defaultOptions: () => ({ words: 'pt', mode: 'list' }),
  parseOptions(raw) {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return { words: o.words === 'en' ? 'en' : 'pt', mode: o.mode === 'written' ? 'written' : 'list' };
  },
  create(seats, options, seed) {
    const recent = loadRecent(options.words);
    const state = createForca(seats, seed, options.words, options.mode, new Set(recent));
    // The host's device remembers the list words of this match (in the written mode they are only fallbacks).
    if (options.mode === 'list') saveRecent(options.words, [...recent, ...state.words.map(w => w.word)]);
    return new ForcaInstance(state);
  },
};

export function asForcaView(v: unknown): ForcaView {
  return v as ForcaView;
}
