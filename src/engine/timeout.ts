import type { Game } from './game';
import { randomAnswer } from './randomAnswer';
import type { RngState } from './rng';
import type { GameState, Prompt, PromptAnswer } from './types';

/** Safety net: a turn never needs anywhere near this many forced moves. */
const MAX_FORCED_MOVES = 500;

/** Prompts whose answer can play another card. A timeout always declines them. */
const PLAYS_A_CARD: ReadonlySet<string> = new Set(['throneRoomChoose', 'vassalPlay']);

/** The answer a timed-out player gives: decline anything that would play a card, otherwise random. */
export function timeoutAnswer(prompt: Prompt, rng: RngState): PromptAnswer {
  if (PLAYS_A_CARD.has(prompt.id)) {
    if (prompt.kind === 'chooseCards' && prompt.min === 0) return { kind: 'cards', indices: [] };
    if (prompt.kind === 'chooseOption') {
      const leave = prompt.optionIds.indexOf('leaveIt');
      if (leave >= 0) return { kind: 'option', index: leave };
    }
  }
  return randomAnswer(prompt, rng);
}

/** Prompts still waiting for an answer: the pending one, or the unanswered part of a group. */
export function openPrompts(state: GameState): Prompt[] {
  if (state.pending) return [state.pending];
  const group = state.group;
  return group ? group.prompts.filter((_, i) => group.answers[i] === null) : [];
}

/** Answers every open prompt as a timed-out player (see timeoutAnswer), as the player who owns it. */
export function answerAtRandom(game: Game, rng: RngState): boolean {
  const open = openPrompts(game.state);
  let answered = false;
  for (const p of open) {
    const owner = game.state.players[p.player].id;
    answered = game.apply(owner, { type: 'answerPrompt', answer: timeoutAnswer(p, rng) }).ok || answered;
  }
  return answered;
}

/** Ends the current turn: timeout answers for open prompts, then End Phase until the next player is up. Never plays or buys. */
export function finishTurn(game: Game, rng: RngState): void {
  const s = game.state;
  const turn = s.turn;
  for (let i = 0; i < MAX_FORCED_MOVES && !s.result && s.turn === turn; i++) {
    if (s.pending || s.group) answerAtRandom(game, rng);
    else game.apply(s.players[turn.player].id, { type: 'endPhase' });
  }
}
