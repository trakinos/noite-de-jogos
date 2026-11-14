import { createRng, nextInt, shuffle, type RngState } from '../../engine/rng';
import type { ClockInput, ClockKind } from '../../net/turnClock';
import type { ApplyResult, GameInstance, GameModule, SeatInfo } from '../module';
import { FORCA_EN, FORCA_PT } from './words';

/**
 * Forca: a few rounds, each with a secret word and its category. Players take turns guessing a letter:
 * each copy of a right letter scores a point and the player goes again; a wrong letter hangs another piece and passes the turn.
 * A player can try the whole word instead: right ends the round with a bonus for every letter still hidden, wrong hangs a piece.
 */

export const MAX_MISSES = 6;
export const ROUNDS = 5;
export const SOLVE_BONUS = 2;
export const LAST_LETTER_BONUS = 3;
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export type ForcaLang = 'pt' | 'en';

export type ForcaLog =
  | { k: 'letter'; seat: number; letter: string; hits: number }
  | { k: 'solve'; seat: number; word: string; right: boolean; points: number }
  | { k: 'timeout'; seat: number }
  | { k: 'round'; word: string; winner: number | null };

export interface ForcaState {
  rng: RngState;
  players: SeatInfo[];
  words: { word: string; category: string }[];
  round: number;
  guessed: string[];
  misses: number;
  current: number;
  scores: number[];
  /** Set when the round ends, until someone starts the next one. */
  roundOver: { word: string; solvedBy: number | null } | null;
  winner: number | null;
  log: ForcaLog[];
  turns: number;
}

export type ForcaIntent = { type: 'letter'; letter: string } | { type: 'solve'; word: string } | { type: 'next' };

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

export function createForca(seats: SeatInfo[], seed: number, lang: ForcaLang): ForcaState {
  const rng = createRng(seed);
  const bank = lang === 'en' ? FORCA_EN : FORCA_PT;
  const all = Object.entries(bank).flatMap(([category, words]) => words.map(word => ({ word, category })));
  const words = shuffle(rng, all).slice(0, ROUNDS);
  return {
    rng, players: seats, words, round: 0, guessed: [], misses: 0, current: nextInt(rng, seats.length), scores: seats.map(() => 0),
    roundOver: null, winner: null, log: [], turns: 0,
  };
}

function secret(s: ForcaState): string {
  return s.words[s.round]!.word;
}

function lettersLeft(s: ForcaState): string[] {
  return [...new Set([...secret(s)].map(letterOf).filter((l): l is string => l !== null && !s.guessed.includes(l)))];
}

function pass(s: ForcaState): void {
  s.current = (s.current + 1) % s.players.length;
  s.turns++;
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
  if (s.misses >= MAX_MISSES) endRound(s, null);
  else pass(s);
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

export function applyForca(s: ForcaState, seat: number, intent: ForcaIntent): ApplyResult {
  if (seat < 0 || seat >= s.players.length) return fail('Not a player');
  if (s.winner !== null) return fail('The game is over');
  if (!intent || typeof intent !== 'object') return fail('Bad move');
  if (intent.type === 'next') {
    if (!s.roundOver) return fail('The round is still going');
    s.round++;
    s.guessed = [];
    s.misses = 0;
    s.roundOver = null;
    // The next round starts with the player after the one who started this turn.
    pass(s);
    return ok();
  }
  if (s.roundOver) return fail('The round is over');
  if (seat !== s.current) return fail('Not your turn');
  if (intent.type === 'letter') {
    const letter = typeof intent.letter === 'string' ? letterOf(intent.letter) : null;
    if (!letter) return fail('Pick a letter');
    if (s.guessed.includes(letter)) return fail('That letter was already tried');
    guessLetter(s, seat, letter);
    return ok();
  }
  if (intent.type === 'solve') {
    const word = typeof intent.word === 'string' ? normalizeWord(intent.word) : '';
    if (!word) return fail('Type the word');
    if (word === normalizeWord(secret(s))) {
      const points = lettersLeft(s).length * SOLVE_BONUS + LAST_LETTER_BONUS;
      s.scores[seat]! += points;
      s.guessed.push(...lettersLeft(s));
      s.log.push({ k: 'solve', seat, word: secret(s), right: true, points });
      endRound(s, seat);
    } else {
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
  /** The word with unguessed letters as null; spaces and hyphens shown. Whole word once the round ends. */
  pattern: (string | null)[];
  category: string;
  round: number;
  rounds: number;
  guessed: string[];
  /** Letters tried that are not in the word. */
  wrong: string[];
  misses: number;
  current: number;
  scores: number[];
  roundOver: ForcaState['roundOver'];
  winner: number | null;
  log: ForcaLog[];
  logTotal: number;
}

export function forcaView(s: ForcaState, seat: number): ForcaView {
  const word = secret(s);
  const reveal = s.roundOver !== null;
  const letters = new Set([...word].map(letterOf));
  return {
    players: s.players.map(p => ({ id: p.id, name: p.name })),
    me: seat,
    pattern: [...word].map(ch => {
      const l = letterOf(ch);
      return l === null || reveal || s.guessed.includes(l) ? ch : null;
    }),
    category: s.words[s.round]!.category,
    round: s.round,
    rounds: s.words.length,
    guessed: s.guessed,
    wrong: s.guessed.filter(l => !letters.has(l)),
    misses: s.misses,
    current: s.current,
    scores: s.scores,
    roundOver: s.roundOver,
    winner: s.winner,
    log: s.log,
    logTotal: s.log.length,
  };
}

export class ForcaInstance implements GameInstance {
  private key = -1;
  private obj: object = {};
  constructor(readonly state: ForcaState) {}

  private seat(id: string): number {
    return this.state.players.findIndex(p => p.id === id);
  }

  apply(playerId: string, intent: unknown): ApplyResult {
    return applyForca(this.state, this.seat(playerId), intent as ForcaIntent);
  }

  viewFor(playerId: string): ForcaView {
    const seat = this.seat(playerId);
    if (seat < 0) throw new Error(`Unknown player: ${playerId}`);
    return forcaView(this.state, seat);
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

  /** Time ran out: the turn passes without a guess. */
  expire(_kind: ClockKind, _seed: number): void {
    const s = this.state;
    if (s.winner !== null || s.roundOver) return;
    s.log.push({ k: 'timeout', seat: s.current });
    pass(s);
  }
}

export interface ForcaOptions {
  words: ForcaLang;
}

export const forcaModule: GameModule<ForcaOptions> = {
  id: 'forca',
  minPlayers: 2,
  maxPlayers: 8,
  defaultOptions: () => ({ words: 'pt' }),
  parseOptions(raw) {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return { words: o.words === 'en' ? 'en' : 'pt' };
  },
  create: (seats, options, seed) => new ForcaInstance(createForca(seats, seed, options.words)),
};

export function asForcaView(v: unknown): ForcaView {
  return v as ForcaView;
}
