import { canBuild, canMortgage, canSell, canUnmortgage } from '../assets';
import { BOARD, unmortgageCost } from '../board';
import type { RuaId } from '../board';
import type { BairroView } from '../view';

export type RentLabel = 'base' | '1' | '2' | '3' | '4' | 'predio';
export type EscrituraButtonId = 'build' | 'sell' | 'mortgage' | 'unmortgage';

export interface RentRow {
  label: RentLabel;
  amount: number;
  current: boolean;
  /** Base row only: the whole rua is held with no buildings, so the rent is doubled. */
  doubled?: boolean;
}

export interface EscrituraButton {
  id: EscrituraButtonId;
  enabled: boolean;
  /** A key of the bairro `reasons`, when disabled. */
  reason: string | null;
  /** What the action costs or pays. */
  amount: number;
}

export interface Escritura {
  pos: number;
  /** The square id; translate it with `bairroText(lang).square`. */
  name: string;
  rua: RuaId | null;
  price: number;
  /** Empty for a serviço. */
  rentRows: RentRow[];
  /** Serviços only: `current` is false when no rent is charged; rent is the dice total times `multiplier`, doubled when one owner holds all six. */
  servico: { multiplier: number; doubled: boolean; current: boolean } | null;
  houseCost: number | null;
  mortgage: number;
  unmortgageCost: number;
  owner: number | null;
  houses: number;
  mortgaged: boolean;
  buttons: EscrituraButton[];
}

const LABELS: RentLabel[] = ['base', '1', '2', '3', '4', 'predio'];

/** The escritura card of a ponto or serviço as this viewer sees it; null for any other square. */
export function escrituraFor(view: BairroView, pos: number): Escritura | null {
  const sq = BOARD[pos];
  if (!sq || (sq.kind !== 'ponto' && sq.kind !== 'servico')) return null;
  const own = view.owned[pos];
  const owner = own?.owner ?? null;
  const houses = own?.houses ?? 0;
  const mortgaged = own?.mortgaged ?? false;
  const mine = owner === view.you;
  // The engine charges no rent on a mortgaged asset or one whose owner went bust.
  const rentsNow = owner !== null && !mortgaged && !view.players[owner]?.bankrupt;
  const live = view.winner === null && !view.players[view.you]?.bankrupt;

  let rentRows: RentRow[] = [];
  let servico: Escritura['servico'] = null;
  if (sq.kind === 'ponto') {
    const rua = BOARD.flatMap((x, i) => (x.kind === 'ponto' && x.rua === sq.rua ? [i] : []));
    const doubled = owner !== null && houses === 0 && rua.every(i => view.owned[i]?.owner === owner && view.owned[i]!.houses === 0);
    rentRows = LABELS.map((label, level) => ({
      label,
      amount: level === 0 && doubled ? sq.rent[0] * 2 : sq.rent[level]!,
      current: rentsNow && level === houses,
      ...(level === 0 ? { doubled } : {}),
    }));
  } else {
    const all = owner !== null && BOARD.every((x, i) => x.kind !== 'servico' || view.owned[i]?.owner === owner);
    servico = { multiplier: sq.multiplier, doubled: all, current: rentsNow };
  }

  const buttons: EscrituraButton[] = [];
  if (mine && live) {
    const add = (id: EscrituraButtonId, reason: string | null, amount: number) =>
      buttons.push({ id, enabled: reason === null, reason, amount });
    if (mortgaged) {
      add('unmortgage', canUnmortgage(view, view.you, pos), unmortgageCost(sq));
    } else {
      if (sq.kind === 'ponto') {
        add('build', canBuild(view, view.you, pos), sq.houseCost);
        add('sell', canSell(view, view.you, pos), sq.houseCost / 2);
      }
      add('mortgage', canMortgage(view, view.you, pos), sq.mortgage);
    }
  }

  return {
    pos, name: sq.id, rua: sq.kind === 'ponto' ? sq.rua : null, price: sq.price, rentRows, servico,
    houseCost: sq.kind === 'ponto' ? sq.houseCost : null, mortgage: sq.mortgage, unmortgageCost: unmortgageCost(sq),
    owner, houses, mortgaged, buttons,
  };
}
