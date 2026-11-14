import { createRng, nextInt } from '../../engine/rng';
import type { ClockInput, ClockKind } from '../../net/turnClock';
import type { ApplyResult, GameInstance, GameModule, SeatInfo } from '../module';

/** Jogo da Velha: a match of rounds on a 3×3 grid, first to WINS_NEEDED round wins. The starter alternates each round. */

export const WINS_NEEDED = 3;
export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6],
];

export interface VelhaState {
  players: SeatInfo[];
  /** Seat of each mark, or null. Seat 0 plays X in round 1. */
  cells: (number | null)[];
  current: number;
  /** Who started this round. */
  starter: number;
  round: number;
  score: [number, number];
  draws: number;
  /** How the round ended: the winner and their line, or a draw. Null while playing. */
  roundEnd: { winner: number | null; line: number[] | null } | null;
  winner: number | null;
  moves: number;
}

export type VelhaIntent = { type: 'mark'; cell: number } | { type: 'next' };

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

export function createVelha(seats: SeatInfo[], seed: number): VelhaState {
  const starter = nextInt(createRng(seed), 2);
  return { players: seats, cells: Array(9).fill(null), current: starter, starter, round: 1, score: [0, 0], draws: 0, roundEnd: null, winner: null, moves: 0 };
}

export function lineOf(cells: (number | null)[]): { seat: number; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const v = cells[a];
    if (v !== null && v !== undefined && v === cells[b] && v === cells[c]) return { seat: v, line: [...line] };
  }
  return null;
}

export function applyVelha(s: VelhaState, seat: number, intent: VelhaIntent): ApplyResult {
  if (seat < 0 || seat > 1) return fail('Not a player');
  if (s.winner !== null) return fail('The game is over');
  if (!intent || typeof intent !== 'object') return fail('Bad move');
  if (intent.type === 'next') {
    if (!s.roundEnd) return fail('The round is still going');
    s.cells = Array(9).fill(null);
    s.starter = 1 - s.starter;
    s.current = s.starter;
    s.round++;
    s.roundEnd = null;
    return ok();
  }
  if (intent.type !== 'mark') return fail('Bad move');
  if (s.roundEnd) return fail('The round is over');
  if (seat !== s.current) return fail('Not your turn');
  const cell = intent.cell;
  if (!Number.isInteger(cell) || cell < 0 || cell > 8 || s.cells[cell] !== null) return fail('That square is taken');
  mark(s, cell);
  return ok();
}

function mark(s: VelhaState, cell: number): void {
  s.cells[cell] = s.current;
  s.moves++;
  const won = lineOf(s.cells);
  if (won) {
    s.score[won.seat]++;
    s.roundEnd = { winner: won.seat, line: won.line };
    if (s.score[won.seat] >= WINS_NEEDED) s.winner = won.seat;
  } else if (s.cells.every(c => c !== null)) {
    s.draws++;
    s.roundEnd = { winner: null, line: null };
  } else s.current = 1 - s.current;
}

export interface VelhaView extends Omit<VelhaState, 'players'> {
  players: { id: string; name: string }[];
  me: number;
  /** Seat 0 is X in odd rounds; the symbols swap with the starter so the starter is always X. */
  symbols: ['X' | 'O', 'X' | 'O'];
  log: unknown[];
}

export function velhaView(s: VelhaState, seat: number): VelhaView {
  const { players, ...rest } = s;
  const symbols: ['X' | 'O', 'X' | 'O'] = s.starter === 0 ? ['X', 'O'] : ['O', 'X'];
  return { ...structuredClone(rest), players: players.map(p => ({ id: p.id, name: p.name })), me: seat, symbols, log: [] };
}

export class VelhaInstance implements GameInstance {
  private key = '';
  private obj: object = {};
  constructor(readonly state: VelhaState) {}

  private seat(id: string): number {
    return this.state.players.findIndex(p => p.id === id);
  }

  apply(playerId: string, intent: unknown): ApplyResult {
    return applyVelha(this.state, this.seat(playerId), intent as VelhaIntent);
  }

  viewFor(playerId: string): VelhaView {
    const seat = this.seat(playerId);
    if (seat < 0) throw new Error(`Unknown player: ${playerId}`);
    return velhaView(this.state, seat);
  }

  /** One turn per mark; the pause between rounds has no clock. */
  clockInput(): ClockInput {
    const s = this.state;
    const key = `${s.round} ${s.moves}`;
    if (key !== this.key) {
      this.key = key;
      this.obj = {};
    }
    return { turn: this.obj, currentPlayer: s.current, pending: null, over: s.winner !== null || s.roundEnd !== null };
  }

  get over(): boolean {
    return this.state.winner !== null;
  }

  /** Time ran out: a mark on a random free square. */
  expire(_kind: ClockKind, seed: number): void {
    const s = this.state;
    if (s.winner !== null || s.roundEnd) return;
    const free = s.cells.map((c, i) => (c === null ? i : -1)).filter(i => i >= 0);
    mark(s, free[nextInt(createRng(seed), free.length)]!);
  }
}

export const velhaModule: GameModule<Record<string, never>> = {
  id: 'velha',
  minPlayers: 2,
  maxPlayers: 2,
  defaultOptions: () => ({}),
  parseOptions: () => ({}),
  create: (seats, _o, seed) => new VelhaInstance(createVelha(seats, seed)),
};

export function asVelhaView(v: unknown): VelhaView {
  return v as VelhaView;
}
