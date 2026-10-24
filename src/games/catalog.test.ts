import { describe, it, expect } from 'vitest';
import { DICTIONARIES } from '../i18n';
import { GAMES, isGameId } from './catalog';

describe('game catalog', () => {
  it('lists Dominion first and playable, Dono do Bairro as coming soon', () => {
    expect(GAMES.map((g) => [g.id, g.available, g.minPlayers, g.maxPlayers])).toEqual([
      ['dominion', true, 2, 4],
      ['bairro', false, 2, 6],
    ]);
  });

  it('recognises game ids', () => {
    expect(isGameId('dominion')).toBe(true);
    expect(isGameId('bairro')).toBe(true);
    expect(isGameId('monopoly')).toBe(false);
    expect(isGameId(undefined)).toBe(false);
  });

  it('every catalog key exists in both dictionaries', () => {
    for (const g of GAMES) for (const k of [g.nameKey, g.tagKey, g.lengthKey]) {
      expect(DICTIONARIES.pt.ui[k]).toBeTruthy();
      expect(DICTIONARIES.en.ui[k]).toBeTruthy();
    }
  });
});
