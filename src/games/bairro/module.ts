import type { ClockInput, ClockKind } from '../../net/turnClock';
import type { GameInstance, GameModule, SeatInfo } from '../module';
import { apply } from './engine';
import { createBairro } from './setup';
import { expire } from './timeout';
import type { BairroIntent, BairroState } from './types';
import { viewFor } from './view';

/** Keeps one object per key, so the clock sees the same identity until the key changes. */
class Identity<T extends object> {
  private key: string | null = null;
  private value: T | null = null;

  of(key: string, make: () => T): T {
    if (key !== this.key) {
      this.key = key;
      this.value = make();
    }
    return this.value!;
  }
}

export class BairroInstance implements GameInstance {
  private readonly turns = new Identity<object>();
  private readonly prompts = new Identity<{ player: number }>();
  private readonly groups = new Identity<object>();

  constructor(readonly state: BairroState) {}

  private seat(playerId: string): number {
    return this.state.players.findIndex(p => p.id === playerId);
  }

  apply(playerId: string, intent: unknown) {
    // An unknown id gets seat -1, which every gate refuses.
    return apply(this.state, this.seat(playerId), intent as BairroIntent);
  }

  viewFor(playerId: string) {
    const seat = this.seat(playerId);
    if (seat < 0) throw new Error(`Unknown player: ${playerId}`);
    return viewFor(this.state, seat);
  }

  /** A new turn object per turnNumber; the trade recipient or a lone off-turn debtor is pending; 2+ off-turn debtors are a group. */
  clockInput(): ClockInput {
    const s = this.state;
    const over = s.winner !== null;
    const turn = this.turns.of(String(s.turnNumber), () => ({}));
    let pending: { player: number } | null = null;
    let group: object | null = null;
    if (!over && s.offer) {
      const to = s.offer.to;
      pending = this.prompts.of(`offer ${s.turnNumber} ${JSON.stringify(s.offer)}`, () => ({ player: to }));
    } else if (!over) {
      const offTurn = [...new Set(s.debts.map(d => d.debtor))].filter(d => d !== s.current);
      const key = `debts ${s.turnNumber} ${JSON.stringify(s.debts)}`;
      if (offTurn.length === 1) pending = this.prompts.of(key, () => ({ player: offTurn[0] }));
      else if (offTurn.length > 1) group = this.groups.of(key, () => ({}));
    }
    return { turn, currentPlayer: s.current, pending, group, over };
  }

  get over(): boolean {
    return this.state.winner !== null;
  }

  /** The bairro has no randomness of its own in a timeout: the dice come from the state's rng. */
  expire(kind: ClockKind, _seed: number): void {
    expire(this.state, kind);
  }
}

/** The Dono do Bairro has no lobby options. */
export type BairroOptions = Record<string, never>;

export const bairroModule: GameModule<BairroOptions> = {
  id: 'bairro',
  minPlayers: 2,
  maxPlayers: 6,
  defaultOptions: () => ({}),
  parseOptions(raw): BairroOptions | { error: string } {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Bad options' };
    return {};
  },
  create(seats: SeatInfo[], _options, seed) {
    return new BairroInstance(createBairro(seats, seed));
  },
};
