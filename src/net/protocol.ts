import type { Intent } from '../engine/types';
import { isPlayerColor, type PlayerColorId } from '../theme/playerColors';
import { GAMES, isGameId, type GameId } from '../games/catalog';
import type { ClockInfo } from './turnClock';

export interface LobbyPlayer {
  id: string;
  name: string;
  online: boolean;
  color: PlayerColorId;
}

export interface LobbyState {
  game: GameId;
  hostId: string;
  players: LobbyPlayer[];
  /** Game-specific settings; each game's lobby UI narrows this to its own options type. */
  options: unknown;
  inGame: boolean;
  turnTimer: number | null;
  minPlayers: number;
  maxPlayers: number;
  /** Deploy-compat: Dominion hosts also send options.kingdom here for already-open old clients. Drop later. */
  kingdom?: unknown;
}

export type GuestMessage =
  | { type: 'hello'; name: string; token: string | null }
  | { type: 'intent'; intent: Intent }
  | { type: 'setColor'; color: PlayerColorId };

export type HostMessage =
  | { type: 'welcome'; playerId: string; token: string }
  | { type: 'lobby'; lobby: LobbyState }
  | { type: 'view'; view: unknown; clock: ClockInfo | null }
  | { type: 'error'; reason: string };

export const MAX_NAME_LENGTH = 20;
const MAX_TOKEN_LENGTH = 64;

export function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim().slice(0, MAX_NAME_LENGTH) : '';
  return name || 'Player';
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Validates the envelope of a guest message. Intent contents are validated by the engine. */
export function parseGuestMessage(raw: unknown): GuestMessage | null {
  if (!isRecord(raw)) return null;
  if (raw.type === 'hello') {
    const token = typeof raw.token === 'string' && raw.token.length <= MAX_TOKEN_LENGTH ? raw.token : null;
    return { type: 'hello', name: cleanName(raw.name), token };
  }
  if (raw.type === 'intent' && isRecord(raw.intent) && typeof raw.intent.type === 'string') {
    return { type: 'intent', intent: raw.intent as unknown as Intent };
  }
  if (raw.type === 'setColor' && isPlayerColor(raw.color)) return { type: 'setColor', color: raw.color };
  return null;
}

/** Fills in what a host from before the game/options/min/max fields left out; such a host only ever ran Dominion. */
function parseLobby(raw: Record<string, unknown>): LobbyState {
  const game: GameId = isGameId(raw.game) ? raw.game : 'dominion';
  const info = GAMES.find((g) => g.id === game)!;
  const options = 'options' in raw && raw.options !== undefined ? raw.options : Array.isArray(raw.kingdom) ? { kingdom: raw.kingdom } : raw.options;
  return {
    ...(raw as unknown as LobbyState),
    game,
    options,
    minPlayers: typeof raw.minPlayers === 'number' ? raw.minPlayers : info.minPlayers,
    maxPlayers: typeof raw.maxPlayers === 'number' ? raw.maxPlayers : info.maxPlayers,
  };
}

export function parseHostMessage(raw: unknown): HostMessage | null {
  if (!isRecord(raw)) return null;
  switch (raw.type) {
    case 'welcome':
      return typeof raw.playerId === 'string' && typeof raw.token === 'string'
        ? { type: 'welcome', playerId: raw.playerId, token: raw.token }
        : null;
    case 'lobby':
      if (!isRecord(raw.lobby)) return null;
      return { type: 'lobby', lobby: parseLobby(raw.lobby) };
    case 'view':
      return isRecord(raw.view) ? { type: 'view', view: raw.view, clock: parseClock(raw.clock) } : null;
    case 'error':
      return typeof raw.reason === 'string' ? { type: 'error', reason: raw.reason } : null;
    default:
      return null;
  }
}

function parseClock(raw: unknown): ClockInfo | null {
  if (!isRecord(raw) || (raw.kind !== 'turn' && raw.kind !== 'response')) return null;
  const { remainingMs, totalMs } = raw;
  return typeof remainingMs === 'number' && typeof totalMs === 'number' ? { kind: raw.kind, remainingMs, totalMs } : null;
}
