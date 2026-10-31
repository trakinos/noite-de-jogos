// Cautious forced moves when a clock runs out. Never buys, builds, unmortgages or proposes trades.
import type { ClockKind } from '../../net/turnClock';
import { passMissingBids } from './auction';
import { apply, liquidate } from './engine';
import { log } from './ops';
import type { BairroIntent, BairroState } from './types';

/** Safety net: no turn needs anywhere near this many forced moves. */
const MAX_FORCED_MOVES = 500;

/** Raises what the debtor owes (selling, then mortgaging) and pays it all, or goes bankrupt if it can't. */
function settle(s: BairroState, debtor: number): void {
  const owed = s.debts.filter(d => d.debtor === debtor).reduce((sum, d) => sum + d.amount, 0);
  if (owed === 0) return;
  liquidate(s, debtor, owed);
  if (s.players[debtor].cash < owed) {
    apply(s, debtor, { type: 'goBankrupt' });
    return;
  }
  while (s.debts.some(d => d.debtor === debtor)) {
    if (!apply(s, debtor, { type: 'payDebt' }).ok) return;
  }
}

/** Every debtor other than `except`, oldest debt first, each once. */
const debtors = (s: BairroState, except: number | null) =>
  [...new Set(s.debts.map(d => d.debtor))].filter(d => d !== except);

/** The current player's next cautious move. */
function turnMove(s: BairroState): BairroIntent {
  const ph = s.phase;
  if (ph.kind === 'buy') return { type: 'decline' };
  if (ph.kind === 'rent') return { type: 'payRent' };
  if (ph.kind === 'roll' || ph.rollAgain) return { type: 'roll' };
  return { type: 'endTurn' };
}

/**
 * Time ran out. During an auction, whoever hasn't bid on the escritura passes.
 * 'response': the trade recipient declines and every off-turn debtor settles.
 * 'turn': the current player cancels their offer, settles their debts (and anyone else's), declines
 * the buy and rolls or ends the turn, until the turn changes or the game ends.
 */
export function expire(s: BairroState, kind: ClockKind): void {
  if (s.winner !== null) return;
  // An auction lot closes with whoever hasn't bid passing; the next lot gets its own time.
  if (s.auction) {
    passMissingBids(s);
    return;
  }
  if (kind === 'response') {
    const late = new Set<number>(debtors(s, s.current));
    if (s.offer) late.add(s.offer.to);
    for (const p of late) log(s, p, 'timedOut');
    if (s.offer) apply(s, s.offer.to, { type: 'answerTrade', accept: false });
    for (const d of debtors(s, s.current)) if (s.winner === null) settle(s, d);
    return;
  }
  const turn = s.turnNumber;
  log(s, s.current, 'timedOut');
  for (let i = 0; i < MAX_FORCED_MOVES && s.winner === null && s.turnNumber === turn; i++) {
    if (s.offer) {
      const { from, to } = s.offer;
      apply(s, from, { type: 'cancelTrade' });
      if (s.offer) apply(s, to, { type: 'answerTrade', accept: false });
      continue;
    }
    if (s.debts.length > 0) {
      // Own debts first; settling may end the game or, by bankruptcy, the turn.
      for (const d of [s.current, ...debtors(s, s.current)]) if (s.winner === null) settle(s, d);
      continue;
    }
    if (!apply(s, s.current, turnMove(s)).ok) return;
  }
}
