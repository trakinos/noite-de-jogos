import { describe, expect, it } from 'vitest';
import { DEFAULT_KINGDOM } from '../../cards/registry';
import { dominionModule } from './module';

const seats = [
  { id: 'p0', name: 'Ana' },
  { id: 'p1', name: 'Bruno' },
];

describe('dominionModule', () => {
  it('declares its id and player range', () => {
    expect(dominionModule.id).toBe('dominion');
    expect([dominionModule.minPlayers, dominionModule.maxPlayers]).toEqual([2, 4]);
  });

  it('defaults to the default kingdom', () => {
    expect(dominionModule.defaultOptions().kingdom).toEqual(DEFAULT_KINGDOM);
  });

  it('refuses a kingdom that is not 10 different cards', () => {
    const nine = DEFAULT_KINGDOM.slice(0, 9);
    expect(dominionModule.parseOptions({ kingdom: nine })).toEqual({ error: 'Choose 10 different kingdom cards' });
    expect(dominionModule.parseOptions({ kingdom: [...nine, nine[0]] })).toEqual({ error: 'Choose 10 different kingdom cards' });
    expect(dominionModule.parseOptions(null)).toEqual({ error: 'Choose 10 different kingdom cards' });
  });

  it('accepts a valid kingdom', () => {
    expect(dominionModule.parseOptions({ kingdom: DEFAULT_KINGDOM })).toEqual({ kingdom: DEFAULT_KINGDOM });
  });

  it('deals each seat a hand of 5', () => {
    const game = dominionModule.create(seats, dominionModule.defaultOptions(), 1);
    expect(game.viewFor('p0').log).toBeInstanceOf(Array);
    expect((game.viewFor('p0') as unknown as { hand: unknown[] }).hand.length).toBe(5);
  });

  it('refuses an intent out of turn', () => {
    const game = dominionModule.create(seats, dominionModule.defaultOptions(), 1);
    expect(game.apply('p1', { type: 'endPhase' })).toEqual({ ok: false, reason: 'It is not your turn' });
  });

  it('expire(turn) passes the turn on', () => {
    const game = dominionModule.create(seats, dominionModule.defaultOptions(), 1);
    expect(game.clockInput().currentPlayer).toBe(0);
    expect(game.over).toBe(false);
    game.expire('turn', 1);
    expect(game.clockInput().currentPlayer).toBe(1);
  });
});
