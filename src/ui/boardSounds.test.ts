import { describe, it, expect } from 'vitest';
import { Game } from '../engine/game';
import { answerCards, newState, setZones } from '../engine/testkit';
import type { GameState, Intent } from '../engine/types';
import { viewFor } from '../engine/view';
import { boardSounds } from './boardSounds';

const ESTATES = ['estate', 'estate', 'estate', 'estate', 'estate', 'estate'];

/** The sounds each player hears after p0 applies the intents. */
function after(state: GameState, ...intents: Intent[]) {
  const before = [viewFor(state, 'p0'), viewFor(state, 'p1')];
  const game = new Game(state);
  for (const intent of intents) expect(game.apply('p0', intent)).toEqual({ ok: true });
  const names = (i: number) => boardSounds(before[i], viewFor(state, i === 0 ? 'p0' : 'p1')).map((c) => c.sound);
  return { mine: names(0), theirs: names(1) };
}

describe('boardSounds', () => {
  it('plays a snap for an Action and a draw for the cards it brings', () => {
    const state = newState();
    setZones(state, 0, { hand: ['smithy', 'copper'], deck: ESTATES, discard: [] });
    const { mine, theirs } = after(state, { type: 'playAction', handIndex: 0 });
    expect(mine).toEqual(['card', 'draw']);
    expect(theirs).toEqual(['card']);
  });

  it('plays a coin per Treasure', () => {
    const state = newState();
    setZones(state, 0, { hand: ['copper', 'silver'], deck: ESTATES, discard: [] });
    state.turn.phase = 'buy';
    expect(after(state, { type: 'playAllTreasures' }).mine).toEqual(['coin', 'coin']);
  });

  it('plays a discard, then a trash, for cards thrown away and cards trashed', () => {
    const state = newState();
    setZones(state, 0, { hand: ['chapel', 'estate', 'copper'], deck: ESTATES, discard: [] });
    const { mine } = after(state, { type: 'playAction', handIndex: 0 }, answerCards([0, 1]));
    expect(mine).toContain('trash');
    expect(mine).not.toContain('discard');
  });

  it('plays a buy sound when a card is bought', () => {
    const state = newState();
    setZones(state, 0, { hand: [], deck: ESTATES, discard: [] });
    state.turn.phase = 'buy';
    state.turn.coins = 3;
    expect(after(state, { type: 'buy', card: 'silver' }).mine).toEqual(['buy']);
  });

  it('discards, draws, then chimes at the start of your turn', () => {
    const state = newState();
    setZones(state, 0, { hand: ['estate'], inPlay: ['silver'], deck: ESTATES, discard: [] });
    state.turn.phase = 'buy';
    const { mine, theirs } = after(state, { type: 'endPhase' });
    expect(mine).toEqual(['discard', 'draw']);
    expect(theirs).toEqual(['discard', 'turn']);
  });
});
