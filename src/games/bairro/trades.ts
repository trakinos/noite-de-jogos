// Trade proposals and answers. Must not import engine.ts (engine imports this).
import type { ApplyResult } from '../module';
import { BOARD } from './board';
import { ruaPositions } from './assets';
import { log } from './ops';
import type { BairroIntent, BairroState, Offer, OfferSide } from './types';

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

const isCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;
const isSeat = (s: BairroState, n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < s.players.length;

/** Copies a side only if it is well formed (integer positions on the board, non-negative integer cash and cards). */
function cleanSide(side: unknown): OfferSide | null {
  if (!side || typeof side !== 'object') return null;
  const { assets, cash, lawyerCards } = side as Partial<OfferSide>;
  if (!Array.isArray(assets) || !assets.every(a => Number.isInteger(a) && a >= 0 && a < BOARD.length)) return null;
  if (!isCount(cash) || !isCount(lawyerCards)) return null;
  return { assets: [...assets], cash, lawyerCards };
}

/** Checks what `owner` puts up: assets they own (no buildings in the rua), no repeats, cash and cards they hold. */
function validateSide(s: BairroState, owner: number, side: OfferSide): string | null {
  if (new Set(side.assets).size !== side.assets.length) return 'duplicateAsset';
  for (const pos of side.assets) {
    const sq = BOARD[pos];
    if (sq.kind !== 'ponto' && sq.kind !== 'servico') return 'notAPonto';
    if (s.owned[pos]?.owner !== owner) return 'notOwner';
    if (sq.kind === 'ponto' && ruaPositions(sq.rua).some(i => (s.owned[i]?.houses ?? 0) > 0)) return 'ruaHasBuildings';
  }
  if (s.players[owner].cash < side.cash) return 'notEnoughCash';
  if (s.players[owner].lawyerCards < side.lawyerCards) return 'notEnoughLawyerCards';
  return null;
}

/** null = the offer can be carried out right now, else a reason key. Used at proposal and at acceptance. */
export function validateOffer(s: BairroState, offer: Offer): string | null {
  if (!offer || typeof offer !== 'object') return 'badOffer';
  const give = cleanSide(offer.give);
  const get = cleanSide(offer.get);
  if (!give || !get || !isSeat(s, offer.from) || !isSeat(s, offer.to)) return 'badOffer';
  if (offer.to === offer.from || s.players[offer.to].bankrupt || s.players[offer.from].bankrupt) return 'badRecipient';
  const empty = (x: OfferSide) => x.assets.length === 0 && x.cash === 0 && x.lawyerCards === 0;
  if (empty(give) && empty(get)) return 'emptyOffer';
  return validateSide(s, offer.from, give) ?? validateSide(s, offer.to, get);
}

export function proposeTrade(s: BairroState, player: number, intent: BairroIntent): ApplyResult {
  if (s.phase.kind !== 'roll' && s.phase.kind !== 'manage') return fail('notNow');
  const terms = (intent as { offer?: Partial<Offer> }).offer;
  const give = cleanSide(terms?.give);
  const get = cleanSide(terms?.get);
  if (!give || !get || !isSeat(s, terms?.to)) return fail('badOffer');
  const offer: Offer = { from: player, to: terms.to, give, get };
  const why = validateOffer(s, offer);
  if (why) return fail(why);
  s.offer = offer;
  log(s, player, 'tradeProposed', { to: offer.to });
  return ok();
}

export function cancelTrade(s: BairroState, player: number): ApplyResult {
  const offer = s.offer;
  if (!offer) return fail('notNow');
  if (player !== offer.from) return fail('tradePending');
  s.offer = null;
  log(s, player, 'tradeCancelled', { to: offer.to });
  return ok();
}

export function answerTrade(s: BairroState, player: number, intent: BairroIntent): ApplyResult {
  const offer = s.offer;
  if (!offer) return fail('notNow');
  if (player !== offer.to) return fail('tradePending');
  const accept = (intent as { accept?: unknown }).accept;
  if (typeof accept !== 'boolean') return fail('badIntent');
  s.offer = null;
  if (!accept) {
    log(s, player, 'tradeDeclined', { to: offer.from });
    return ok();
  }
  const why = validateOffer(s, offer);
  if (why) {
    // The offer is gone, so this is a state change and must reach everyone: ok, with the log saying why.
    log(s, offer.from, 'tradeVoided', { to: offer.to });
    return ok();
  }
  const a = s.players[offer.from];
  const b = s.players[offer.to];
  for (const pos of offer.give.assets) s.owned[pos].owner = offer.to;
  for (const pos of offer.get.assets) s.owned[pos].owner = offer.from;
  a.cash += offer.get.cash - offer.give.cash;
  b.cash += offer.give.cash - offer.get.cash;
  a.lawyerCards += offer.get.lawyerCards - offer.give.lawyerCards;
  b.lawyerCards += offer.give.lawyerCards - offer.get.lawyerCards;
  log(s, player, 'tradeAccepted', { to: offer.from });
  return ok();
}
