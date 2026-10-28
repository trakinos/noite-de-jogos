import { BOARD } from '../board';
import type { BairroView } from '../view';
import { RUA_COLORS } from './geometry';

export interface SquareInfo {
  pos: number;
  kind: (typeof BOARD)[number]['kind'];
  /** The square id; translate it with `bairroText(lang).square`. */
  name: string;
  ruaColor: string | null;
  price: number | null;
  owner: number | null;
  /** 0-4 puxadinhos, 5 = prédio. */
  houses: number;
  mortgaged: boolean;
  /** Seats standing here; bankrupt players are left out. */
  tokens: number[];
  /**
   * What landing here costs right now: an amount for a ponto, the dice multiplier for a serviço.
   * Null when nobody collects (no owner, mortgaged, or the owner went bust). Mirrors the engine's rentFor.
   */
  rent: { amount: number } | { perDice: number } | null;
}

function rentNow(view: BairroView, pos: number): SquareInfo['rent'] {
  const sq = BOARD[pos]!;
  const own = view.owned[pos];
  if (!own || own.mortgaged || view.players[own.owner]?.bankrupt) return null;
  const owns = (i: number) => view.owned[i]?.owner === own.owner;
  if (sq.kind === 'servico') {
    const all = BOARD.every((x, i) => x.kind !== 'servico' || owns(i));
    return { perDice: sq.multiplier * (all ? 2 : 1) };
  }
  if (sq.kind !== 'ponto') return null;
  if (own.houses > 0) return { amount: sq.rent[own.houses]! };
  const whole = BOARD.every((x, i) => x.kind !== 'ponto' || x.rua !== sq.rua || (owns(i) && view.owned[i]!.houses === 0));
  return { amount: sq.rent[0] * (whole ? 2 : 1) };
}

export function squareInfo(view: BairroView, pos: number): SquareInfo {
  const sq = BOARD[pos]!;
  const own = view.owned[pos];
  return {
    pos,
    kind: sq.kind,
    name: sq.id,
    ruaColor: sq.kind === 'ponto' ? RUA_COLORS[sq.rua] : null,
    price: sq.kind === 'ponto' || sq.kind === 'servico' ? sq.price : null,
    owner: own?.owner ?? null,
    houses: own?.houses ?? 0,
    mortgaged: own?.mortgaged ?? false,
    tokens: view.players.flatMap((p, i) => (!p.bankrupt && p.pos === pos ? [i] : [])),
    rent: rentNow(view, pos),
  };
}
