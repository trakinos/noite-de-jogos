import type { UiKey } from '../i18n';

export type GameId = 'dominion' | 'bairro';

export interface GameInfo {
  id: GameId;
  nameKey: UiKey;
  tagKey: UiKey;
  minPlayers: number;
  maxPlayers: number;
  lengthKey: UiKey;
  available: boolean;
}

/** Games offered on the front page, in display order. */
export const GAMES: readonly GameInfo[] = [
  { id: 'dominion', nameKey: 'gameDominionName', tagKey: 'gameDominionTag', minPlayers: 2, maxPlayers: 4, lengthKey: 'gameDominionLength', available: true },
  { id: 'bairro', nameKey: 'gameBairroName', tagKey: 'gameBairroTag', minPlayers: 2, maxPlayers: 6, lengthKey: 'gameBairroLength', available: false },
];

export function isGameId(x: unknown): x is GameId {
  return GAMES.some((g) => g.id === x);
}
