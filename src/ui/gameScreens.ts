import type { GameId } from '../games/catalog';

/** Which set of screens renders a room's game. 'unsupported' means this build has none for it. */
export function screensFor(game: GameId): 'dominion' | 'unsupported' {
  return game === 'dominion' ? 'dominion' : 'unsupported';
}
