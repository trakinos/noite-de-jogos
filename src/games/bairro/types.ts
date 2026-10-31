import type { RngState } from '../../engine/rng';

export interface BairroPlayer {
  id: string; name: string; cash: number; pos: number;
  /** null when free; turns spent in the Papuda otherwise. */
  jailTurns: number | null;
  lawyerCards: number; bankrupt: boolean;
  /** Lobby setting "Habilidades": dealt at random at setup, null without it. */
  skill: SkillId | null;
  /** The Malandro's extra roll is spent; it comes back on passing the Pé de Meia. */
  skillUsed: boolean;
  /** Tigrinho cards kept to play later (ids, at most HAND_MAX); out of the deck while held. */
  hand: string[];
  /** A Fiscal na Porta is on them: no buying, bidding or building until the end of their next turn. */
  fiscal: boolean;
}

/** One per player with the lobby setting on; see skills.ts. */
export type SkillId = 'donoDaCasa' | 'reiDaPracinha' | 'empreiteiro' | 'corretor' | 'malandro' | 'bicheiro';

export interface Ownership { owner: number; houses: number /* 0–4, 5 = prédio */; mortgaged: boolean }

export type Phase =
  | { kind: 'roll' }                         // current player must roll (or act on jail options)
  | { kind: 'buy'; square: number; rollAgain: boolean }          // landed on an unowned ponto/servico
  | { kind: 'rent'; square: number; amount: number; rollAgain: boolean } // owes rent and holds a Calote: pay or skip it
  | { kind: 'manage'; rollAgain: boolean };  // build/trade/etc; then roll again (doubles) or end turn

export interface Debt { debtor: number; creditor: number | null /* null = bank */; amount: number }

export interface OfferSide { assets: number[]; cash: number; lawyerCards: number }
export interface OfferTerms { to: number; give: OfferSide; get: OfferSide }
/** An open offer. A counter-offer replaces it, with `from` and `to` swapped and `counters` one higher. */
export interface Offer extends OfferTerms { from: number; counters: number }

/** Escrituras up for auction, the first one now; one sealed bid per player (null = not yet), revealed when all are in. */
export interface Auction {
  from: number; lots: number[]; bids: (number | null)[];
  /** The escritura `from` just declined to buy (lobby setting), not a bankrupt player's. */
  declined?: boolean;
}

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
  /** Lobby setting: everyone sees the terms of an open offer, not just the two players in it. */
  openTrades: boolean;
  /** The Prefeitura auctioning a bankrupt player's escrituras; nothing else happens until it ends. */
  auction: Auction | null;
  /** Lobby setting: an escritura nobody buys on landing goes to auction. */
  auctionDeclined: boolean;
  /** Lobby setting: the Tigrinho also has cards to keep (a hand of up to HAND_MAX) and play later. */
  pocketCards: boolean;
  /** Test hook: when non-empty, the next roll is taken from here instead of the rng. */
  riggedDice?: [number, number][];
}

export type BairroIntent =
  | { type: 'roll' } | { type: 'buy' } | { type: 'decline' } | { type: 'endTurn' }
  | { type: 'payJailFine' } | { type: 'useLawyer' }
  | { type: 'build'; pos: number } | { type: 'sellBuilding'; pos: number }
  | { type: 'mortgage'; pos: number } | { type: 'unmortgage'; pos: number }
  | { type: 'payDebt' } | { type: 'goBankrupt' }
  | { type: 'proposeTrade'; offer: OfferTerms } | { type: 'cancelTrade' } | { type: 'answerTrade'; accept: boolean }
  | { type: 'counterTrade'; offer: Omit<OfferTerms, 'to'> }
  | { type: 'bid'; amount: number }
  | { type: 'payRent' } | { type: 'useSkill' }
  /** Plays a kept card; the field its kind needs: `die` 1–6, `steps` 1–3, `target` a seat, `pos` a square. */
  | { type: 'playCard'; card: string; die?: number; steps?: number; target?: number; pos?: number };
