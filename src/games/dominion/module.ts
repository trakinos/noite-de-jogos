import { DEFAULT_KINGDOM, KINGDOM_IDS } from '../../cards/registry';
import { Game } from '../../engine/game';
import { createRng } from '../../engine/rng';
import { answerAtRandom, finishTurn, openPrompts } from '../../engine/timeout';
import type { CardId, Intent } from '../../engine/types';
import { viewFor, type PlayerView } from '../../engine/view';
import type { ClockInput, ClockKind } from '../../net/turnClock';
import type { GameInstance, GameModule, SeatInfo } from '../module';

/** The one place Dominion's screens narrow the host's untyped view. */
export function asDominionView(v: unknown): PlayerView {
  return v as PlayerView;
}

export interface DominionOptions {
  kingdom: CardId[];
}

export class DominionInstance implements GameInstance {
  constructor(readonly game: Game) {}

  apply(playerId: string, intent: unknown) {
    return this.game.apply(playerId, intent as Intent);
  }

  viewFor(playerId: string) {
    return viewFor(this.game.state, playerId);
  }

  clockInput(): ClockInput {
    const s = this.game.state;
    return { turn: s.turn, currentPlayer: s.turn.player, pending: s.pending, group: s.group, over: s.result !== null };
  }

  get over(): boolean {
    return this.game.state.result !== null;
  }

  /** Time ran out: answer the pending prompt at random, or end the turn without playing or buying. */
  expire(kind: ClockKind, seed: number): void {
    const game = this.game;
    if (game.state.result) return;
    const s = game.state;
    const rng = createRng(seed);
    if (kind === 'response') {
      for (const p of openPrompts(s)) game.note(p.player, 'timeout: random answer');
      answerAtRandom(game, rng);
    } else {
      game.note(s.turn.player, 'timeout: turn ended');
      finishTurn(game, rng);
    }
  }
}

export const dominionModule: GameModule<DominionOptions> = {
  id: 'dominion',
  minPlayers: 2,
  maxPlayers: 4,
  defaultOptions: () => ({ kingdom: [...DEFAULT_KINGDOM] }),
  parseOptions(raw) {
    const kingdom = (raw as { kingdom?: unknown } | null)?.kingdom;
    const valid =
      Array.isArray(kingdom) &&
      kingdom.length === 10 &&
      new Set(kingdom).size === 10 &&
      kingdom.every((id) => KINGDOM_IDS.includes(id));
    if (!valid) return { error: 'Choose 10 different kingdom cards' };
    return { kingdom: [...(kingdom as CardId[])] };
  },
  create(seats: SeatInfo[], options, seed) {
    const game = Game.create({ players: seats.map((s) => ({ id: s.id, name: s.name })), kingdom: options.kingdom, seed });
    return new DominionInstance(game);
  },
};
