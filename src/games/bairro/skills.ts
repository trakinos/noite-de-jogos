// The per-player skills (lobby setting "Habilidades") and the prices they change. Must not import engine.ts.
import { BOARD } from './board';
import type { PontoSquare, ServicoSquare } from './board';
import type { BairroState, SkillId } from './types';

export const SKILLS: readonly SkillId[] = ['donoDaCasa', 'reiDaPracinha', 'empreiteiro', 'corretor', 'malandro', 'bicheiro'];

/** Rei da Pracinha: passing or stopping at the Pracinha pays this. */
export const PRACINHA_BONUS = 100;
/** Bicheiro: anyone stopping at the Pé de Meia, the IPTU or the Bolão pays this to the bicheiro (from the Prefeitura). */
export const BICHEIRO_BONUS = 100;
/** Empreiteiro: buildings cost this share of the price. */
const EMPREITEIRO_SHARE = 0.75;
/** Corretor: escrituras cost this share of the price. */
const CORRETOR_SHARE = 0.9;

type Players = Pick<BairroState, 'players'>;

export const hasSkill = (s: Players, player: number, skill: SkillId): boolean => s.players[player]?.skill === skill;

/** What `player` pays the Prefeitura for the escritura at `pos` (the Corretor pays less). */
export function buyPrice(s: Players, player: number, pos: number): number {
  const price = (BOARD[pos] as PontoSquare | ServicoSquare).price;
  return hasSkill(s, player, 'corretor') ? Math.ceil(price * CORRETOR_SHARE) : price;
}

/** What one building on the ponto at `pos` costs `player` (the Empreiteiro pays less). Selling still refunds half the full cost. */
export function buildCost(s: Players, player: number, pos: number): number {
  const cost = (BOARD[pos] as PontoSquare).houseCost;
  return hasSkill(s, player, 'empreiteiro') ? Math.ceil(cost * EMPREITEIRO_SHARE) : cost;
}

/** The squares where stopping pays the bicheiro. */
export const BICHO_SQUARES: ReadonlySet<string> = new Set(['start', 'iptu', 'bolao']);
