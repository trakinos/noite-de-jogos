// Helpers for tests only. Not imported by production code.
import { createBairro } from './setup';
import type { BairroState } from './types';

/** A fresh n-player game: player 0 is to roll and the log is empty. Player ids are p0, p1, ... */
export function game(n: number, seed = 1): BairroState {
  const s = createBairro(Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), seed);
  s.players.sort((a, b) => a.id.localeCompare(b.id));
  s.current = 0;
  s.log = [];
  return s;
}

/** Forces the next rolls, in order. */
export function rig(s: BairroState, dice: [number, number][]): void {
  s.riggedDice = [...(s.riggedDice ?? []), ...dice];
}

/** Makes `player` the owner of the square at `pos`. */
export function give(s: BairroState, player: number, pos: number, opts: { houses?: number; mortgaged?: boolean } = {}): void {
  s.owned[pos] = { owner: player, houses: opts.houses ?? 0, mortgaged: opts.mortgaged ?? false };
}
