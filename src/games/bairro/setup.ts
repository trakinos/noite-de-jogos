import { createRng, shuffle } from '../../engine/rng';
import type { SeatInfo } from '../module';
import { START_MONEY } from './board';
import { deckIds } from './deck';
import { log } from './ops';
import { SKILLS } from './skills';
import type { BairroPlayer, BairroState } from './types';

/** The lobby settings the rules read; anything left out is off. */
export interface BairroRuleOptions {
  openTrades?: boolean;
  auctionDeclined?: boolean;
  skills?: boolean;
  pocketCards?: boolean;
}

export function createBairro(seats: SeatInfo[], seed: number, options: BairroRuleOptions = {}): BairroState {
  const rng = createRng(seed);
  const players = shuffle(rng, seats).map((seat): BairroPlayer => ({
    id: seat.id, name: seat.name, cash: START_MONEY, pos: 0, jailTurns: null, lawyerCards: 0, bankrupt: false,
    skill: null, skillUsed: false, hand: [], fiscal: false,
  }));
  const pocketCards = options.pocketCards ?? false;
  const s: BairroState = {
    players, current: 0, phase: { kind: 'roll' },
    owned: {}, deck: shuffle(rng, deckIds(pocketCards)),
    doublesInRow: 0, lastRoll: null,
    debts: [], offer: null,
    bankruptOrder: [], log: [], rng, winner: null, turnNumber: 0, tradesThisTurn: 0,
    openTrades: options.openTrades ?? false,
    auction: null,
    auctionDeclined: options.auctionDeclined ?? false,
    pocketCards,
  };
  // Dealt after the deck, so games without skills shuffle exactly as before. Six skills for up to six players: all different.
  if (options.skills) {
    const dealt = shuffle(rng, [...SKILLS]);
    players.forEach((p, i) => {
      p.skill = dealt[i % dealt.length]!;
      log(s, i, 'skillDealt', { skill: p.skill });
    });
  }
  return s;
}
