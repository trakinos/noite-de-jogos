import { DECK } from '../deck';
import { BOARD_SIZE } from './geometry';
import type { BairroView } from '../view';

export interface TokenMove {
  player: number;
  from: number;
  to: number;
  /** The squares the token shows, in order; the last is `to`. A jump has just that one. */
  steps: number[];
}

/** The longest walk a roll can give (two dice); anything longer is a jump. */
const MAX_WALK = 12;

/** The log entries `next` has beyond `prev`; the wire log is capped, so count by `logTotal`. */
export function newEntries(prev: BairroView, next: BairroView) {
  const n = Math.min(next.logTotal - prev.logTotal, next.log.length);
  return n > 0 ? next.log.slice(-n) : [];
}

const advancesToStart = (card: unknown) => DECK.find(c => c.id === card)?.effect.kind === 'advanceToStart';

/** Token moves between two views of the same game: a walk, or a jump for jail and long card moves. */
export function movesBetween(prev: BairroView, next: BairroView): TokenMove[] {
  if (prev.players.length !== next.players.length) return [];
  const fresh = newEntries(prev, next);
  return next.players.flatMap((p, player) => {
    const from = prev.players[player].pos;
    const to = p.pos;
    if (from === to) return [];
    const distance = (to - from + BOARD_SIZE) % BOARD_SIZE;
    const jumped = fresh.some(e => e.player === player && (e.key === 'wentToJail' || (e.key === 'luck' && advancesToStart(e.params?.card))));
    if (jumped || distance > MAX_WALK) return [{ player, from, to, steps: [to] }];
    return [{ player, from, to, steps: Array.from({ length: distance }, (_, i) => (from + i + 1) % BOARD_SIZE) }];
  });
}

/** Whether dice were rolled between the two views (a repeated roll still counts). */
export function rolledBetween(prev: BairroView, next: BairroView): boolean {
  return newEntries(prev, next).some(e => e.key === 'rolled');
}

/** The view with the tokens standing at `positions` (per seat), for drawing tokens mid-walk. */
export function withPositions(view: BairroView, positions: number[]): BairroView {
  return { ...view, players: view.players.map((p, i) => ({ ...p, pos: positions[i] ?? p.pos })) };
}
