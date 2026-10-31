// The Prefeitura's auction of a bankrupt player's escrituras. Must not import engine.ts (engine imports this).
import type { ApplyResult } from '../module';
import { log } from './ops';
import type { BairroIntent, BairroState } from './types';

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

/** In a view, another player's bid that is in but not yet revealed. */
export const HIDDEN_BID = -1;

/** Who may bid: everyone still in the game. */
export const bidders = (s: Pick<BairroState, 'players'>): number[] => s.players.flatMap((p, i) => (p.bankrupt ? [] : [i]));

/**
 * Opens the auction of `lots` (board positions) after `from` went bankrupt to the Prefeitura. Each escritura is
 * sold clean (no buildings, no mortgage), one at a time in board order, by sealed bids.
 */
export function startAuction(s: BairroState, from: number, lots: number[]): void {
  if (lots.length === 0) return;
  for (const pos of lots) delete s.owned[pos];
  s.auction = { from, lots: [...lots].sort((a, b) => a - b), bids: s.players.map(() => null) };
  log(s, from, 'auctionStarted', { pos: s.auction.lots[0]! });
}

/** Lobby setting: the escritura at `pos`, which `from` just declined, goes to everyone's sealed bids (`from` included). */
export function auctionDeclined(s: BairroState, from: number, pos: number): void {
  s.auction = { from, lots: [pos], bids: s.players.map(() => null), declined: true };
  log(s, from, 'auctionDeclined', { pos });
}

/** One sealed bid on the escritura up for auction: 0 passes, anything up to your cash bids. Once each. */
export function placeBid(s: BairroState, player: number, intent: BairroIntent): ApplyResult {
  const a = s.auction;
  if (!a) return fail('notNow');
  if (!bidders(s).includes(player)) return fail('notBidding');
  if (a.bids[player] !== null) return fail('alreadyBid');
  const amount = (intent as { amount?: unknown }).amount;
  if (!Number.isInteger(amount) || (amount as number) < 0) return fail('badBid');
  if ((amount as number) > s.players[player]!.cash) return fail('notEnoughCash');
  if ((amount as number) > 0 && s.players[player]!.fiscal) return fail('fiscalBlocked');
  a.bids[player] = amount as number;
  if (bidders(s).every(i => a.bids[i] !== null)) closeLot(s);
  return ok();
}

/** Sells the escritura to the highest bid (ties: first in turn order from the current player), then opens the next. */
function closeLot(s: BairroState): void {
  const a = s.auction!;
  const pos = a.lots[0]!;
  const n = s.players.length;
  let winner: number | null = null;
  for (let k = 0; k < n; k++) {
    const i = (s.current + k) % n;
    const bid = a.bids[i];
    if (bid === null || bid <= 0) continue;
    if (winner === null || bid > a.bids[winner]!) winner = i;
  }
  if (winner === null) {
    log(s, null, 'auctionUnsold', { pos });
  } else {
    const amount = a.bids[winner]!;
    s.players[winner]!.cash -= amount;
    s.owned[pos] = { owner: winner, houses: 0, mortgaged: false };
    log(s, winner, 'auctionWon', { pos, amount });
  }
  a.lots.shift();
  a.bids = s.players.map(() => null);
  if (a.lots.length === 0) s.auction = null;
  else log(s, a.from, 'auctionNext', { pos: a.lots[0]! });
}

/** Time ran out on a lot: everyone who hasn't bid passes. */
export function passMissingBids(s: BairroState): void {
  const a = s.auction;
  if (!a) return;
  for (const i of bidders(s)) if (a.bids[i] === null) log(s, i, 'timedOut');
  for (const i of bidders(s)) if (s.auction === a && a.bids[i] === null) placeBid(s, i, { type: 'bid', amount: 0 });
}
