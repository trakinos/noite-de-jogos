import type { Lang } from '../../../i18n/types';
import { ruaPositions } from '../assets';
import { BOARD, unmortgageCost } from '../board';
import { MAX_TRADES_PER_TURN } from '../trades';
import type { OfferSide } from '../types';
import type { BairroView } from '../view';
import { money } from './text';
import type { BairroText } from './text';

export interface TradeAsset {
  pos: number;
  enabled: boolean;
  /** A key of the bairro `reasons`, when disabled. */
  reason: string | null;
}

/** What one side of a trade may put up. */
export interface TradeSideOptions {
  assets: TradeAsset[];
  cash: number;
  lawyerCards: number;
}

export interface TradeOptions {
  /** What you may give. */
  give: TradeSideOptions;
  /** What the other player may give you. */
  get: TradeSideOptions;
}

function sideOptions(view: BairroView, seat: number): TradeSideOptions {
  const assets = Object.keys(view.owned).map(Number).filter(pos => view.owned[pos]!.owner === seat).sort((a, b) => a - b).map(pos => {
    const sq = BOARD[pos]!;
    // The engine refuses any asset of a rua where anyone has built.
    const blocked = sq.kind === 'ponto' && ruaPositions(sq.rua).some(i => (view.owned[i]?.houses ?? 0) > 0);
    return { pos, enabled: !blocked, reason: blocked ? 'ruaHasBuildings' : null };
  });
  const p = view.players[seat]!;
  return { assets, cash: p.cash, lawyerCards: p.lawyerCards };
}

/** Everything you and `to` may put into an offer, with the reason for each asset that can't be. */
export function tradeOptions(view: BairroView, to: number): TradeOptions {
  return { give: sideOptions(view, view.you), get: sideOptions(view, to) };
}

/** The other players you can still trade with. */
export function tradePartners(view: BairroView): number[] {
  return view.players.flatMap((p, i) => (i === view.you || p.bankrupt ? [] : [i]));
}

export const tradesLeft = (view: BairroView): number => Math.max(0, MAX_TRADES_PER_TURN - view.tradesThisTurn);

/** A typed count as a whole number between 0 and `max`; anything unreadable is 0. */
export function clampCount(n: number, max: number): number {
  return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 0), Math.max(max, 0)) : 0;
}

export const emptySide = (): OfferSide => ({ assets: [], cash: 0, lawyerCards: 0 });

export const isEmptySide = (s: OfferSide): boolean => s.assets.length === 0 && s.cash === 0 && s.lawyerCards === 0;

/** What a side puts up, one phrase each: squares by name, then cash, then lawyer cards. Empty when it gives nothing. */
export function sideLines(side: OfferSide, text: BairroText, lang: Lang): string[] {
  return [
    ...side.assets.map(pos => text.square(pos)),
    ...(side.cash > 0 ? [money(lang, side.cash)] : []),
    ...(side.lawyerCards > 0 ? [side.lawyerCards === 1 ? text.ui('tradeCardsOne') : text.ui('tradeCardsMany', { n: side.lawyerCards })] : []),
  ];
}

/** What an escritura is worth in a trade: its price, less the cost of lifting the mortgage when it has one. */
export interface AssetValue {
  pos: number;
  price: number;
  /** What the new owner pays to lift the mortgage; null when it has none. */
  lift: number | null;
  worth: number;
}

export function assetValue(view: BairroView, pos: number): AssetValue {
  const sq = BOARD[pos]!;
  const price = sq.kind === 'ponto' || sq.kind === 'servico' ? sq.price : 0;
  const lift = view.owned[pos]?.mortgaged && (sq.kind === 'ponto' || sq.kind === 'servico') ? unmortgageCost(sq) : null;
  return { pos, price, lift, worth: price - (lift ?? 0) };
}

/** A side's total in money: its escrituras' worth plus its cash. Lawyer cards have no price, so they don't count. */
export function sideValue(view: BairroView, side: OfferSide): number {
  return side.assets.reduce((sum, pos) => sum + assetValue(view, pos).worth, side.cash);
}
