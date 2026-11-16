import { describe, expect, it } from 'vitest';
import { screensFor } from './gameScreens';

describe('screensFor', () => {
  it('uses the Dominion screens for dominion', () => {
    expect(screensFor('dominion')).toBe('dominion');
  });

  it('uses the Bairro screens for bairro', () => {
    expect(screensFor('bairro')).toBe('bairro');
  });

  it('has screens for chess, pista, vida and naval', () => {
    expect(['chess', 'pista', 'vida', 'naval', 'zerou', 'velha', 'forca', 'stop'].map((g) => screensFor(g as 'chess'))).toEqual(['chess', 'pista', 'vida', 'naval', 'zerou', 'velha', 'forca', 'stop']);
  });
});
