// A simple legal strategy, for simulations. Its only trade is buying the last ponto of a rua at twice its price.
import { canBuild, canUnmortgage, liquidationValue, ruaPositions } from './assets';
import { BOARD, JAIL_FINE, RUAS, unmortgageCost } from './board';
import type { PontoSquare, RuaId, ServicoSquare } from './board';
import { liquidate } from './engine';
import type { BairroIntent, BairroState, Offer, OfferSide, OfferTerms } from './types';

/** Cash a bot keeps after buying a square. */
const BUY_RESERVE = 200;
/** Cash a bot keeps after building. */
const BUILD_RESERVE = 300;
/** Cash a bot keeps after unmortgaging. */
const UNMORTGAGE_RESERVE = 500;
/** Cash above which a jailed bot pays the fine instead of rolling. */
const FINE_RESERVE = 400;

/** The first sale or mortgage `liquidate` would make toward `target`, found on a copy of the state. */
function nextLiquidation(s: BairroState, player: number, target: number): BairroIntent {
  const copy = structuredClone(s);
  const from = copy.log.length;
  liquidate(copy, player, target);
  const first = copy.log.slice(from).find(e => e.key === 'soldBuilding' || e.key === 'mortgaged')!;
  const pos = Number(first.params!.pos);
  return first.key === 'soldBuilding' ? { type: 'sellBuilding', pos } : { type: 'mortgage', pos };
}

/** The current player's assets, by board position. */
const assetsOf = (s: BairroState, player: number) =>
  Object.keys(s.owned).map(Number).filter(i => s.owned[i].owner === player);

/** What a side is worth to a bot: cash, the price of each asset, and 50 per lawyer card. */
const worth = (side: OfferSide) =>
  side.cash + side.lawyerCards * JAIL_FINE + side.assets.reduce((sum, i) => sum + (BOARD[i] as PontoSquare | ServicoSquare).price, 0);

/** A bot accepts only offers worth at least twice what it gives up. */
const accepts = (offer: Offer) => worth(offer.give) >= 2 * worth(offer.get);

/**
 * Without trades most ruas stay split and games never end, so a bot holding all but one ponto of a
 * rua without buildings offers the owner of the last one twice its price, when it can spare the cash.
 * Such an offer is always accepted, so it is never repeated.
 */
function completingTrade(s: BairroState, player: number): OfferTerms | null {
  for (const rua of Object.keys(RUAS) as RuaId[]) {
    const rest = ruaPositions(rua).filter(i => s.owned[i]?.owner !== player);
    if (rest.length !== 1 || ruaPositions(rua).some(i => (s.owned[i]?.houses ?? 0) > 0)) continue;
    const own = s.owned[rest[0]];
    if (!own || s.players[own.owner].bankrupt) continue;
    const cash = 2 * (BOARD[rest[0]] as PontoSquare).price;
    if (s.players[player].cash - cash < BUY_RESERVE) continue;
    return { to: own.owner, give: { assets: [], cash, lawyerCards: 0 }, get: { assets: [rest[0]], cash: 0, lawyerCards: 0 } };
  }
  return null;
}

/** Who acts next and what they do. The game must not be over. */
export function botMove(s: BairroState): { player: number; intent: BairroIntent } {
  if (s.offer) return { player: s.offer.to, intent: { type: 'answerTrade', accept: accepts(s.offer) } };
  if (s.debts.length > 0) {
    const player = s.debts[0].debtor;
    const p = s.players[player];
    const owed = s.debts.filter(d => d.debtor === player).reduce((sum, d) => sum + d.amount, 0);
    if (p.cash >= s.debts[0].amount) return { player, intent: { type: 'payDebt' } };
    if (liquidationValue(s, player) < owed) return { player, intent: { type: 'goBankrupt' } };
    return { player, intent: nextLiquidation(s, player, owed) };
  }
  const player = s.current;
  const p = s.players[player];
  const ph = s.phase;
  const act = (intent: BairroIntent) => ({ player, intent });
  if (ph.kind === 'buy') {
    const price = (BOARD[ph.square] as PontoSquare | ServicoSquare).price;
    return act(p.cash - price >= BUY_RESERVE ? { type: 'buy' } : { type: 'decline' });
  }
  if (ph.kind === 'roll') {
    if (p.jailTurns !== null && p.lawyerCards > 0) return act({ type: 'useLawyer' });
    if (p.jailTurns !== null && p.cash >= FINE_RESERVE + JAIL_FINE) return act({ type: 'payJailFine' });
    return act({ type: 'roll' });
  }
  const offer = completingTrade(s, player);
  if (offer) return act({ type: 'proposeTrade', offer });
  for (const pos of assetsOf(s, player)) {
    const sq = BOARD[pos] as PontoSquare | ServicoSquare;
    if (canUnmortgage(s, player, pos) === null && p.cash >= UNMORTGAGE_RESERVE + unmortgageCost(sq)) {
      return act({ type: 'unmortgage', pos });
    }
  }
  for (const pos of assetsOf(s, player)) {
    const sq = BOARD[pos];
    if (sq.kind === 'ponto' && canBuild(s, player, pos) === null && p.cash >= BUILD_RESERVE + sq.houseCost) {
      return act({ type: 'build', pos });
    }
  }
  return act(ph.rollAgain ? { type: 'roll' } : { type: 'endTurn' });
}
