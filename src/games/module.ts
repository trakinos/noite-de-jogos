import type { ClockInput, ClockKind } from '../net/turnClock';
import type { GameId } from './catalog';

export interface SeatInfo {
  id: string;
  name: string;
}

/** Structurally identical to the Dominion engine's ApplyResult, so its results pass through unchanged. */
export type ApplyResult = { ok: true } | { ok: false; reason: string };

/** One running game, as the host sees it. */
export interface GameInstance {
  apply(playerId: string, intent: unknown): ApplyResult;
  /** This player's view; must include `log` as an array the host trims to MAX_LOG_ENTRIES. */
  viewFor(playerId: string): { log: unknown[] };
  clockInput(): ClockInput;
  readonly over: boolean;
  /** Time ran out for `kind`: make the cautious move(s). */
  expire(kind: ClockKind, seed: number): void;
}

/** What a game provides so the host can run it without knowing its rules. */
export interface GameModule<Options = unknown> {
  id: GameId;
  minPlayers: number;
  maxPlayers: number;
  defaultOptions(): Options;
  /** Validates options sent from the host's lobby UI; returns the clean options or a refusal reason. */
  parseOptions(raw: unknown): Options | { error: string };
  create(seats: SeatInfo[], options: Options, seed: number): GameInstance;
}
