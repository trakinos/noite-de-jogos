// The per-player skills (lobby setting "Habilidades") and the prices they change. Must not import engine.ts.
import { BOARD } from './board';
import type { PontoSquare, ServicoSquare } from './board';
import { credit, log } from './ops';
import type { BairroState, Offer, SkillId } from './types';

export const SKILLS: readonly SkillId[] = ['donoDaCasa', 'reiDaPracinha', 'empreiteiro', 'corretor', 'malandro', 'bicheiro'];

/** Rei da Pracinha: passing or stopping at the Pracinha pays this. */
export const PRACINHA_BONUS = 100;
/** Bicheiro: anyone else stopping at the Pé de Meia, the IPTU or the Bolão pays this to the bicheiro (from the Prefeitura). */
export const BICHEIRO_BONUS = 100;
/** Bicheiro: stopping there yourself costs this, to the Prefeitura. */
export const BICHEIRO_FINE = 200;
/** Corretor: the bank's commission on someone else's purchase of an escritura. */
export const CORRETOR_SALE = 25;
/** Corretor: the bank's commission on someone else's mortgage payoff. */
export const CORRETOR_MORTGAGE = 10;
/** Corretor: the fee on a trade between two other players, paid by whichever of them the proposal says. */
export const CORRETOR_TRADE = 25;
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

/** The squares where stopping pays the bicheiro (or costs the bicheiro). */
export const BICHO_SQUARES: ReadonlySet<string> = new Set(['start', 'iptu', 'bolao']);

/** The Corretor still in the game, unless it's one of `parties`: nobody earns a commission on their own deals. */
export function corretorOutside(s: Players, ...parties: number[]): number | null {
  const i = s.players.findIndex(p => p.skill === 'corretor' && !p.bankrupt);
  return i < 0 || parties.includes(i) ? null : i;
}

/** The bank pays the Corretor for `who`'s deal on `pos` (a purchase or a mortgage payoff). */
export function commission(s: BairroState, who: number, pos: number, amount: number): void {
  const corretor = corretorOutside(s, who);
  if (corretor === null) return;
  credit(s, corretor, amount);
  log(s, corretor, 'skillCorretor', { who, pos, amount });
}

/** Who pays the Corretor's fee on `offer`. */
export const feePayer = (offer: Pick<Offer, 'from' | 'to' | 'fee'>): number => (offer.fee === 'to' ? offer.to : offer.from);
