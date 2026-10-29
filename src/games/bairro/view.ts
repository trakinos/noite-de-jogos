import { HIDDEN_BID } from './auction';
import type { BairroState } from './types';

/** What this player is asked to do now. */
export type BairroPending = 'roll' | 'buy' | 'manage' | 'debt' | 'tradeAnswer' | 'bid' | 'wait';

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
  if (s.auction) return s.auction.bids[player] === null ? 'bid' : 'wait';
  if (s.offer) return player === s.offer.to ? 'tradeAnswer' : 'wait';
  if (s.debts.length > 0) return s.debts.some(d => d.debtor === player) ? 'debt' : 'wait';
  if (player !== s.current) return 'wait';
  return s.phase.kind;
}

/** A copy, so the host can send or keep it without touching the state. */
export function viewFor(s: BairroState, player: number): BairroView {
  const { deck, rng: _rng, riggedDice: _dice, ...rest } = s;
  const view = { ...structuredClone(rest), deckCount: deck.length, logTotal: s.log.length, you: player, pending: pendingFor(s, player) };
  // Without open trades, the terms stay between the two players: everyone else only learns who is trading with whom.
  if (view.offer && !s.openTrades && player !== view.offer.from && player !== view.offer.to) {
    view.offer = { ...view.offer, give: { assets: [], cash: 0, lawyerCards: 0 }, get: { assets: [], cash: 0, lawyerCards: 0 } };
  }
  // Sealed bids: everyone sees who has bid, but only their own amount until the lot closes.
  if (view.auction) view.auction.bids = view.auction.bids.map((b, i) => (b === null || i === player ? b : HIDDEN_BID));
  return view;
}
