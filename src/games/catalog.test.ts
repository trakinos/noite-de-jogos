import { describe, it, expect } from 'vitest';
import { DICTIONARIES } from '../i18n';
import { GAMES, isGameId } from './catalog';

describe('game catalog', () => {
  it('lists every game in front-page order, all playable', () => {
    expect(GAMES.map((g) => [g.id, g.available, g.minPlayers, g.maxPlayers])).toEqual([
      ['dominion', true, 2, 4],
      ['bairro', true, 2, 6],
      ['chess', true, 2, 2],
      ['pista', true, 2, 8],
      ['vida', true, 2, 6],
      ['naval', true, 2, 2],
      ['zerou', true, 2, 8],
      ['velha', true, 2, 2],
      ['forca', true, 2, 8],
      ['stop', true, 2, 8],
      ['sudoku', true, 1, 8],
      ['catan', true, 3, 4],
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
