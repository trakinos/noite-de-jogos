import type { CardId, GameResult, GameState, LogEntry, Prompt, TurnState } from './types';

export interface PublicPlayer {
  id: string;
  name: string;
  handCount: number;
  deckCount: number;
  discardCount: number;
  discardTop: CardId | null;
  inPlay: CardId[];
}

export interface PlayerView {
  you: number;
  players: PublicPlayer[];
  hand: CardId[];
  supply: Record<CardId, number>;
  kingdom: CardId[];
  trash: CardId[];
  turn: TurnState;
  /** The pending prompt, only when this player must answer it. */
  prompt: Prompt | null;
  /** Set when another player must answer a prompt. */
  waitingOn: { player: number; message: string; id: string; params?: Record<string, string | number> } | null;
  /** Players answering at the same time (an attack): who still has to choose. Visible to everyone. */
  group: { card: CardId | null; players: { player: number; done: boolean }[] } | null;
  log: LogEntry[];
  result: GameResult | null;
}

export function viewFor(state: GameState, playerId: string): PlayerView {
  const you = state.players.findIndex((p) => p.id === playerId);
  if (you < 0) throw new Error(`Unknown player: ${playerId}`);
  const pending = state.pending;
  const group = state.group;
  const mine = group?.prompts.findIndex((p, i) => p.player === you && group.answers[i] === null) ?? -1;
  const view: PlayerView = {
    you,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      deckCount: p.deck.length,
      discardCount: p.discard.length,
      discardTop: p.discard.length > 0 ? p.discard[p.discard.length - 1] : null,
      inPlay: p.inPlay,
    })),
    hand: state.players[you].hand,
    supply: state.supply,
    kingdom: state.kingdom,
    trash: state.trash,
    turn: state.turn,
    prompt: pending && pending.player === you ? pending : group && mine >= 0 ? group.prompts[mine] : null,
    waitingOn:
      pending && pending.player !== you
        ? {
            player: pending.player,
            message: pending.message,
            id: pending.id,
            ...(pending.params && { params: pending.params }),
          }
        : null,
    group: group && {
      card: group.card,
      players: group.prompts.map((p, i) => ({ player: p.player, done: group.answers[i] !== null })),
    },
    log: state.log,
    result: state.result,
  };
  return structuredClone(view);
}
