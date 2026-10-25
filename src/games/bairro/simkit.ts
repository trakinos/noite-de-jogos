// Seeded bot games and fuzzing for tests only. Not imported by production code.
import { createRng, nextFloat, nextInt, type RngState } from '../../engine/rng';
import { ruaPositions } from './assets';
import { BOARD, RUAS } from './board';
import type { RuaId } from './board';
import { botMove } from './bot';
import { DECK } from './deck';
import { apply } from './engine';
import { createBairro } from './setup';
import type { BairroIntent, BairroState } from './types';

/** Broken invariants of a state, as messages; empty when everything holds. */
export function invariantViolations(s: BairroState): string[] {
  const out: string[] = [];
  s.players.forEach((p, i) => {
    if (p.cash < 0) out.push(`player ${i} cash ${p.cash}`);
    if (p.bankrupt && p.lawyerCards !== 0) out.push(`bankrupt player ${i} holds lawyer cards`);
  });
  for (const [key, own] of Object.entries(s.owned)) {
    if (s.players[own.owner].bankrupt) out.push(`bankrupt player ${own.owner} owns ${key}`);
    if (own.mortgaged && own.houses > 0) out.push(`${key} is mortgaged with buildings`);
  }
  for (const rua of Object.keys(RUAS) as RuaId[]) {
    const houses = ruaPositions(rua).map(i => s.owned[i]?.houses ?? 0);
    if (Math.max(...houses) - Math.min(...houses) > 1) out.push(`rua ${rua} uneven: ${houses.join(',')}`);
  }
  const lawyers = s.players.reduce((n, p) => n + p.lawyerCards, 0);
  if (lawyers + s.deck.length !== DECK.length) out.push(`lawyer cards ${lawyers} + deck ${s.deck.length} != ${DECK.length}`);
  return out;
}

export interface RunStats {
  games: number;
  winners: number;
  logKeys: Set<string>;
  /** Every param name any log entry carried. */
  logParams: Set<string>;
  reasons: Set<string>;
  violations: string[];
}

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const newStats = (): RunStats => ({ games: 0, winners: 0, logKeys: new Set(), logParams: new Set(), reasons: new Set(), violations: [] });

/** A state's fingerprint, without the log's contents (only its length) to keep it cheap. */
const fingerprint = (s: BairroState) => JSON.stringify({ ...s, log: s.log.length });

/** Applies one intent, recording its refusal reason; checks a refusal changed nothing and the invariants hold. */
function step(s: BairroState, player: number, intent: unknown, stats: RunStats, where: string): void {
  const before = fingerprint(s);
  const r = apply(s, player, intent as BairroIntent);
  if (!r.ok) {
    stats.reasons.add(r.reason);
    if (fingerprint(s) !== before) stats.violations.push(`${where}: refusal ${r.reason} changed the state`);
  }
  for (const v of invariantViolations(s)) stats.violations.push(`${where}: ${v}`);
}

function finish(s: BairroState, stats: RunStats): void {
  stats.games++;
  if (s.winner !== null) stats.winners++;
  for (const e of s.log) {
    stats.logKeys.add(e.key);
    for (const k of Object.keys(e.params ?? {})) stats.logParams.add(k);
  }
}

/** Bot-only games, `seeds` of them with 2–6 players, each until a winner or `maxTurns` turns. */
export function runSimulation(seeds: number, maxTurns: number): RunStats {
  const stats = newStats();
  for (let seed = 1; seed <= seeds; seed++) {
    const s = createBairro(seats(2 + (seed % 5)), seed);
    while (s.winner === null && s.turnNumber < maxTurns) {
      const { player, intent } = botMove(s);
      const r = apply(s, player, intent);
      if (!r.ok) throw new Error(`seed ${seed}: bot move ${JSON.stringify(intent)} refused: ${r.reason}`);
      for (const v of invariantViolations(s)) stats.violations.push(`seed ${seed} turn ${s.turnNumber}: ${v}`);
    }
    finish(s, stats);
  }
  return stats;
}

const pick = <T>(rng: RngState, xs: readonly T[]): T => xs[nextInt(rng, xs.length)];

const TYPES = [
  'roll', 'buy', 'decline', 'endTurn', 'payJailFine', 'useLawyer', 'build', 'sellBuilding', 'mortgage',
  'unmortgage', 'payDebt', 'goBankrupt', 'proposeTrade', 'cancelTrade', 'answerTrade', 'fly', '', 'ROLL',
];

function randomPos(rng: RngState, s: BairroState): unknown {
  const owned = Object.keys(s.owned).map(Number);
  const r = nextFloat(rng);
  if (r < 0.5 && owned.length) return pick(rng, owned);
  if (r < 0.8) return nextInt(rng, BOARD.length);
  return pick(rng, [-1, 40, 99, 1.5, NaN, '3', null, undefined]);
}

function randomSide(rng: RngState, s: BairroState, owner: number): unknown {
  if (nextFloat(rng) < 0.1) return pick(rng, [null, {}, 'x', { assets: 'all', cash: 1, lawyerCards: 0 }, { assets: [], cash: -5, lawyerCards: 0 }]);
  const mine = Object.keys(s.owned).map(Number).filter(i => s.owned[i].owner === owner);
  if (nextFloat(rng) < 0.3) return { assets: [], cash: 0, lawyerCards: 0 };
  const assets = mine.filter(() => nextFloat(rng) < 0.3);
  if (nextFloat(rng) < 0.1) assets.push(pick(rng, [0, 2, 41, -1, assets[0] ?? 1, assets[0] ?? 1]));
  return { assets, cash: pick(rng, [0, 0, 10, 100, 400, 5000]), lawyerCards: pick(rng, [0, 0, 0, 1, 2]) };
}

/** A random intent: unknown types, out-of-range positions and malformed offers included. */
function junkIntent(rng: RngState, s: BairroState, player: number): unknown {
  const r = nextFloat(rng);
  if (r < 0.03) return pick(rng, [null, undefined, 7, 'roll', [], { type: 3 }]);
  const type = pick(rng, TYPES);
  const to = nextFloat(rng) < 0.9 ? nextInt(rng, s.players.length) : pick(rng, [-1, s.players.length, 'p1', 0.5]);
  return {
    type,
    pos: randomPos(rng, s),
    accept: pick(rng, [true, false, true, 'yes', undefined]),
    offer: nextFloat(rng) < 0.1 ? pick(rng, [null, 'x', { to }]) : { to, give: randomSide(rng, s, player), get: randomSide(rng, s, typeof to === 'number' ? to : 0) },
  };
}

/** Games where each step is a bot move or, half the time, a random intent from a random seat (some out of range). */
export function runFuzz(seeds: number, maxSteps: number): RunStats {
  const stats = newStats();
  for (let seed = 1; seed <= seeds; seed++) {
    const s = createBairro(seats(2 + (seed % 5)), 1000 + seed);
    const rng = createRng(seed);
    for (let i = 0; i < maxSteps && s.winner === null; i++) {
      if (nextFloat(rng) < 0.5) {
        const { player, intent } = botMove(s);
        step(s, player, intent, stats, `seed ${seed} step ${i}`);
      } else {
        // Often the current player, so the junk gets past the turn gate.
        const r = nextFloat(rng);
        const player = r < 0.4 ? s.current : r < 0.95 ? nextInt(rng, s.players.length) : pick(rng, [-1, s.players.length, 99]);
        step(s, player, junkIntent(rng, s, player), stats, `seed ${seed} step ${i}`);
      }
    }
    // Drive every game to its end, so the late-game keys are reached too.
    while (s.winner === null && s.turnNumber < 5000) {
      const { player, intent } = botMove(s);
      step(s, player, intent, stats, `seed ${seed} endgame`);
    }
    for (let i = 0; i < 5; i++) step(s, nextInt(rng, s.players.length), junkIntent(rng, s, 0), stats, `seed ${seed} after the end`);
    finish(s, stats);
  }
  return stats;
}
