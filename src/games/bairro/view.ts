import type { BairroState } from './types';

/** What this player is asked to do now. */
export type BairroPending = 'roll' | 'buy' | 'manage' | 'debt' | 'tradeAnswer' | 'wait';

/** The state as one player sees it: everything but the deck order, the rng and the test dice. */
export interface BairroView extends Omit<BairroState, 'deck' | 'rng' | 'riggedDice'> {
  deckCount: number;
  /** The full log length: the host may send only the latest entries, so this is how views are diffed. */
  logTotal: number;
  you: number;
  pending: BairroPending;
}

export function pendingFor(s: BairroState, player: number): BairroPending {
  // At game over, current and debts may be stale: nobody acts.
  if (s.winner !== null || s.players[player]?.bankrupt) return 'wait';
  if (s.offer) return player === s.offer.to ? 'tradeAnswer' : 'wait';
  if (s.debts.length > 0) return s.debts.some(d => d.debtor === player) ? 'debt' : 'wait';
  if (player !== s.current) return 'wait';
  return s.phase.kind;
}

/** A copy, so the host can send or keep it without touching the state. */
export function viewFor(s: BairroState, player: number): BairroView {
  const { deck, rng: _rng, riggedDice: _dice, ...rest } = s;
  return { ...structuredClone(rest), deckCount: deck.length, logTotal: s.log.length, you: player, pending: pendingFor(s, player) };
}
