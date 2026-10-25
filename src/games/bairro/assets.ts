// Pure rules for buildings and mortgages. Must not import engine.ts (engine imports this).
import { BOARD, RUAS, unmortgageCost } from './board';
import type { PontoSquare, RuaId } from './board';
import type { BairroState } from './types';

/** A prédio is the fifth level. */
export const MAX_LEVEL = 5;

/** Board positions of a rua's pontos. */
export function ruaPositions(rua: RuaId): number[] {
  return RUAS[rua].map(id => BOARD.findIndex(x => x.id === id));
}

export function ownsWholeRua(s: BairroState, player: number, rua: RuaId): boolean {
  return ruaPositions(rua).every(i => s.owned[i]?.owner === player);
}

/**
 * Phase gate shared by build/sell/mortgage/unmortgage: null = allowed, else a reason key.
 * A player who owes may raise money (sell, mortgage) in any phase, on or off turn, but not spend it.
 */
export function canManageAssets(s: BairroState, player: number, raising: boolean): string | null {
  if (s.debts.some(d => d.debtor === player)) return raising ? null : 'debtOpen';
  if (player !== s.current) return 'notYourTurn';
  if (s.phase.kind !== 'roll' && s.phase.kind !== 'manage') return 'notNow';
  if (s.offer !== null) return 'notNow';
  if (s.debts.length > 0) return 'debtOpen';
  return null;
}

function squareAt(pos: unknown) {
  return Number.isInteger(pos) && (pos as number) >= 0 && (pos as number) < BOARD.length ? BOARD[pos as number] : undefined;
}

function pontoAt(s: BairroState, player: number, pos: unknown): { sq: PontoSquare; pos: number } | string {
  const sq = squareAt(pos);
  if (!sq || sq.kind !== 'ponto') return 'notAPonto';
  if (s.owned[pos as number]?.owner !== player) return 'notOwner';
  return { sq, pos: pos as number };
}

const housesOf = (s: BairroState, positions: number[]) => positions.map(i => s.owned[i]?.houses ?? 0);

export function canBuild(s: BairroState, player: number, pos: number): string | null {
  const gate = canManageAssets(s, player, false);
  if (gate) return gate;
  const t = pontoAt(s, player, pos);
  if (typeof t === 'string') return t;
  const rua = ruaPositions(t.sq.rua);
  if (!ownsWholeRua(s, player, t.sq.rua)) return 'needWholeRua';
  if (rua.some(i => s.owned[i].mortgaged)) return 'ruaMortgaged';
  const own = s.owned[t.pos];
  if (own.houses >= MAX_LEVEL) return 'alreadyPredio';
  if (own.houses > Math.min(...housesOf(s, rua))) return 'unevenBuild';
  if (s.players[player].cash < t.sq.houseCost) return 'notEnoughCash';
  return null;
}

export function canSell(s: BairroState, player: number, pos: number): string | null {
  const gate = canManageAssets(s, player, true);
  if (gate) return gate;
  const t = pontoAt(s, player, pos);
  if (typeof t === 'string') return t;
  const own = s.owned[t.pos];
  if (own.houses <= 0) return 'noBuildings';
  if (own.houses < Math.max(...housesOf(s, ruaPositions(t.sq.rua)))) return 'unevenSell';
  return null;
}

export function canMortgage(s: BairroState, player: number, pos: number): string | null {
  const gate = canManageAssets(s, player, true);
  if (gate) return gate;
  const sq = squareAt(pos);
  if (!sq || (sq.kind !== 'ponto' && sq.kind !== 'servico')) return 'notAPonto';
  if (s.owned[pos]?.owner !== player) return 'notOwner';
  if (s.owned[pos].mortgaged) return 'alreadyMortgaged';
  if (sq.kind === 'ponto' && housesOf(s, ruaPositions(sq.rua)).some(h => h > 0)) return 'ruaHasBuildings';
  return null;
}

export function canUnmortgage(s: BairroState, player: number, pos: number): string | null {
  const gate = canManageAssets(s, player, false);
  if (gate) return gate;
  const sq = squareAt(pos);
  if (!sq || (sq.kind !== 'ponto' && sq.kind !== 'servico')) return 'notAPonto';
  if (s.owned[pos]?.owner !== player) return 'notOwner';
  if (!s.owned[pos].mortgaged) return 'notMortgaged';
  if (s.players[player].cash < unmortgageCost(sq)) return 'notEnoughCash';
  return null;
}

/** Cash a player could raise: cash + half the cost of every building + mortgage value of every unmortgaged asset. */
export function liquidationValue(s: BairroState, player: number): number {
  let total = s.players[player].cash;
  for (const [key, own] of Object.entries(s.owned)) {
    if (own.owner !== player) continue;
    const sq = BOARD[Number(key)];
    if (sq.kind === 'ponto') total += (own.houses * sq.houseCost) / 2;
    if ((sq.kind === 'ponto' || sq.kind === 'servico') && !own.mortgaged) total += sq.mortgage;
  }
  return total;
}
