import type { GameId } from './catalog';
import { dominionModule } from './dominion/module';
import type { GameModule } from './module';

/** Every game the host can run; a game without a module is not playable yet. */
export const MODULES: Partial<Record<GameId, GameModule>> = { dominion: dominionModule };

export function moduleFor(id: GameId): GameModule {
  const module = MODULES[id];
  if (!module) throw new Error(`No module for game ${id}`);
  return module;
}
