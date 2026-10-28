import { DECK } from '../deck';
import { BOARD_SIZE } from './geometry';
import type { BairroView } from '../view';

export interface TokenMove {
  player: number;
  from: number;
  to: number;
  /** The squares the token shows, in order; the last is `to`. A jump has just that one. */
  steps: number[];
  /** Arrested here, after walking to it: the last step (to the Papuda) is the cop taking the token away. */
  arrestAt?: number;
}

/** The longest walk a roll can give (two dice); anything longer is a jump. */
const MAX_WALK = 12;

/** The log entries `next` has beyond `prev`; the wire log is capped, so count by `logTotal`. */
export function newEntries(prev: BairroView, next: BairroView) {
  const n = Math.min(next.logTotal - prev.logTotal, next.log.length);
  return n > 0 ? next.log.slice(-n) : [];
}

const advancesToStart = (card: unknown) => DECK.find(c => c.id === card)?.effect.kind === 'advanceToStart';

const walk = (from: number, to: number) =>
  Array.from({ length: (to - from + BOARD_SIZE) % BOARD_SIZE }, (_, i) => (from + i + 1) % BOARD_SIZE);

/**
 * Where `player` was arrested: the third doubles arrest on the spot; a roll onto "Vá pra Papuda" or onto a card
 * that sends you there arrests where the dice landed. Null when the arrest can't be placed (then the token just jumps).
 */
function arrestSquare(fresh: BairroView['log'], player: number, from: number): number | null {
  const mine = fresh.filter(e => e.player === player);
  if (mine.some(e => e.key === 'thirdDouble')) return from;
  const roll = mine.find(e => e.key === 'rolled');
  const sum = Number(roll?.params?.d1) + Number(roll?.params?.d2);
  return Number.isFinite(sum) ? (from + sum) % BOARD_SIZE : null;
}

/** Token moves between two views of the same game: a walk, or a jump for jail and long card moves. */
export function movesBetween(prev: BairroView, next: BairroView): TokenMove[] {
  if (prev.players.length !== next.players.length) return [];
  const fresh = newEntries(prev, next);
  return next.players.flatMap((p, player) => {
    const from = prev.players[player].pos;
    const to = p.pos;
    if (from === to) return [];
    const distance = (to - from + BOARD_SIZE) % BOARD_SIZE;
    if (fresh.some(e => e.player === player && e.key === 'wentToJail')) {
      const at = arrestSquare(fresh, player, from);
      if (at !== null) return [{ player, from, to, steps: [...walk(from, at), to], arrestAt: at }];
      return [{ player, from, to, steps: [to] }];
    }
    const jumped = fresh.some(e => e.player === player && e.key === 'luck' && advancesToStart(e.params?.card));
    if (jumped || distance > MAX_WALK) return [{ player, from, to, steps: [to] }];
    return [{ player, from, to, steps: walk(from, to) }];
  });
}

/** Whether dice were rolled between the two views (a repeated roll still counts). */
export function rolledBetween(prev: BairroView, next: BairroView): boolean {
  return newEntries(prev, next).some(e => e.key === 'rolled');
}

/** What a doubles roll means: roll again, out of the Papuda, or the third in a row (off to the Papuda). */
export type DoublesKind = 'again' | 'free' | 'third';

/** The doubles rolled between the two views, if the newest roll was doubles. */
export function doublesBetween(prev: BairroView, next: BairroView): DoublesKind | null {
  const fresh = newEntries(prev, next);
  const at = fresh.map(e => e.key).lastIndexOf('rolled');
  if (at < 0) return null;
  const { d1, d2 } = fresh[at].params ?? {};
  if (d1 === undefined || d1 !== d2) return null;
  const after = fresh.slice(at + 1).map(e => e.key);
  if (after.includes('thirdDouble')) return 'third';
  if (after.includes('leftJailDoubles')) return 'free';
  return 'again';
}

/** How someone got out of the Papuda: paid the fine (by choice or forced on the third try), a lawyer card, or doubles. */
export type ReleaseKind = 'fine' | 'lawyer' | 'doubles';
export interface Release {
  player: number;
  kind: ReleaseKind;
  /** True when it came with a roll (doubles or the forced fine), so it waits for the dice. */
  rolled: boolean;
}

const RELEASES: Record<string, { kind: ReleaseKind; rolled: boolean }> = {
  paidJailFine: { kind: 'fine', rolled: false },
  jailFineForced: { kind: 'fine', rolled: true },
  usedLawyer: { kind: 'lawyer', rolled: false },
  leftJailDoubles: { kind: 'doubles', rolled: true },
};

/** Everyone who left the Papuda between the two views. */
export function releasesBetween(prev: BairroView, next: BairroView): Release[] {
  return newEntries(prev, next).flatMap(e => {
    const r = RELEASES[e.key];
    return r && e.player !== null ? [{ player: e.player, ...r }] : [];
  });
}

/** The view with the tokens standing at `positions` (per seat), for drawing tokens mid-walk. */
export function withPositions(view: BairroView, positions: number[]): BairroView {
  return { ...view, players: view.players.map((p, i) => ({ ...p, pos: positions[i] ?? p.pos })) };
}
