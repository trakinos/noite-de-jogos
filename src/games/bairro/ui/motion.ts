import { BOARD } from '../board';
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
  /** A Tigrinho card drawn on the way: shown after the first `after` steps, before the rest (a jump or the arrest). */
  card?: { id: string; pos: number; after: number };
  /** Money from the board on the way: passing the Pé de Meia, the IPTU or the Bolão, as the token reaches step `at`. */
  bonuses?: Bonus[];
}

export type BonusKind = 'start' | 'iptu' | 'bolao';
export interface Bonus {
  /** Index into `steps`: the token is on this square when the money moves. */
  at: number;
  pos: number;
  kind: BonusKind;
  /** Positive for money in, negative for the IPTU. */
  amount: number;
}

const BOLAO_POS = BOARD.findIndex(sq => sq.kind === 'bolao');

/** The board's money in `mine` (one player's new log entries), placed on the move's steps. */
function bonusesOn(steps: number[], mine: BairroView['log']): Bonus[] {
  const last = steps.length - 1;
  const on = (pos: number) => {
    const k = steps.lastIndexOf(pos);
    return k < 0 ? last : k;
  };
  return mine.flatMap((e): Bonus[] => {
    const amount = Number(e.params?.amount);
    if (!Number.isFinite(amount)) return [];
    if (e.key === 'passStart') return [{ at: on(0), pos: 0, kind: 'start', amount }];
    if (e.key === 'wonBolao') return [{ at: on(BOLAO_POS), pos: BOLAO_POS, kind: 'bolao', amount }];
    if (e.key === 'paidTax') {
      const pos = Number(e.params?.pos);
      return Number.isInteger(pos) ? [{ at: on(pos), pos, kind: 'iptu', amount: -amount }] : [];
    }
    return [];
  });
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

/** Where the dice put `player` this roll, or null when no roll explains the move. */
function rolledTo(mine: BairroView['log'], from: number): number | null {
  const roll = mine.find(e => e.key === 'rolled');
  const sum = Number(roll?.params?.d1) + Number(roll?.params?.d2);
  return Number.isFinite(sum) ? (from + sum) % BOARD_SIZE : null;
}

/**
 * Token moves between two views of the same game: a walk, or a jump for long moves. An arrest walks to where the
 * token was caught (on the spot for the third doubles); a Tigrinho card walks to its square, then shows the card
 * before any jump or arrest it causes.
 */
export function movesBetween(prev: BairroView, next: BairroView): TokenMove[] {
  if (prev.players.length !== next.players.length) return [];
  const fresh = newEntries(prev, next);
  return next.players.flatMap((p, player): TokenMove[] => {
    const from = prev.players[player].pos;
    const to = p.pos;
    if (from === to) return [];
    const mine = fresh.filter(e => e.player === player);
    return moveOf(player, from, to, mine).map(m => {
      const bonuses = bonusesOn(m.steps, mine);
      return bonuses.length > 0 ? { ...m, bonuses } : m;
    });
  });
}

/** One player's move from `from` to `to`, read from their new log entries `mine`. */
function moveOf(player: number, from: number, to: number, mine: BairroView['log']): TokenMove[] {
  const arrested = mine.some(e => e.key === 'wentToJail');
  const third = mine.some(e => e.key === 'thirdDouble');
  const drawn = mine.find(e => e.key === 'luck')?.params?.card;
  const landed = third ? from : rolledTo(mine, from);

  if (landed !== null && drawn !== undefined) {
    const card = { id: String(drawn), pos: landed, after: walk(from, landed).length };
    const path = walk(from, landed);
    if (landed === to) return [{ player, from, to, steps: path, card }];
    return [{ player, from, to, steps: [...path, to], card, ...(arrested ? { arrestAt: landed } : {}) }];
  }
  if (arrested) {
    if (landed !== null) return [{ player, from, to, steps: [...walk(from, landed), to], arrestAt: landed }];
    return [{ player, from, to, steps: [to] }];
  }
  const jumped = drawn !== undefined && advancesToStart(drawn);
  const distance = (to - from + BOARD_SIZE) % BOARD_SIZE;
  if (jumped || distance > MAX_WALK) return [{ player, from, to, steps: [to] }];
  return [{ player, from, to, steps: walk(from, to) }];
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
