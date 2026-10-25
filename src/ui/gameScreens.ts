import type { GameId } from '../games/catalog';

/** Which set of screens renders a room's game. 'unsupported' means this build has none for it. */
export function screensFor(game: GameId): 'dominion' | 'bairro' | 'unsupported' {
  if (game === 'dominion') return 'dominion';
  if (game === 'bairro') return 'bairro';
  return 'unsupported';
}
