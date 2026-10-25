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
  };
}
