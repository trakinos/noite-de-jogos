import { boardFor } from './board';
import type { VidaLog, VidaView } from './game';

/** Timings, close to Dono do Bairro's walk. */
export const WHEEL_MS = 1500;
export const STEP_MS = 260;
export const COIN_MS = 1300;
export const EVENT_MS = 2200;

/** Log kinds that get a card on screen when they happen. */
const EVENT_KINDS = new Set<VidaLog['k']>(['cash', 'raise', 'life', 'baby', 'tax', 'sue', 'marry', 'house', 'retire', 'loan', 'career', 'mansion', 'invest', 'midlife', 'dodge']);

export interface VidaAnim {
  /** The player who spun and walks. */
  seat: number | null;
  spin: number | null;
  /** Squares the token shows, in order, ending on its new square. */
  steps: number[];
  /** Salaries paid on the way: the step index where each coin pops. */
  paydays: { at: number; amount: number; pos: number }[];
  /** What happened after the walk, in order. */
  events: VidaLog[];
}

/** Entries added between two views, from the running total (the host trims the log it sends). */
export function newEntries(prev: VidaView, next: VidaView): VidaLog[] {
  const added = next.logTotal - prev.logTotal;
  if (added <= 0) return [];
  return next.log.slice(Math.max(0, next.log.length - added));
}

/** What to animate between two views of the same game, or null when nothing visible happened. */
export function animBetween(prev: VidaView, next: VidaView): VidaAnim | null {
  const fresh = newEntries(prev, next);
  if (fresh.length === 0) return null;
  const spin = fresh.find((e): e is Extract<VidaLog, { k: 'spin' }> => e.k === 'spin') ?? null;
  const seat = spin?.seat ?? null;
  const steps: number[] = [];
  if (spin && seat !== null) {
    const from = prev.players[seat]!.pos;
    const to = next.players[seat]!.pos;
    for (let p = from + 1; p <= to; p++) steps.push(p);
  }
  const squares = boardFor(next.length).squares;
  const paidSquares = steps.map((pos, at) => ({ pos, at })).filter(x => squares[x.pos]?.k === 'payday');
  const pays = fresh.filter((e): e is Extract<VidaLog, { k: 'payday' }> => e.k === 'payday');
  const paydays = pays.map((e, i) => ({ amount: e.n, at: paidSquares[i]?.at ?? steps.length - 1, pos: paidSquares[i]?.pos ?? next.players[e.seat]!.pos }));
  const events = fresh.filter(e => EVENT_KINDS.has(e.k));
  if (!spin && events.length === 0) return null;
  return { seat, spin: spin?.n ?? null, steps, paydays, events };
}

/** Whether the player asked the system for less motion. */
export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The same change without the spinning wheel or the step-by-step walk: the token jumps and every salary pops at once. */
export function quickAnim(a: VidaAnim): VidaAnim {
  return { ...a, steps: a.steps.slice(-1), paydays: a.paydays.map(p => ({ ...p, at: 0 })) };
}

/** How long the whole animation lasts. */
export function animDuration(a: VidaAnim): number {
  return (a.spin !== null ? WHEEL_MS : 0) + a.steps.length * STEP_MS + (a.events.length > 0 ? EVENT_MS : 0);
}
