import type { UiKey } from '../i18n';

export type GameId = 'dominion' | 'bairro' | 'chess' | 'pista' | 'vida' | 'naval' | 'zerou' | 'velha' | 'forca' | 'stop' | 'sudoku' | 'catan';

export interface GameInfo {
  id: GameId;
  nameKey: UiKey;
  tagKey: UiKey;
  minPlayers: number;
  maxPlayers: number;
  lengthKey: UiKey;
  available: boolean;
  /** Semver of the game itself; bump it when the game changes (see the bump-game-versions skill). */
  version: string;
}

/** Games offered on the front page, in display order. */
export const GAMES: readonly GameInfo[] = [
  { id: 'dominion', nameKey: 'gameDominionName', tagKey: 'gameDominionTag', minPlayers: 2, maxPlayers: 4, lengthKey: 'gameDominionLength', available: true, version: '0.1.0' },
  { id: 'bairro', nameKey: 'gameBairroName', tagKey: 'gameBairroTag', minPlayers: 2, maxPlayers: 6, lengthKey: 'gameBairroLength', available: true, version: '0.1.0' },
  { id: 'chess', nameKey: 'gameChessName', tagKey: 'gameChessTag', minPlayers: 2, maxPlayers: 2, lengthKey: 'gameChessLength', available: true, version: '0.1.0' },
  { id: 'pista', nameKey: 'gamePistaName', tagKey: 'gamePistaTag', minPlayers: 2, maxPlayers: 8, lengthKey: 'gamePistaLength', available: true, version: '0.1.0' },
  { id: 'vida', nameKey: 'gameVidaName', tagKey: 'gameVidaTag', minPlayers: 2, maxPlayers: 6, lengthKey: 'gameVidaLength', available: true, version: '0.1.0' },
  { id: 'naval', nameKey: 'gameNavalName', tagKey: 'gameNavalTag', minPlayers: 2, maxPlayers: 2, lengthKey: 'gameNavalLength', available: true, version: '0.1.0' },
  { id: 'zerou', nameKey: 'gameZerouName', tagKey: 'gameZerouTag', minPlayers: 2, maxPlayers: 8, lengthKey: 'gameZerouLength', available: true, version: '0.1.0' },
  { id: 'velha', nameKey: 'gameVelhaName', tagKey: 'gameVelhaTag', minPlayers: 2, maxPlayers: 2, lengthKey: 'gameVelhaLength', available: true, version: '0.1.0' },
  { id: 'forca', nameKey: 'gameForcaName', tagKey: 'gameForcaTag', minPlayers: 2, maxPlayers: 8, lengthKey: 'gameForcaLength', available: true, version: '0.1.0' },
  { id: 'stop', nameKey: 'gameStopName', tagKey: 'gameStopTag', minPlayers: 2, maxPlayers: 8, lengthKey: 'gameStopLength', available: true, version: '0.1.0' },
  { id: 'sudoku', nameKey: 'gameSudokuName', tagKey: 'gameSudokuTag', minPlayers: 1, maxPlayers: 8, lengthKey: 'gameSudokuLength', available: true, version: '0.1.0' },
  { id: 'catan', nameKey: 'gameCatanName', tagKey: 'gameCatanTag', minPlayers: 3, maxPlayers: 4, lengthKey: 'gameCatanLength', available: true, version: '0.1.0' },
];

export function isGameId(x: unknown): x is GameId {
  return GAMES.some((g) => g.id === x);
}
