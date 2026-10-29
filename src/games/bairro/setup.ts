import { createRng, shuffle } from '../../engine/rng';
import type { SeatInfo } from '../module';
import { START_MONEY } from './board';
import { DECK } from './deck';
import type { BairroState } from './types';

export function createBairro(seats: SeatInfo[], seed: number, options: { openTrades?: boolean } = {}): BairroState {
  const rng = createRng(seed);
  const players = shuffle(rng, seats).map(seat => ({
    id: seat.id, name: seat.name, cash: START_MONEY, pos: 0, jailTurns: null, lawyerCards: 0, bankrupt: false,
  }));
  return {
    players, current: 0, phase: { kind: 'roll' },
    owned: {}, deck: shuffle(rng, DECK.map(c => c.id)),
    doublesInRow: 0, lastRoll: null,
    debts: [], offer: null,
    bankruptOrder: [], log: [], rng, winner: null, turnNumber: 0, tradesThisTurn: 0,
    openTrades: options.openTrades ?? false,
    auction: null,
  };
}
