import type { GameId } from './catalog';
import { bairroModule } from './bairro/module';
import { chessModule } from './chess/game';
import { dominionModule } from './dominion/module';
import { navalModule } from './naval/game';
import { pistaModule } from './pista/game';
import { vidaModule } from './vida/game';
import type { GameModule } from './module';

/** Every game the host can run; a game without a module is not playable yet. */
export const MODULES: Partial<Record<GameId, GameModule>> = {
  dominion: dominionModule,
  bairro: bairroModule,
  chess: chessModule,
  pista: pistaModule,
  vida: vidaModule,
  naval: navalModule,
};

export function moduleFor(id: GameId): GameModule {
  const module = MODULES[id];
  if (!module) throw new Error(`No module for game ${id}`);
  return module;
}
