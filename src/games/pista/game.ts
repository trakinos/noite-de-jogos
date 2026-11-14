import { createRng, nextInt, shuffle, type RngState } from '../../engine/rng';
import type { ClockInput, ClockKind } from '../../net/turnClock';
import type { ApplyResult, GameInstance, GameModule, SeatInfo } from '../module';
import { WORDS_EN, WORDS_PT } from './words';

/**
 * Pista Certa: two teams, each with a chief who sees which of the 25 words are theirs.
 * The chief gives a one-word clue and a number; teammates guess words from it.
 */

export type Team = 'red' | 'blue';
export type CardKind = Team | 'neutral' | 'bomb';
export type Role = 'chief' | 'guess';
export type WordLang = 'pt' | 'en';

export const GRID = 25;
export const MAX_CLUE = 9;
export const MAX_CLUE_LENGTH = 24;

export interface Member {
  team: Team;
  role: Role;
}

export interface Clue {
  team: Team;
  word: string;
  count: number;
}

export type PistaLog =
  | { kind: 'clue'; seat: number; team: Team; word: string; count: number }
  | { kind: 'reveal'; seat: number | null; team: Team; word: string; card: CardKind }
  | { kind: 'pass'; seat: number | null; team: Team }
  | { kind: 'win'; team: Team; reason: PistaEnd };

export type PistaEnd = 'found' | 'bomb';

/** 'duel': two teams of players. 'solo': 2–3 players on one team against an automatic rival that finds one of its words each round. */
export type PistaMode = 'duel' | 'solo';
/** Fewer players than this play against the automatic rival. */
export const DUEL_MIN = 4;

export interface PistaState {
  mode: PistaMode;
  rng: RngState;
  players: SeatInfo[];
  members: Member[];
  phase: 'teams' | 'clue' | 'guess';
  words: string[];
  kinds: CardKind[];
  revealed: boolean[];
  /** The team that goes first; it has one more word to find. */
  first: Team;
  turn: Team;
  turnNumber: number;
  clue: Clue | null;
  /** Guesses left this turn; null is unlimited (a clue of 0). */
  guessesLeft: number | null;
  guessesMade: number;
  /** Which word each player is pointing at, shown to their team. */
  marks: (number | null)[];
  winner: Team | null;
  endReason: PistaEnd | null;
  log: PistaLog[];
}

export type PistaIntent =
  | { type: 'join'; team: Team; role: Role }
  | { type: 'begin' }
  | { type: 'clue'; word: string; count: number }
  | { type: 'mark'; card: number | null }
  | { type: 'reveal'; card: number }
  | { type: 'pass' };

export interface PistaView {
  mode: PistaMode;
  players: { id: string; name: string; team: Team; role: Role }[];
  me: number;
  phase: PistaState['phase'];
  words: string[];
  /** Card colors this player may see: everything for chiefs (and after the game), only revealed ones for guessers. */
  kinds: (CardKind | null)[];
  revealed: boolean[];
  first: Team;
  turn: Team;
  clue: Clue | null;
  guessesLeft: number | null;
  guessesMade: number;
  /** Marks from this player's own team. */
  marks: (number | null)[];
  left: Record<Team, number>;
  winner: Team | null;
  endReason: PistaEnd | null;
  /** Why the teams can't start yet, or null when they can. */
  notReady: string | null;
  log: PistaLog[];
}

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });
const otherTeam = (t: Team): Team => (t === 'red' ? 'blue' : 'red');

export function createPista(seats: SeatInfo[], seed: number, lang: WordLang): PistaState {
  const rng = createRng(seed);
  const mode: PistaMode = seats.length < DUEL_MIN ? 'solo' : 'duel';
  // Against the rival, the players' team always starts (and so has the nine words).
  const first: Team = mode === 'solo' || nextInt(rng, 2) === 0 ? 'red' : 'blue';
  const words = shuffle(rng, lang === 'en' ? WORDS_EN : WORDS_PT).slice(0, GRID);
  const kinds = shuffle<CardKind>(rng, [
    ...Array<CardKind>(9).fill(first),
    ...Array<CardKind>(8).fill(otherTeam(first)),
    ...Array<CardKind>(7).fill('neutral'),
    'bomb',
  ]);
  // Seats alternate teams; the first player seated on each team is its chief. Players can swap before starting.
  const members: Member[] =
    mode === 'solo'
      ? seats.map((_, i) => ({ team: 'red', role: i === 0 ? 'chief' : 'guess' }))
      : seats.map((_, i) => ({ team: i % 2 === 0 ? 'red' : 'blue', role: i < 2 ? 'chief' : 'guess' }));
  return {
    mode,
    rng,
    players: seats, members, phase: 'teams', words, kinds, revealed: Array(GRID).fill(false), first, turn: first, turnNumber: 0,
    clue: null, guessesLeft: null, guessesMade: 0, marks: seats.map(() => null), winner: null, endReason: null, log: [],
  };
}

export function teamsProblem(s: PistaState): string | null {
  for (const team of (s.mode === 'solo' ? ['red'] : ['red', 'blue']) as Team[]) {
    const on = s.members.filter(m => m.team === team);
    if (on.filter(m => m.role === 'chief').length !== 1) return 'Each team needs exactly one chief';
    if (on.length < 2) return 'Each team needs at least two players';
  }
  return null;
}

function left(s: PistaState, team: Team): number {
  return s.kinds.filter((k, i) => k === team && !s.revealed[i]).length;
}

function normalize(word: string): string {
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

function endTurn(s: PistaState): void {
  if (s.mode === 'solo') return rivalTurn(s);
  s.turn = otherTeam(s.turn);
  s.phase = 'clue';
  s.clue = null;
  s.guessesLeft = null;
  s.guessesMade = 0;
  s.marks = s.marks.map(() => null);
  s.turnNumber++;
}

/** Against the rival: it uncovers one of its own words, then the players' team goes again. */
function rivalTurn(s: PistaState): void {
  const left = s.kinds.map((k, i) => (k === 'blue' && !s.revealed[i] ? i : -1)).filter(i => i >= 0);
  if (left.length > 0) {
    const card = left[nextInt(s.rng, left.length)]!;
    s.revealed[card] = true;
    s.log.push({ kind: 'reveal', seat: null, team: 'blue', word: s.words[card]!, card: 'blue' });
    if (left.length === 1) return win(s, 'blue', 'found');
  }
  s.turn = 'red';
  s.phase = 'clue';
  s.clue = null;
  s.guessesLeft = null;
  s.guessesMade = 0;
  s.marks = s.marks.map(() => null);
  s.turnNumber++;
}

function win(s: PistaState, team: Team, reason: PistaEnd): void {
  s.winner = team;
  s.endReason = reason;
  s.log.push({ kind: 'win', team, reason });
}

export function reveal(s: PistaState, seat: number | null, card: number): void {
  const team = s.turn;
  s.revealed[card] = true;
  const kind = s.kinds[card]!;
  s.log.push({ kind: 'reveal', seat, team, word: s.words[card]!, card: kind });
  s.marks = s.marks.map(m => (m === card ? null : m));
  s.guessesMade++;
  if (kind === 'bomb') return win(s, otherTeam(team), 'bomb');
  for (const t of [team, otherTeam(team)]) if (left(s, t) === 0) return win(s, t, 'found');
  if (kind !== team) return endTurn(s);
  if (s.guessesLeft !== null) {
    s.guessesLeft--;
    if (s.guessesLeft === 0) endTurn(s);
  }
}

export function applyPista(s: PistaState, seat: number, intent: PistaIntent): ApplyResult {
  const me = s.members[seat];
  if (!me) return fail('Not a player');
  if (s.winner) return fail('The game is over');
  if (!intent || typeof intent !== 'object') return fail('Bad move');
  switch (intent.type) {
    case 'join': {
      if (s.phase !== 'teams') return fail('Teams are set');
      if ((intent.team !== 'red' && intent.team !== 'blue') || (intent.role !== 'chief' && intent.role !== 'guess')) return fail('Bad move');
      if (s.mode === 'solo' && intent.team !== 'red') return fail('Bad move');
      if (intent.role === 'chief') {
        // Taking the chief's seat moves the old chief to guessing.
        s.members.forEach((m, i) => {
          if (i !== seat && m.team === intent.team && m.role === 'chief') m.role = 'guess';
        });
      }
      s.members[seat] = { team: intent.team, role: intent.role };
      return ok();
    }
    case 'begin': {
      if (s.phase !== 'teams') return fail('Teams are set');
      const problem = teamsProblem(s);
      if (problem) return fail(problem);
      s.phase = 'clue';
      s.turnNumber = 1;
      return ok();
    }
    case 'clue': {
      if (s.phase !== 'clue') return fail('Not time for a clue');
      if (me.team !== s.turn || me.role !== 'chief') return fail('Only the chief gives the clue');
      const word = typeof intent.word === 'string' ? intent.word.trim() : '';
      if (!word || /\s/.test(word) || word.length > MAX_CLUE_LENGTH) return fail('The clue must be one word');
      const count = intent.count;
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > MAX_CLUE) return fail('Bad number');
      const clean = normalize(word);
      if (s.words.some((w, i) => !s.revealed[i] && normalize(w) === clean)) return fail('The clue cannot be a word on the table');
      s.clue = { team: s.turn, word, count };
      s.guessesLeft = count === 0 ? null : count + 1;
      s.guessesMade = 0;
      s.phase = 'guess';
      s.log.push({ kind: 'clue', seat, team: s.turn, word, count });
      return ok();
    }
    case 'mark': {
      if (s.phase !== 'guess' || me.team !== s.turn || me.role !== 'guess') return fail('Not your turn to guess');
      const card = intent.card;
      if (card !== null && !(typeof card === 'number' && Number.isInteger(card) && card >= 0 && card < GRID && !s.revealed[card])) return fail('Bad move');
      s.marks[seat] = s.marks[seat] === card ? null : card;
      return ok();
    }
    case 'reveal': {
      if (s.phase !== 'guess' || me.team !== s.turn || me.role !== 'guess') return fail('Not your turn to guess');
      const card = intent.card;
      if (!(typeof card === 'number' && Number.isInteger(card) && card >= 0 && card < GRID) || s.revealed[card]) return fail('Bad move');
      reveal(s, seat, card);
      return ok();
    }
    case 'pass': {
      if (s.phase !== 'guess' || me.team !== s.turn || me.role !== 'guess') return fail('Not your turn to guess');
      if (s.guessesMade === 0) return fail('Make at least one guess first');
      s.log.push({ kind: 'pass', seat, team: s.turn });
      endTurn(s);
      return ok();
    }
    default:
      return fail('Bad move');
  }
}

export function pistaView(s: PistaState, seat: number): PistaView {
  const me = s.members[seat]!;
  const seesAll = me.role === 'chief' || s.winner !== null;
  return {
    mode: s.mode,
    players: s.players.map((p, i) => ({ id: p.id, name: p.name, team: s.members[i]!.team, role: s.members[i]!.role })),
    me: seat,
    phase: s.phase,
    words: s.words,
    kinds: s.kinds.map((k, i) => (seesAll || s.revealed[i] ? k : null)),
    revealed: s.revealed,
    first: s.first,
    turn: s.turn,
    clue: s.clue,
    guessesLeft: s.guessesLeft,
    guessesMade: s.guessesMade,
    marks: s.marks.map((m, i) => (s.members[i]!.team === me.team ? m : null)),
    left: { red: left(s, 'red'), blue: left(s, 'blue') },
    winner: s.winner,
    endReason: s.endReason,
    notReady: s.phase === 'teams' ? teamsProblem(s) : null,
    log: s.log,
  };
}

export class PistaInstance implements GameInstance {
  private turnKey = '';
  private turnObj: object = {};
  constructor(readonly state: PistaState) {}

  private seat(playerId: string): number {
    return this.state.players.findIndex(p => p.id === playerId);
  }

  apply(playerId: string, intent: unknown): ApplyResult {
    return applyPista(this.state, this.seat(playerId), intent as PistaIntent);
  }

  viewFor(playerId: string): PistaView {
    const seat = this.seat(playerId);
    if (seat < 0) throw new Error(`Unknown player: ${playerId}`);
    return pistaView(this.state, seat);
  }

  /** The clue and the guesses each get a full clock; picking teams has none (reported as over, which only stops the clock). */
  clockInput(): ClockInput {
    const s = this.state;
    const key = `${s.turnNumber} ${s.phase}`;
    if (key !== this.turnKey) {
      this.turnKey = key;
      this.turnObj = {};
    }
    const team = s.members.map((m, i) => ({ ...m, i })).filter(m => m.team === s.turn);
    const actor = s.phase === 'clue' ? team.find(m => m.role === 'chief') : team.find(m => m.role === 'guess');
    return { turn: this.turnObj, currentPlayer: actor?.i ?? 0, pending: null, over: s.winner !== null || s.phase === 'teams' };
  }

  get over(): boolean {
    return this.state.winner !== null;
  }

  /** Time ran out: a chief without a clue loses the turn; guessers stop guessing. */
  expire(_kind: ClockKind, _seed: number): void {
    const s = this.state;
    if (s.winner || s.phase === 'teams') return;
    s.log.push({ kind: 'pass', seat: null, team: s.turn });
    endTurn(s);
  }
}

export interface PistaOptions {
  words: WordLang;
}

export const pistaModule: GameModule<PistaOptions> = {
  id: 'pista',
  minPlayers: 2,
  maxPlayers: 8,
  defaultOptions: () => ({ words: 'pt' }),
  parseOptions(raw) {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return { words: o.words === 'en' ? 'en' : 'pt' };
  },
  create: (seats, options, seed) => new PistaInstance(createPista(seats, seed, options.words)),
};

export function asPistaView(v: unknown): PistaView {
  return v as PistaView;
}
