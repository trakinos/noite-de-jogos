import type { UiKey } from '../i18n';

export type GameId = 'dominion' | 'bairro' | 'chess' | 'pista' | 'vida' | 'naval';

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
  { id: 'bairro', nameKey: 'gameBairroName', tagKey: 'gameBairroTag', minPlayers: 2, maxPlayers: 6, lengthKey: 'gameBairroLength', available: true },
  { id: 'chess', nameKey: 'gameChessName', tagKey: 'gameChessTag', minPlayers: 2, maxPlayers: 2, lengthKey: 'gameChessLength', available: true },
  { id: 'pista', nameKey: 'gamePistaName', tagKey: 'gamePistaTag', minPlayers: 4, maxPlayers: 8, lengthKey: 'gamePistaLength', available: true },
  { id: 'vida', nameKey: 'gameVidaName', tagKey: 'gameVidaTag', minPlayers: 2, maxPlayers: 6, lengthKey: 'gameVidaLength', available: true },
  { id: 'naval', nameKey: 'gameNavalName', tagKey: 'gameNavalTag', minPlayers: 2, maxPlayers: 2, lengthKey: 'gameNavalLength', available: true },
];

export function isGameId(x: unknown): x is GameId {
  return GAMES.some((g) => g.id === x);
}
