import { describe, expect, it } from 'vitest';
import { screensFor } from './gameScreens';

describe('screensFor', () => {
  it('uses the Dominion screens for dominion', () => {
    expect(screensFor('dominion')).toBe('dominion');
  });

  it('uses the Bairro screens for bairro', () => {
    expect(screensFor('bairro')).toBe('bairro');
  });
});
