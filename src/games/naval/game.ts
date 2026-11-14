import { createRng, nextFloat, nextInt, type RngState } from '../../engine/rng';
import type { ClockInput, ClockKind } from '../../net/turnClock';
import type { ApplyResult, GameInstance, GameModule, SeatInfo } from '../module';

/** Batalha Naval: each player hides a fleet on a 10×10 grid, then they take turns firing one shot at a time. */

export const SIZE = 10;
export const CELLS = SIZE * SIZE;

export type ShipId = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';
export const FLEET: readonly { id: ShipId; len: number }[] = [
  { id: 'carrier', len: 5 },
  { id: 'battleship', len: 4 },
  { id: 'cruiser', len: 3 },
  { id: 'submarine', len: 3 },
  { id: 'destroyer', len: 2 },
];

export type Dir = 'h' | 'v';
export interface Placement {
  id: ShipId;
  /** Top-left cell, row * SIZE + col. */
  at: number;
  dir: Dir;
}

export type ShotResult = 'miss' | 'hit' | 'sunk';
export interface Shot {
  cell: number;
  result: ShotResult;
  /** The ship sunk by this shot. */
  ship?: ShipId;
}

export interface NavalState {
  players: SeatInfo[];
  phase: 'placing' | 'battle';
  fleets: (Placement[] | null)[];
  /** Shots each seat has fired at the other. */
  shots: Shot[][];
  current: number;
  winner: number | null;
  rng: RngState;
}

export type NavalIntent = { type: 'place'; ships: Placement[] } | { type: 'unready' } | { type: 'fire'; cell: number };

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

export function shipCells(p: Placement): number[] {
  const len = FLEET.find(f => f.id === p.id)!.len;
  return Array.from({ length: len }, (_, i) => (p.dir === 'h' ? p.at + i : p.at + i * SIZE));
}

/** Whether a fleet has every ship exactly once, inside the grid, with no overlaps. Ships may touch. */
export function validFleet(raw: unknown): raw is Placement[] {
  if (!Array.isArray(raw) || raw.length !== FLEET.length) return false;
  const used = new Set<number>();
  const ids = new Set<string>();
  for (const p of raw as Placement[]) {
    if (!p || typeof p !== 'object' || !FLEET.some(f => f.id === p.id) || ids.has(p.id)) return false;
    if (p.dir !== 'h' && p.dir !== 'v') return false;
    if (!Number.isInteger(p.at) || p.at < 0 || p.at >= CELLS) return false;
    ids.add(p.id);
    const len = FLEET.find(f => f.id === p.id)!.len;
    const row = Math.floor(p.at / SIZE);
    const col = p.at % SIZE;
    if (p.dir === 'h' ? col + len > SIZE : row + len > SIZE) return false;
    for (const c of shipCells(p)) {
      if (used.has(c)) return false;
      used.add(c);
    }
  }
  return true;
}

/** A random legal fleet; `random` returns floats in [0, 1). */
export function randomFleet(random: () => number): Placement[] {
  for (;;) {
    const fleet: Placement[] = [];
    const used = new Set<number>();
    let stuck = false;
    for (const ship of FLEET) {
      let placed = false;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const dir: Dir = random() < 0.5 ? 'h' : 'v';
        const row = Math.floor(random() * (dir === 'v' ? SIZE - ship.len + 1 : SIZE));
        const col = Math.floor(random() * (dir === 'h' ? SIZE - ship.len + 1 : SIZE));
        const p: Placement = { id: ship.id, at: row * SIZE + col, dir };
        const cells = shipCells(p);
        if (cells.some(c => used.has(c))) continue;
        cells.forEach(c => used.add(c));
        fleet.push(p);
        placed = true;
      }
      if (!placed) stuck = true;
    }
    if (!stuck) return fleet;
  }
}

export function createNaval(seats: SeatInfo[], seed: number): NavalState {
  const rng = createRng(seed);
  return { players: seats, phase: 'placing', fleets: seats.map(() => null), shots: seats.map(() => []), current: nextInt(rng, 2), winner: null, rng };
}

function fire(s: NavalState, seat: number, cell: number): void {
  const target = 1 - seat;
  const fleet = s.fleets[target]!;
  const ship = fleet.find(p => shipCells(p).includes(cell));
  const shots = s.shots[seat]!;
  if (!ship) shots.push({ cell, result: 'miss' });
  else {
    const fired = new Set([...shots.map(x => x.cell), cell]);
    const sunk = shipCells(ship).every(c => fired.has(c));
    shots.push(sunk ? { cell, result: 'sunk', ship: ship.id } : { cell, result: 'hit' });
  }
  const hits = new Set(shots.filter(x => x.result !== 'miss').map(x => x.cell));
  if (fleet.every(p => shipCells(p).every(c => hits.has(c)))) s.winner = seat;
  else s.current = target;
}

export function applyNaval(s: NavalState, seat: number, intent: NavalIntent): ApplyResult {
  if (seat < 0 || seat > 1) return fail('Not a player');
  if (s.winner !== null) return fail('The game is over');
  if (!intent || typeof intent !== 'object') return fail('Bad move');
  switch (intent.type) {
    case 'place':
      if (s.phase !== 'placing') return fail('The battle has started');
      if (!validFleet(intent.ships)) return fail('Invalid fleet');
      s.fleets[seat] = intent.ships.map(p => ({ id: p.id, at: p.at, dir: p.dir }));
      if (s.fleets.every(f => f !== null)) s.phase = 'battle';
      return ok();
    case 'unready':
      if (s.phase !== 'placing') return fail('The battle has started');
      s.fleets[seat] = null;
      return ok();
    case 'fire': {
      if (s.phase !== 'battle') return fail('The battle has not started');
      if (seat !== s.current) return fail('Not your turn');
      const cell = intent.cell;
      if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) return fail('Bad move');
      if (s.shots[seat]!.some(x => x.cell === cell)) return fail('You already fired there');
      fire(s, seat, cell);
      return ok();
    }
    default:
      return fail('Bad move');
  }
}

export interface NavalView {
  players: { id: string; name: string; ready: boolean }[];
  me: number;
  phase: NavalState['phase'];
  current: number;
  /** My fleet, or null while I haven't placed it. */
  myFleet: Placement[] | null;
  /** Shots I fired at the opponent. */
  myShots: Shot[];
  /** Shots the opponent fired at me. */
  theirShots: Shot[];
  /** The opponent's sunk ships (all of them once the game is over). */
  theirShips: Placement[];
  winner: number | null;
  log: unknown[];
}

export function navalView(s: NavalState, seat: number): NavalView {
  const other = 1 - seat;
  const sunk = new Set(s.shots[seat]!.filter(x => x.result === 'sunk').map(x => x.ship));
  const theirFleet = s.fleets[other] ?? [];
  return {
    players: s.players.map((p, i) => ({ id: p.id, name: p.name, ready: s.fleets[i] !== null })),
    me: seat,
    phase: s.phase,
    current: s.current,
    myFleet: s.fleets[seat],
    myShots: s.shots[seat]!,
    theirShots: s.shots[other]!,
    theirShips: s.phase === 'placing' ? [] : theirFleet.filter(p => s.winner !== null || sunk.has(p.id)),
    winner: s.winner,
    log: [],
  };
}

export class NavalInstance implements GameInstance {
  private turnKey = -1;
  private turnObj: object = {};
  constructor(readonly state: NavalState) {}

  private seat(playerId: string): number {
    return this.state.players.findIndex(p => p.id === playerId);
  }

  apply(playerId: string, intent: unknown): ApplyResult {
    return applyNaval(this.state, this.seat(playerId), intent as NavalIntent);
  }

  viewFor(playerId: string): NavalView {
    const seat = this.seat(playerId);
    if (seat < 0) throw new Error(`Unknown player: ${playerId}`);
    return navalView(this.state, seat);
  }

  /** One turn per shot. Placing the fleets has no clock (reported as over, which only stops the clock). */
  clockInput(): ClockInput {
    const s = this.state;
    const shots = s.shots[0]!.length + s.shots[1]!.length;
    if (shots !== this.turnKey) {
      this.turnKey = shots;
      this.turnObj = {};
    }
    return { turn: this.turnObj, currentPlayer: s.current, pending: null, over: s.winner !== null || s.phase === 'placing' };
  }

  get over(): boolean {
    return this.state.winner !== null;
  }

  /** Time ran out: a shot at a random cell not yet fired at. */
  expire(_kind: ClockKind, _seed: number): void {
    const s = this.state;
    if (s.winner !== null || s.phase !== 'battle') return;
    const fired = new Set(s.shots[s.current]!.map(x => x.cell));
    const open = Array.from({ length: CELLS }, (_, i) => i).filter(i => !fired.has(i));
    fire(s, s.current, open[Math.floor(nextFloat(s.rng) * open.length)]!);
  }
}

export type NavalOptions = Record<string, never>;

export const navalModule: GameModule<NavalOptions> = {
  id: 'naval',
  minPlayers: 2,
  maxPlayers: 2,
  defaultOptions: () => ({}),
  parseOptions: () => ({}),
  create: (seats, _options, seed) => new NavalInstance(createNaval(seats, seed)),
};

export function asNavalView(v: unknown): NavalView {
  return v as NavalView;
}
