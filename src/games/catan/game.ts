import { createRng, nextInt, shuffle, type RngState } from '../../engine/rng';
import type { ClockInput, ClockKind } from '../../net/turnClock';
import type { ApplyResult, GameInstance, GameModule, SeatInfo } from '../module';
import {
  EDGE_COUNT, EDGE_VERTS, RES, VERTEX_COUNT, VERTEX_EDGES, VERTEX_HEXES, VERTEX_NEIGHBORS, HEX_VERTS,
  randomBoard, type Hex, type Port, type PortKind, type Res,
} from './board';

/**
 * Settlers of Catan, base game, 3 or 4 players: setup in snake order, then turns of
 * roll → trade/build/play → end. First to 10 points on their own turn wins.
 */

export type Hand = Record<Res, number>;
export type DevCard = 'knight' | 'vp' | 'road' | 'plenty' | 'monopoly';
export type Phase = 'setup' | 'roll' | 'main' | 'discard' | 'robber' | 'steal' | 'over';

export const WIN_POINTS = 10;
export const COSTS: Record<'road' | 'settlement' | 'city' | 'dev', Partial<Hand>> = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city: { wheat: 2, ore: 3 },
  dev: { sheep: 1, wheat: 1, ore: 1 },
};
const PIECES = { road: 15, settlement: 5, city: 4 };
const BANK_EACH = 19;
const DEV_DECK: DevCard[] = [...Array<DevCard>(14).fill('knight'), ...Array<DevCard>(5).fill('vp'), 'road', 'road', 'plenty', 'plenty', 'monopoly', 'monopoly'];

export interface Building {
  seat: number;
  city: boolean;
}

export interface Trade {
  from: number;
  give: Hand;
  get: Hand;
  /** One answer per seat: null not yet, true accepts, false declines. */
  answers: (boolean | null)[];
}

export type CatanLog =
  | { k: 'roll'; seat: number; dice: [number, number] }
  | { k: 'build'; seat: number; what: 'road' | 'settlement' | 'city' }
  | { k: 'dev'; seat: number }
  | { k: 'play'; seat: number; card: DevCard; res?: Res }
  | { k: 'discard'; seat: number; n: number }
  | { k: 'robber'; seat: number }
  | { k: 'steal'; seat: number; from: number }
  | { k: 'bank'; seat: number; give: Res; get: Res; n: number }
  | { k: 'trade'; seat: number; with: number }
  | { k: 'longest'; seat: number | null }
  | { k: 'army'; seat: number }
  | { k: 'win'; seat: number };

export interface CatanState {
  players: SeatInfo[];
  rng: RngState;
  hexes: Hex[];
  ports: Port[];
  robber: number;
  verts: (Building | null)[];
  roads: number[];
  hands: Hand[];
  dev: DevCard[][];
  /** Cards bought this turn: they cannot be played until the next one. */
  devNew: DevCard[][];
  knights: number[];
  bank: Hand;
  deck: DevCard[];
  phase: Phase;
  current: number;
  /** Setup step 0 .. 2n-1 (snake order) and the corner whose road is due, if the settlement is down. */
  setupStep: number;
  setupCorner: number | null;
  dice: [number, number] | null;
  owe: number[];
  robberReturn: 'roll' | 'main';
  devPlayed: boolean;
  freeRoads: number;
  trade: Trade | null;
  longest: { holder: number | null; len: number };
  army: number | null;
  winner: number | null;
  log: CatanLog[];
}

export type CatanIntent =
  | { type: 'roll' }
  | { type: 'settlement'; vertex: number }
  | { type: 'road'; edge: number }
  | { type: 'city'; vertex: number }
  | { type: 'buyDev' }
  | { type: 'discard'; cards: Hand }
  | { type: 'robber'; hex: number }
  | { type: 'steal'; from: number }
  | { type: 'bank'; give: Res; get: Res }
  | { type: 'offer'; give: Hand; get: Hand }
  | { type: 'respond'; accept: boolean }
  | { type: 'confirm'; with: number }
  | { type: 'cancel' }
  | { type: 'knight' }
  | { type: 'roadBuilding' }
  | { type: 'plenty'; a: Res; b: Res }
  | { type: 'monopoly'; res: Res }
  | { type: 'end' };

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

export const emptyHand = (): Hand => ({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
export const total = (h: Hand): number => RES.reduce((n, r) => n + h[r], 0);
const has = (h: Hand, cost: Partial<Hand>): boolean => RES.every(r => h[r] >= (cost[r] ?? 0));
const pay = (h: Hand, cost: Partial<Hand>, bank: Hand): void => RES.forEach(r => { h[r] -= cost[r] ?? 0; bank[r] += cost[r] ?? 0; });

function parseHand(x: unknown): Hand | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const h = emptyHand();
  for (const r of RES) {
    const n = o[r] ?? 0;
    if (!Number.isInteger(n) || (n as number) < 0 || (n as number) > 19) return null;
    h[r] = n as number;
  }
  return h;
}

const isRes = (x: unknown): x is Res => RES.includes(x as Res);

export function createCatan(seats: SeatInfo[], seed: number): CatanState {
  const rng = createRng(seed);
  const board = randomBoard(rng);
  const bank = emptyHand();
  RES.forEach(r => (bank[r] = BANK_EACH));
  return {
    players: seats,
    rng,
    hexes: board.hexes,
    ports: board.ports,
    robber: board.robber,
    verts: Array(VERTEX_COUNT).fill(null),
    roads: Array(EDGE_COUNT).fill(-1),
    hands: seats.map(emptyHand),
    dev: seats.map(() => []),
    devNew: seats.map(() => []),
    knights: seats.map(() => 0),
    bank,
    deck: shuffle(rng, DEV_DECK),
    phase: 'setup',
    current: 0,
    setupStep: 0,
    setupCorner: null,
    dice: null,
    owe: seats.map(() => 0),
    robberReturn: 'main',
    devPlayed: false,
    freeRoads: 0,
    trade: null,
    longest: { holder: null, len: 0 },
    army: null,
    winner: null,
    log: [],
  };
}

// ---- geometry queries ----

function ownedCount(s: CatanState, seat: number, what: 'settlement' | 'city'): number {
  return s.verts.filter(b => b && b.seat === seat && b.city === (what === 'city')).length;
}

function roadCount(s: CatanState, seat: number): number {
  return s.roads.filter(r => r === seat).length;
}

export function legalSettlementSpots(s: CatanState, seat: number, connected: boolean): number[] {
  const out: number[] = [];
  for (let v = 0; v < VERTEX_COUNT; v++) {
    if (s.verts[v] || VERTEX_NEIGHBORS[v]!.some(n => s.verts[n])) continue;
    if (connected && !VERTEX_EDGES[v]!.some(e => s.roads[e] === seat)) continue;
    out.push(v);
  }
  return out;
}

/** An edge is open to `seat` if it is free and touches their building, or their road at a corner no rival holds. */
export function legalRoadSpots(s: CatanState, seat: number): number[] {
  const out: number[] = [];
  for (let e = 0; e < EDGE_COUNT; e++) {
    if (s.roads[e] !== -1) continue;
    const touches = EDGE_VERTS[e]!.some(v => {
      const b = s.verts[v];
      if (b) return b.seat === seat;
      return VERTEX_EDGES[v]!.some(o => o !== e && s.roads[o] === seat);
    });
    if (touches) out.push(e);
  }
  return out;
}

export function citySpots(s: CatanState, seat: number): number[] {
  const out: number[] = [];
  s.verts.forEach((b, v) => {
    if (b && b.seat === seat && !b.city) out.push(v);
  });
  return out;
}

/** Trade ratio for giving `res` to the bank: 2 with its own harbor, 3 with a general one, else 4. */
export function bankRatio(s: CatanState, seat: number, res: Res): number {
  let best = 4;
  for (const p of s.ports) {
    const mine = EDGE_VERTS[p.edge]!.some(v => s.verts[v]?.seat === seat);
    if (!mine) continue;
    if (p.kind === res) best = Math.min(best, 2);
    else if (p.kind === 'any') best = Math.min(best, 3);
  }
  return best;
}

export function portKindAt(s: CatanState, vertex: number): PortKind | null {
  for (const p of s.ports) if (EDGE_VERTS[p.edge]!.includes(vertex)) return p.kind;
  return null;
}

/** Longest chain of `seat`'s roads; a rival's building on a corner cuts the chain there. */
export function roadLength(s: CatanState, seat: number): number {
  let best = 0;
  const used = new Set<number>();
  const walk = (v: number, len: number): void => {
    best = Math.max(best, len);
    const b = s.verts[v];
    if (len > 0 && b && b.seat !== seat) return;
    for (const e of VERTEX_EDGES[v]!) {
      if (s.roads[e] !== seat || used.has(e)) continue;
      used.add(e);
      const [a, c] = EDGE_VERTS[e]!;
      walk(a === v ? c : a, len + 1);
      used.delete(e);
    }
  };
  for (let v = 0; v < VERTEX_COUNT; v++) if (VERTEX_EDGES[v]!.some(e => s.roads[e] === seat)) walk(v, 0);
  return best;
}

export function publicPoints(s: CatanState, seat: number): number {
  return ownedCount(s, seat, 'settlement') + 2 * ownedCount(s, seat, 'city') + (s.longest.holder === seat ? 2 : 0) + (s.army === seat ? 2 : 0);
}

export function totalPoints(s: CatanState, seat: number): number {
  return publicPoints(s, seat) + [...s.dev[seat]!, ...s.devNew[seat]!].filter(c => c === 'vp').length;
}

// ---- turn machinery ----

function updateLongest(s: CatanState): void {
  const lens = s.players.map((_, i) => roadLength(s, i));
  const max = Math.max(...lens);
  const before = s.longest.holder;
  let holder: number | null = before;
  if (max < 5) holder = null;
  else if (before === null || lens[before]! < max) {
    const leaders = lens.flatMap((l, i) => (l === max ? [i] : []));
    holder = leaders.length === 1 ? leaders[0]! : null;
  }
  s.longest = { holder, len: holder === null ? 0 : lens[holder]! };
  if (holder !== before) s.log.push({ k: 'longest', seat: holder });
}

function checkWin(s: CatanState): void {
  if (s.winner === null && s.phase !== 'setup' && totalPoints(s, s.current) >= WIN_POINTS) {
    s.winner = s.current;
    s.phase = 'over';
    s.log.push({ k: 'win', seat: s.current });
  }
}

function produce(s: CatanState, roll: number): void {
  const owed: Hand[] = s.players.map(emptyHand);
  s.hexes.forEach((h, i) => {
    if (h.num !== roll || i === s.robber) return;
    for (const v of HEX_VERTS[i]!) {
      const b = s.verts[v];
      if (b) owed[b.seat]![h.terrain as Res] += b.city ? 2 : 1;
    }
  });
  for (const r of RES) {
    const want = owed.reduce((n, o) => n + o[r], 0);
    if (want === 0) continue;
    if (want <= s.bank[r]) {
      owed.forEach((o, i) => { s.hands[i]![r] += o[r]; });
      s.bank[r] -= want;
      continue;
    }
    // The bank runs short: a lone receiver gets what is left, otherwise nobody gets any.
    const takers = owed.flatMap((o, i) => (o[r] > 0 ? [i] : []));
    if (takers.length === 1) {
      s.hands[takers[0]!]![r] += s.bank[r];
      s.bank[r] = 0;
    }
  }
}

function giveSetupResources(s: CatanState, vertex: number, seat: number): void {
  for (const h of VERTEX_HEXES[vertex]!) {
    const t = s.hexes[h]!.terrain;
    if (t !== 'desert' && s.bank[t] > 0) {
      s.hands[seat]![t]++;
      s.bank[t]--;
    }
  }
}

function setupSeat(s: CatanState): number {
  const n = s.players.length;
  return s.setupStep < n ? s.setupStep : 2 * n - 1 - s.setupStep;
}

function victims(s: CatanState, hex: number): number[] {
  const out = new Set<number>();
  for (const v of HEX_VERTS[hex]!) {
    const b = s.verts[v];
    if (b && b.seat !== s.current && total(s.hands[b.seat]!) > 0) out.add(b.seat);
  }
  return [...out];
}

function stealFrom(s: CatanState, from: number): void {
  const pool = RES.flatMap(r => Array<Res>(s.hands[from]![r]).fill(r));
  const card = pool[nextInt(s.rng, pool.length)]!;
  s.hands[from]![card]--;
  s.hands[s.current]![card]++;
  s.log.push({ k: 'steal', seat: s.current, from });
}

function afterRobber(s: CatanState): void {
  s.phase = s.robberReturn;
}

function startRobber(s: CatanState, back: 'roll' | 'main'): void {
  s.robberReturn = back;
  s.phase = 'robber';
}

function drawDev(s: CatanState): DevCard {
  return s.deck.pop()!;
}

// ---- apply ----

export function applyCatan(s: CatanState, seat: number, intent: CatanIntent): ApplyResult {
  if (seat < 0 || seat >= s.players.length) return fail('Not a player');
  if (s.phase === 'over') return fail('The game is over');
  if (!intent || typeof intent !== 'object' || typeof (intent as { type?: unknown }).type !== 'string') return fail('Bad move');
  const me = s.current === seat;
  const t = intent.type;

  // Answers that are not about whose turn it is.
  if (t === 'discard') return discard(s, seat, intent as Extract<CatanIntent, { type: 'discard' }>);
  if (t === 'respond') return respond(s, seat, intent as Extract<CatanIntent, { type: 'respond' }>);

  if (!me) return fail('Not your turn');

  switch (t) {
    case 'settlement': return placeSettlement(s, seat, (intent as { vertex: number }).vertex);
    case 'road': return placeRoad(s, seat, (intent as { edge: number }).edge);
    case 'city': return placeCity(s, seat, (intent as { vertex: number }).vertex);
    case 'roll': {
      if (s.phase !== 'roll') return fail('You already rolled');
      const dice: [number, number] = [1 + nextInt(s.rng, 6), 1 + nextInt(s.rng, 6)];
      s.dice = dice;
      s.log.push({ k: 'roll', seat, dice });
      const sum = dice[0] + dice[1];
      if (sum === 7) {
        s.owe = s.hands.map(h => (total(h) > 7 ? Math.floor(total(h) / 2) : 0));
        if (s.owe.some(n => n > 0)) {
          s.phase = 'discard';
          s.robberReturn = 'main';
        } else startRobber(s, 'main');
      } else {
        produce(s, sum);
        s.phase = 'main';
      }
      return ok();
    }
    case 'robber': {
      if (s.phase !== 'robber') return fail('Not now');
      const hex = (intent as { hex: number }).hex;
      if (!Number.isInteger(hex) || hex < 0 || hex >= s.hexes.length) return fail('Bad move');
      if (hex === s.robber) return fail('The robber must move');
      s.robber = hex;
      s.log.push({ k: 'robber', seat });
      const v = victims(s, hex);
      if (v.length === 0) afterRobber(s);
      else if (v.length === 1) {
        stealFrom(s, v[0]!);
        afterRobber(s);
      } else s.phase = 'steal';
      return ok();
    }
    case 'steal': {
      if (s.phase !== 'steal') return fail('Not now');
      const from = (intent as { from: number }).from;
      if (!victims(s, s.robber).includes(from)) return fail('Cannot steal from them');
      stealFrom(s, from);
      afterRobber(s);
      return ok();
    }
    case 'buyDev': {
      if (s.phase !== 'main') return fail('Not now');
      if (s.deck.length === 0) return fail('No cards left');
      if (!has(s.hands[seat]!, COSTS.dev)) return fail('Not enough resources');
      pay(s.hands[seat]!, COSTS.dev, s.bank);
      s.devNew[seat]!.push(drawDev(s));
      s.log.push({ k: 'dev', seat });
      checkWin(s);
      return ok();
    }
    case 'bank': {
      if (s.phase !== 'main') return fail('Not now');
      const { give, get } = intent as { give: unknown; get: unknown };
      if (!isRes(give) || !isRes(get) || give === get) return fail('Bad move');
      const n = bankRatio(s, seat, give);
      if (s.hands[seat]![give] < n) return fail('Not enough resources');
      if (s.bank[get] < 1) return fail('The bank is out of that');
      s.hands[seat]![give] -= n;
      s.bank[give] += n;
      s.hands[seat]![get]++;
      s.bank[get]--;
      s.log.push({ k: 'bank', seat, give, get, n });
      return ok();
    }
    case 'offer': return offer(s, seat, intent as Extract<CatanIntent, { type: 'offer' }>);
    case 'confirm': return confirm(s, seat, (intent as { with: number }).with);
    case 'cancel': {
      if (!s.trade) return fail('No offer');
      s.trade = null;
      return ok();
    }
    case 'knight': {
      if (!playable(s, seat, 'knight')) return fail('You cannot play that');
      useCard(s, seat, 'knight');
      s.knights[seat]!++;
      s.log.push({ k: 'play', seat, card: 'knight' });
      if (s.knights[seat]! >= 3 && (s.army === null || s.knights[seat]! > s.knights[s.army]!) && s.army !== seat) {
        s.army = seat;
        s.log.push({ k: 'army', seat });
      }
      startRobber(s, s.phase as 'roll' | 'main');
      checkWin(s);
      return ok();
    }
    case 'roadBuilding': {
      if (!playable(s, seat, 'road')) return fail('You cannot play that');
      useCard(s, seat, 'road');
      s.log.push({ k: 'play', seat, card: 'road' });
      s.freeRoads = Math.min(2, PIECES.road - roadCount(s, seat));
      if (legalRoadSpots(s, seat).length === 0) s.freeRoads = 0;
      return ok();
    }
    case 'plenty': {
      if (!playable(s, seat, 'plenty')) return fail('You cannot play that');
      const { a, b } = intent as { a: unknown; b: unknown };
      if (!isRes(a) || !isRes(b)) return fail('Bad move');
      const want = emptyHand();
      want[a]++;
      want[b]++;
      if (!has(s.bank, want)) return fail('The bank is out of that');
      useCard(s, seat, 'plenty');
      RES.forEach(r => { s.hands[seat]![r] += want[r]; s.bank[r] -= want[r]; });
      s.log.push({ k: 'play', seat, card: 'plenty' });
      return ok();
    }
    case 'monopoly': {
      if (!playable(s, seat, 'monopoly')) return fail('You cannot play that');
      const res = (intent as { res: unknown }).res;
      if (!isRes(res)) return fail('Bad move');
      useCard(s, seat, 'monopoly');
      s.hands.forEach((h, i) => {
        if (i === seat) return;
        s.hands[seat]![res] += h[res];
        h[res] = 0;
      });
      s.log.push({ k: 'play', seat, card: 'monopoly', res });
      return ok();
    }
    case 'end': {
      if (s.phase !== 'main') return fail('Not now');
      if (s.freeRoads > 0) return fail('Place your free roads first');
      s.trade = null;
      s.dev[seat]!.push(...s.devNew[seat]!);
      s.devNew[seat] = [];
      s.devPlayed = false;
      s.dice = null;
      s.current = (s.current + 1) % s.players.length;
      s.phase = 'roll';
      return ok();
    }
    default:
      return fail('Bad move');
  }
}

function playable(s: CatanState, seat: number, card: DevCard): boolean {
  return (s.phase === 'roll' || s.phase === 'main') && !s.devPlayed && s.freeRoads === 0 && s.dev[seat]!.includes(card);
}

function useCard(s: CatanState, seat: number, card: DevCard): void {
  const at = s.dev[seat]!.indexOf(card);
  s.dev[seat]!.splice(at, 1);
  s.devPlayed = true;
}

function placeSettlement(s: CatanState, seat: number, vertex: number): ApplyResult {
  if (!Number.isInteger(vertex) || vertex < 0 || vertex >= VERTEX_COUNT) return fail('Bad move');
  if (s.phase === 'setup') {
    if (s.setupCorner !== null) return fail('Place your road');
    if (!legalSettlementSpots(s, seat, false).includes(vertex)) return fail('You cannot build there');
    s.verts[vertex] = { seat, city: false };
    s.setupCorner = vertex;
    s.log.push({ k: 'build', seat, what: 'settlement' });
    if (s.setupStep >= s.players.length) giveSetupResources(s, vertex, seat);
    return ok();
  }
  if (s.phase !== 'main') return fail('Not now');
  if (ownedCount(s, seat, 'settlement') >= PIECES.settlement) return fail('No settlements left');
  if (!has(s.hands[seat]!, COSTS.settlement)) return fail('Not enough resources');
  if (!legalSettlementSpots(s, seat, true).includes(vertex)) return fail('You cannot build there');
  pay(s.hands[seat]!, COSTS.settlement, s.bank);
  s.verts[vertex] = { seat, city: false };
  s.log.push({ k: 'build', seat, what: 'settlement' });
  updateLongest(s);
  checkWin(s);
  return ok();
}

function placeRoad(s: CatanState, seat: number, edge: number): ApplyResult {
  if (!Number.isInteger(edge) || edge < 0 || edge >= EDGE_COUNT) return fail('Bad move');
  if (s.roads[edge] !== -1) return fail('You cannot build there');
  if (s.phase === 'setup') {
    if (s.setupCorner === null) return fail('Place a settlement first');
    if (!EDGE_VERTS[edge]!.includes(s.setupCorner)) return fail('You cannot build there');
    s.roads[edge] = seat;
    s.log.push({ k: 'build', seat, what: 'road' });
    s.setupCorner = null;
    s.setupStep++;
    if (s.setupStep >= 2 * s.players.length) {
      s.phase = 'roll';
      s.current = 0;
    } else s.current = setupSeat(s);
    return ok();
  }
  const free = s.freeRoads > 0;
  if (!(s.phase === 'main' || (free && s.phase === 'roll'))) return fail('Not now');
  if (roadCount(s, seat) >= PIECES.road) return fail('No roads left');
  if (!free && !has(s.hands[seat]!, COSTS.road)) return fail('Not enough resources');
  if (!legalRoadSpots(s, seat).includes(edge)) return fail('You cannot build there');
  if (free) {
    s.freeRoads--;
    s.roads[edge] = seat;
    if (legalRoadSpots(s, seat).length === 0 || roadCount(s, seat) >= PIECES.road) s.freeRoads = 0;
  } else {
    pay(s.hands[seat]!, COSTS.road, s.bank);
    s.roads[edge] = seat;
  }
  s.log.push({ k: 'build', seat, what: 'road' });
  updateLongest(s);
  checkWin(s);
  return ok();
}

function placeCity(s: CatanState, seat: number, vertex: number): ApplyResult {
  if (s.phase !== 'main') return fail('Not now');
  if (!Number.isInteger(vertex) || vertex < 0 || vertex >= VERTEX_COUNT) return fail('Bad move');
  if (ownedCount(s, seat, 'city') >= PIECES.city) return fail('No cities left');
  if (!citySpots(s, seat).includes(vertex)) return fail('You cannot build there');
  if (!has(s.hands[seat]!, COSTS.city)) return fail('Not enough resources');
  pay(s.hands[seat]!, COSTS.city, s.bank);
  s.verts[vertex] = { seat, city: true };
  s.log.push({ k: 'build', seat, what: 'city' });
  checkWin(s);
  return ok();
}

function discard(s: CatanState, seat: number, intent: Extract<CatanIntent, { type: 'discard' }>): ApplyResult {
  if (s.phase !== 'discard' || s.owe[seat]! <= 0) return fail('Not now');
  const cards = parseHand(intent.cards);
  if (!cards || total(cards) !== s.owe[seat] || !has(s.hands[seat]!, cards)) return fail('Bad discard');
  pay(s.hands[seat]!, cards, s.bank);
  s.log.push({ k: 'discard', seat, n: s.owe[seat]! });
  s.owe[seat] = 0;
  if (s.owe.every(n => n === 0)) startRobber(s, 'main');
  return ok();
}

function offer(s: CatanState, seat: number, intent: Extract<CatanIntent, { type: 'offer' }>): ApplyResult {
  if (s.phase !== 'main') return fail('Not now');
  const give = parseHand(intent.give);
  const get = parseHand(intent.get);
  if (!give || !get || total(give) === 0 || total(get) === 0) return fail('Bad offer');
  if (RES.some(r => give[r] > 0 && get[r] > 0)) return fail('Bad offer');
  if (!has(s.hands[seat]!, give)) return fail('Not enough resources');
  s.trade = { from: seat, give, get, answers: s.players.map(() => null) };
  return ok();
}

function respond(s: CatanState, seat: number, intent: Extract<CatanIntent, { type: 'respond' }>): ApplyResult {
  const tr = s.trade;
  if (!tr || tr.from === seat) return fail('No offer');
  if (typeof intent.accept !== 'boolean') return fail('Bad move');
  if (intent.accept && !has(s.hands[seat]!, tr.get)) return fail('Not enough resources');
  tr.answers[seat] = intent.accept;
  return ok();
}

function confirm(s: CatanState, seat: number, other: number): ApplyResult {
  const tr = s.trade;
  if (!tr || tr.from !== seat) return fail('No offer');
  if (!Number.isInteger(other) || other === seat || tr.answers[other] !== true) return fail('They have not accepted');
  if (!has(s.hands[seat]!, tr.give) || !has(s.hands[other]!, tr.get)) return fail('Not enough resources');
  RES.forEach(r => {
    s.hands[seat]![r] += tr.get[r] - tr.give[r];
    s.hands[other]![r] += tr.give[r] - tr.get[r];
  });
  s.log.push({ k: 'trade', seat, with: other });
  s.trade = null;
  return ok();
}

// ---- views ----

export interface CatanView {
  players: { id: string; name: string }[];
  me: number;
  hexes: Hex[];
  ports: Port[];
  robber: number;
  verts: (Building | null)[];
  roads: number[];
  /** My hand and cards; for others only the counts. */
  hand: Hand;
  dev: DevCard[];
  devNew: DevCard[];
  cards: number[];
  devCounts: number[];
  knights: number[];
  points: number[];
  roadLens: number[];
  bank: Hand;
  deckLeft: number;
  phase: Phase;
  current: number;
  setupCorner: number | null;
  dice: [number, number] | null;
  owe: number[];
  devPlayed: boolean;
  freeRoads: number;
  trade: Trade | null;
  longest: { holder: number | null; len: number };
  army: number | null;
  winner: number | null;
  ratios: Record<Res, number>;
  /** Where I may act now. */
  can: { settlement: number[]; road: number[]; city: number[]; robber: number[]; steal: number[] };
  log: CatanLog[];
}

export function catanView(s: CatanState, seat: number): CatanView {
  const mine = s.current === seat;
  const main = mine && s.phase === 'main';
  const none: number[] = [];
  const can: CatanView['can'] = { settlement: none, road: none, city: none, robber: none, steal: none };
  if (mine && s.phase === 'setup') {
    if (s.setupCorner === null) can.settlement = legalSettlementSpots(s, seat, false);
    else can.road = VERTEX_EDGES[s.setupCorner]!.filter(e => s.roads[e] === -1);
  } else if (mine && s.freeRoads > 0) can.road = legalRoadSpots(s, seat);
  else if (main) {
    if (has(s.hands[seat]!, COSTS.road) && roadCount(s, seat) < PIECES.road) can.road = legalRoadSpots(s, seat);
    if (has(s.hands[seat]!, COSTS.settlement) && ownedCount(s, seat, 'settlement') < PIECES.settlement) can.settlement = legalSettlementSpots(s, seat, true);
    if (has(s.hands[seat]!, COSTS.city) && ownedCount(s, seat, 'city') < PIECES.city) can.city = citySpots(s, seat);
  }
  if (mine && s.phase === 'robber') can.robber = s.hexes.map((_, i) => i).filter(i => i !== s.robber);
  if (mine && s.phase === 'steal') can.steal = victims(s, s.robber);
  const over = s.phase === 'over';
  return {
    players: s.players.map(p => ({ id: p.id, name: p.name })),
    me: seat,
    hexes: s.hexes,
    ports: s.ports,
    robber: s.robber,
    verts: structuredClone(s.verts),
    roads: s.roads.slice(),
    hand: { ...s.hands[seat]! },
    dev: s.dev[seat]!.slice(),
    devNew: s.devNew[seat]!.slice(),
    cards: s.hands.map(total),
    devCounts: s.players.map((_, i) => s.dev[i]!.length + s.devNew[i]!.length),
    knights: s.knights.slice(),
    points: s.players.map((_, i) => (i === seat || over ? totalPoints(s, i) : publicPoints(s, i))),
    roadLens: s.players.map((_, i) => roadLength(s, i)),
    bank: { ...s.bank },
    deckLeft: s.deck.length,
    phase: s.phase,
    current: s.current,
    setupCorner: s.setupCorner,
    dice: s.dice,
    owe: s.owe.slice(),
    devPlayed: s.devPlayed,
    freeRoads: s.freeRoads,
    trade: s.trade ? structuredClone(s.trade) : null,
    longest: { ...s.longest },
    army: s.army,
    winner: s.winner,
    ratios: Object.fromEntries(RES.map(r => [r, bankRatio(s, seat, r)])) as Record<Res, number>,
    can,
    log: s.log.slice(-120),
  };
}

export class CatanInstance implements GameInstance {
  private readonly obj = {};
  constructor(readonly state: CatanState) {}

  private seat(id: string): number {
    return this.state.players.findIndex(p => p.id === id);
  }

  apply(playerId: string, intent: unknown): ApplyResult {
    return applyCatan(this.state, this.seat(playerId), intent as CatanIntent);
  }

  viewFor(playerId: string): CatanView {
    const seat = this.seat(playerId);
    if (seat < 0) throw new Error(`Unknown player: ${playerId}`);
    return catanView(this.state, seat);
  }

  /** No turn clock yet: a stalled player stalls the table, and the host can end the game. */
  clockInput(): ClockInput {
    return { turn: this.obj, currentPlayer: this.state.current, pending: null, over: true };
  }

  get over(): boolean {
    return this.state.phase === 'over';
  }

  expire(_kind: ClockKind, _seed: number): void {}
}

export const catanModule: GameModule<Record<string, never>> = {
  id: 'catan',
  minPlayers: 3,
  maxPlayers: 4,
  defaultOptions: () => ({}),
  parseOptions: () => ({}),
  create: (seats, _o, seed) => new CatanInstance(createCatan(seats, seed)),
};

export function asCatanView(v: unknown): CatanView {
  return v as CatanView;
}
