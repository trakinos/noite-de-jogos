import { describe, it, expect } from 'vitest';
import { Game } from '../engine/game';
import { answerOption, newState, setZones } from '../engine/testkit';
import { viewFor } from '../engine/view';
import { boardSounds } from './boardSounds';
import { latestAttack } from './attacks';

function militia() {
  const state = newState({ players: 3 });
  setZones(state, 0, { hand: ['militia', 'estate', 'estate', 'estate', 'estate'], deck: Array(5).fill('estate'), discard: [] });
  setZones(state, 1, { hand: ['moat', 'copper', 'copper', 'copper', 'copper'], deck: [], discard: [] });
  setZones(state, 2, { hand: ['copper', 'copper', 'copper', 'copper', 'copper'], deck: [], discard: [] });
  const g = new Game(state);
  g.apply('p0', { type: 'playAction', handIndex: 0 });
  return { state, g };
}

describe('latestAttack', () => {
  it('marks who was hit and who defended with a Moat', () => {
    const { state, g } = militia();
    expect(latestAttack(viewFor(state, 'p0'))).toMatchObject({ card: 'militia', attacker: 0, outcomes: { 1: 'hit', 2: 'hit' } });
    g.apply('p1', answerOption(0));
    expect(latestAttack(viewFor(state, 'p2'))?.outcomes).toEqual({ 1: 'blocked', 2: 'hit' });
  });

  it('is null when no attack was played', () => {
    expect(latestAttack(viewFor(newState({ players: 3 }), 'p0'))).toBeNull();
  });

  it('plays a block clang when a Moat stops the attack', () => {
    const { state, g } = militia();
    const before = viewFor(state, 'p2');
    g.apply('p1', answerOption(0));
    expect(boardSounds(before, viewFor(state, 'p2')).map((c) => c.sound)).toContain('block');
  });
});

describe('boardSounds extras', () => {
  it('plays a pile-out sound when a pile empties', () => {
    const state = newState();
    setZones(state, 0, { hand: [], deck: [], discard: [] });
    state.turn.phase = 'buy';
    state.turn.coins = 3;
    state.supply.silver = 1;
    const before = viewFor(state, 'p0');
    new Game(state).apply('p0', { type: 'buy', card: 'silver' });
    expect(boardSounds(before, viewFor(state, 'p0')).map((c) => c.sound)).toEqual(expect.arrayContaining(['buy', 'pileout']));
  });
});
