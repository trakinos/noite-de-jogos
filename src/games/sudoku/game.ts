import { createRng, shuffle, type RngState } from '../../engine/rng';
import type { ClockInput, ClockKind } from '../../net/turnClock';
import type { ApplyResult, GameInstance, GameModule, SeatInfo } from '../module';

/**
 * Sudoku. One seeded puzzle with a unique solution, played in one of three modes:
 *  - coop: everyone fills the same grid; it is done when the grid is full.
 *  - race: everyone gets the same puzzle on their own grid; the first to finish wins.
 *  - solo: everyone works the same puzzle on their own grid, with no winner (one player is plain solo).
 * A wrong digit is refused and counted as a mistake, so a grid is never wrong, only incomplete.
 */

export type SudokuMode = 'coop' | 'race' | 'solo';
export type SudokuLevel = 'easy' | 'medium' | 'hard';

/** How many cells are given. */
export const CLUES: Record<SudokuLevel, number> = { easy: 40, medium: 32, hard: 26 };

export interface SudokuOptions {
  mode: SudokuMode;
  level: SudokuLevel;
}

export interface SudokuState {
  players: SeatInfo[];
  mode: SudokuMode;
  level: SudokuLevel;
  /** The given digits (0 = empty). */
  givens: number[];
  solution: number[];
  /** Coop has one grid, otherwise one per seat. Digits include the givens (0 = empty). */
  grids: number[][];
  /** Coop only: who placed each digit, -1 for givens and empty cells. */
  placedBy: number[];
  mistakes: number[];
  /** Seats in the order they finished (race and solo). In coop it stays empty. */
  finished: number[];
  /** Milliseconds from the start to each seat's finish, or null. */
  finishMs: (number | null)[];
  startedAt: number;
  winner: number | null;
  done: boolean;
  /** Milliseconds from the start to the end, once done. */
  endMs: number | null;
}

export type SudokuIntent = { type: 'set'; cell: number; value: number };

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

// ---- generator ----

function candidates(grid: number[], i: number): number[] {
  const r = Math.floor(i / 9);
  const c = i % 9;
  const used = new Set<number>();
  for (let k = 0; k < 9; k++) {
    used.add(grid[r * 9 + k]!);
    used.add(grid[k * 9 + c]!);
  }
  const br = r - (r % 3);
  const bc = c - (c % 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) used.add(grid[(br + y) * 9 + bc + x]!);
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (!used.has(d)) out.push(d);
  return out;
}

/** Counts solutions of `grid`, stopping at `limit`. Fills the most constrained cell first. */
export function countSolutions(grid: number[], limit = 2): number {
  const g = grid.slice();
  let count = 0;
  const walk = (): void => {
    if (count >= limit) return;
    let best = -1;
    let bestOpts: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue;
      const opts = candidates(g, i);
      if (best < 0 || opts.length < bestOpts.length) {
        best = i;
        bestOpts = opts;
        if (opts.length <= 1) break;
      }
    }
    if (best < 0) {
      count++;
      return;
    }
    for (const d of bestOpts) {
      g[best] = d;
      walk();
      if (count >= limit) break;
    }
    g[best] = 0;
  };
  walk();
  return count;
}

function fullGrid(rng: RngState): number[] {
  const g: number[] = Array(81).fill(0);
  const fill = (i: number): boolean => {
    if (i === 81) return true;
    for (const d of shuffle(rng, candidates(g, i))) {
      g[i] = d;
      if (fill(i + 1)) return true;
    }
    g[i] = 0;
    return false;
  };
  fill(0);
  return g;
}

/** A puzzle with exactly one solution and about `CLUES[level]` givens, and that solution. */
export function makePuzzle(seed: number, level: SudokuLevel): { givens: number[]; solution: number[] } {
  const rng = createRng(seed);
  const solution = fullGrid(rng);
  const givens = solution.slice();
  let left = 81;
  for (const i of shuffle(rng, [...Array(81).keys()])) {
    if (left <= CLUES[level]) break;
    const keep = givens[i]!;
    givens[i] = 0;
    if (countSolutions(givens) === 1) left--;
    else givens[i] = keep;
  }
  return { givens, solution };
}

// ---- rules ----

export function createSudoku(seats: SeatInfo[], seed: number, options: SudokuOptions, now = Date.now()): SudokuState {
  const { givens, solution } = makePuzzle(seed, options.level);
  const shared = options.mode === 'coop';
  return {
    players: seats,
    mode: options.mode,
    level: options.level,
    givens,
    solution,
    grids: (shared ? [0] : seats.map((_, i) => i)).map(() => givens.slice()),
    placedBy: Array(81).fill(-1),
    mistakes: seats.map(() => 0),
    finished: [],
    finishMs: seats.map(() => null),
    startedAt: now,
    winner: null,
    done: false,
    endMs: null,
  };
}

function gridOf(s: SudokuState, seat: number): number[] {
  return s.grids[s.mode === 'coop' ? 0 : seat]!;
}

export function filledCount(grid: number[]): number {
  return grid.filter(v => v !== 0).length;
}

export function applySudoku(s: SudokuState, seat: number, intent: SudokuIntent, now = Date.now()): ApplyResult {
  if (seat < 0 || seat >= s.players.length) return fail('Not a player');
  if (s.done) return fail('The game is over');
  if (!intent || typeof intent !== 'object' || intent.type !== 'set') return fail('Bad move');
  const { cell, value } = intent;
  if (!Number.isInteger(cell) || cell < 0 || cell > 80) return fail('Bad move');
  if (!Number.isInteger(value) || value < 1 || value > 9) return fail('Bad move');
  if (s.finished.includes(seat)) return fail('You already finished');
  const grid = gridOf(s, seat);
  if (s.givens[cell] !== 0) return fail('That square is given');
  if (grid[cell] !== 0) return fail('That square is filled');
  if (s.solution[cell] !== value) {
    s.mistakes[seat]!++;
    return fail('Wrong digit');
  }
  grid[cell] = value;
  if (s.mode === 'coop') s.placedBy[cell] = seat;
  if (filledCount(grid) < 81) return ok();
  if (s.mode === 'coop') {
    s.done = true;
    s.endMs = now - s.startedAt;
    return ok();
  }
  s.finished.push(seat);
  s.finishMs[seat] = now - s.startedAt;
  if (s.mode === 'race') {
    s.winner = seat;
    s.done = true;
  } else if (s.finished.length === s.players.length) s.done = true;
  if (s.done) s.endMs = now - s.startedAt;
  return ok();
}

// ---- views ----

export interface SudokuView {
  players: { id: string; name: string }[];
  me: number;
  mode: SudokuMode;
  level: SudokuLevel;
  givens: number[];
  /** My grid (the shared one in coop). */
  grid: number[];
  /** Coop: who placed each digit. */
  placedBy: number[];
  mistakes: number[];
  /** Cells filled per seat, so others' progress is visible without their digits. */
  filled: number[];
  finished: number[];
  finishMs: (number | null)[];
  /** Milliseconds elapsed when this view was made; guests count on from there. */
  elapsedMs: number;
  winner: number | null;
  done: boolean;
  log: unknown[];
}

export function sudokuView(s: SudokuState, seat: number, now = Date.now()): SudokuView {
  const grid = gridOf(s, seat);
  return {
    players: s.players.map(p => ({ id: p.id, name: p.name })),
    me: seat,
    mode: s.mode,
    level: s.level,
    givens: s.givens.slice(),
    grid: grid.slice(),
    placedBy: s.mode === 'coop' ? s.placedBy.slice() : [],
    mistakes: s.mistakes.slice(),
    filled: s.players.map((_, i) => filledCount(gridOf(s, i))),
    finished: s.finished.slice(),
    finishMs: s.finishMs.slice(),
    elapsedMs: s.endMs ?? Math.max(0, now - s.startedAt),
    winner: s.winner,
    done: s.done,
    log: [],
  };
}

export class SudokuInstance implements GameInstance {
  private readonly obj = {};
  constructor(readonly state: SudokuState) {}

  private seat(id: string): number {
    return this.state.players.findIndex(p => p.id === id);
  }

  apply(playerId: string, intent: unknown): ApplyResult {
    return applySudoku(this.state, this.seat(playerId), intent as SudokuIntent);
  }

  viewFor(playerId: string): SudokuView {
    const seat = this.seat(playerId);
    if (seat < 0) throw new Error(`Unknown player: ${playerId}`);
    return sudokuView(this.state, seat);
  }

  /** Nobody waits for anybody: no turn clock. */
  clockInput(): ClockInput {
    return { turn: this.obj, currentPlayer: 0, pending: null, over: true };
  }

  get over(): boolean {
    return this.state.done;
  }

  expire(_kind: ClockKind, _seed: number): void {}
}

export const sudokuModule: GameModule<SudokuOptions> = {
  id: 'sudoku',
  minPlayers: 1,
  maxPlayers: 8,
  defaultOptions: () => ({ mode: 'coop', level: 'medium' }),
  parseOptions(raw) {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
      mode: o.mode === 'race' || o.mode === 'solo' ? o.mode : 'coop',
      level: o.level === 'easy' || o.level === 'hard' ? o.level : 'medium',
    };
  },
  create: (seats, options, seed) => new SudokuInstance(createSudoku(seats, seed, options)),
};

export function asSudokuView(v: unknown): SudokuView {
  return v as SudokuView;
}
