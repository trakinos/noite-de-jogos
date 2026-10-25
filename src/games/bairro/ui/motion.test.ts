import { describe, expect, it } from 'vitest';
import { apply } from '../engine';
import { game, rig } from '../testkit';
import { viewFor } from '../view';
import { movesBetween, rolledBetween, withPositions } from './motion';

describe('movesBetween', () => {
  it('walks a normal move square by square', () => {
    const s = game(2);
    const before = viewFor(s, 0);
    s.players[0].pos = 4;
    expect(movesBetween(before, viewFor(s, 0))).toEqual([{ player: 0, from: 0, to: 4, steps: [1, 2, 3, 4] }]);
  });

  it('wraps past square 0', () => {
    const s = game(2);
    s.players[1].pos = 38;
    const before = viewFor(s, 0);
    s.players[1].pos = 3;
    expect(movesBetween(before, viewFor(s, 0))).toEqual([{ player: 1, from: 38, to: 3, steps: [39, 0, 1, 2, 3] }]);
  });

  it('jumps straight to the Xilindró', () => {
    const s = game(2);
    s.players[0].pos = 28;
    rig(s, [[1, 1]]);
    const before = viewFor(s, 0);
    apply(s, 0, { type: 'roll' });
    expect(s.players[0].pos).toBe(10);
    expect(movesBetween(before, viewFor(s, 0))).toEqual([{ player: 0, from: 28, to: 10, steps: [10] }]);
  });

  it('jumps when a move is longer than any roll', () => {
    const s = game(2);
    s.players[0].pos = 25;
    const before = viewFor(s, 0);
    s.players[0].pos = 0;
    expect(movesBetween(before, viewFor(s, 0))).toEqual([{ player: 0, from: 25, to: 0, steps: [0] }]);
  });

  it('is empty when nobody moved', () => {
    const s = game(2);
    expect(movesBetween(viewFor(s, 0), viewFor(s, 0))).toEqual([]);
  });

  it('is empty for a different game size', () => {
    expect(movesBetween(viewFor(game(2), 0), viewFor(game(3), 0))).toEqual([]);
  });
});

describe('rolledBetween', () => {
  it('is true only when a new roll was logged', () => {
    const s = game(2);
    rig(s, [[1, 2]]);
    const before = viewFor(s, 0);
    expect(rolledBetween(before, viewFor(s, 0))).toBe(false);
    apply(s, 0, { type: 'roll' });
    expect(rolledBetween(before, viewFor(s, 0))).toBe(true);
    expect(rolledBetween(viewFor(s, 0), viewFor(s, 0))).toBe(false);
  });
});

describe('withPositions', () => {
  it('replaces only the positions', () => {
    const v = viewFor(game(2), 0);
    const shown = withPositions(v, [7, 9]);
    expect(shown.players.map(p => p.pos)).toEqual([7, 9]);
    expect(v.players.map(p => p.pos)).toEqual([0, 0]);
    expect(shown.players[0].cash).toBe(v.players[0].cash);
  });
});
