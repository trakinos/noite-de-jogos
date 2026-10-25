// Mutation helpers shared by engine.ts and trades.ts. Must not import engine.ts.
import { BOARD } from './board';
import type { PontoSquare, ServicoSquare } from './board';
import type { BairroState } from './types';

export function log(s: BairroState, player: number | null, key: string, params?: Record<string, string | number>): void {
  s.log.push(params ? { player, key, params } : { player, key });
}

export function credit(s: BairroState, player: number, amount: number): void {
  s.players[player].cash += amount;
}

/** `debtor` pays `amount` to `creditor` (null = bank) now if they can, else it becomes a Debt. Returns whether it was paid. */
export function charge(s: BairroState, debtor: number, creditor: number | null, amount: number): boolean {
  const p = s.players[debtor];
  if (p.cash < amount) {
    s.debts.push({ debtor, creditor, amount });
    if (creditor === null) log(s, debtor, 'owesBank', { amount });
    else log(s, debtor, 'owesPlayer', { to: creditor, amount });
    return false;
  }
  p.cash -= amount;
  if (creditor !== null) credit(s, creditor, amount);
  return true;
}

/** lawyerCards is a count, so the card id is inferred: c01 unless it is already back in the deck. */
export function lawyerCardId(s: BairroState): string {
  return s.deck.includes('c01') ? 'c02' : 'c01';
}

/** Sells one building on `pos` to the bank at half cost. The caller checks the even rule. */
export function sellOne(s: BairroState, player: number, pos: number): void {
  const refund = (BOARD[pos] as PontoSquare).houseCost / 2;
  s.owned[pos].houses--;
  credit(s, player, refund);
  log(s, player, 'soldBuilding', { pos, amount: refund });
}

/** Mortgages `pos` for its mortgage value. The caller checks the rua has no buildings. */
export function mortgageOne(s: BairroState, player: number, pos: number): void {
  const sq = BOARD[pos] as PontoSquare | ServicoSquare;
  s.owned[pos].mortgaged = true;
  credit(s, player, sq.mortgage);
  log(s, player, 'mortgaged', { pos, amount: sq.mortgage });
}

/** Hands the turn to the next solvent player. */
export function passTurn(s: BairroState): void {
  const n = s.players.length;
  let next = s.current;
  for (let k = 1; k <= n; k++) {
    next = (s.current + k) % n;
    if (!s.players[next].bankrupt) break;
  }
  s.current = next;
  s.phase = { kind: 'roll' };
  s.doublesInRow = 0;
  s.turnNumber++;
  s.tradesThisTurn = 0;
}
