import type { RngState } from '../../engine/rng';

export interface BairroPlayer {
  id: string; name: string; cash: number; pos: number;
  /** null when free; turns spent in the Xilindró otherwise. */
  jailTurns: number | null;
  lawyerCards: number; bankrupt: boolean;
}

export interface Ownership { owner: number; houses: number /* 0–4, 5 = prédio */; mortgaged: boolean }

export type Phase =
  | { kind: 'roll' }                         // current player must roll (or act on jail options)
  | { kind: 'buy'; square: number; rollAgain: boolean }          // landed on an unowned ponto/servico
  | { kind: 'manage'; rollAgain: boolean };  // build/trade/etc; then roll again (doubles) or end turn

export interface Debt { debtor: number; creditor: number | null /* null = bank */; amount: number }

export interface OfferSide { assets: number[]; cash: number; lawyerCards: number }
export interface OfferTerms { to: number; give: OfferSide; get: OfferSide }
export interface Offer extends OfferTerms { from: number }

export interface BairroLogEntry { player: number | null; key: string; params?: Record<string, string | number> }

export interface BairroState {
  players: BairroPlayer[]; current: number; phase: Phase;
  owned: Record<number, Ownership>;          // keyed by board position
  deck: string[];                            // card ids, top first; lawyer cards in hand are out of it
  doublesInRow: number; lastRoll: [number, number] | null;
  debts: Debt[]; offer: Offer | null;
  /** Seats in the order they went bankrupt; empty at setup. */
  bankruptOrder: number[];
  log: BairroLogEntry[]; rng: RngState; winner: number | null;
  /** +1 on every turn change. */
  turnNumber: number;
  /** Trade proposals made this turn (cancelling or answering doesn't count); reset on every turn change. */
  tradesThisTurn: number;
  /** Test hook: when non-empty, the next roll is taken from here instead of the rng. */
  riggedDice?: [number, number][];
}

export type BairroIntent =
  | { type: 'roll' } | { type: 'buy' } | { type: 'decline' } | { type: 'endTurn' }
  | { type: 'payJailFine' } | { type: 'useLawyer' }
  | { type: 'build'; pos: number } | { type: 'sellBuilding'; pos: number }
  | { type: 'mortgage'; pos: number } | { type: 'unmortgage'; pos: number }
  | { type: 'payDebt' } | { type: 'goBankrupt' }
  | { type: 'proposeTrade'; offer: OfferTerms } | { type: 'cancelTrade' } | { type: 'answerTrade'; accept: boolean };
