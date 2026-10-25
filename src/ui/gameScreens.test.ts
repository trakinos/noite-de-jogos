import { describe, expect, it } from 'vitest';
import { screensFor } from './gameScreens';

describe('screensFor', () => {
  it('uses the Dominion screens for dominion', () => {
    expect(screensFor('dominion')).toBe('dominion');
  });

  it('has no screens yet for bairro', () => {
    expect(screensFor('bairro')).toBe('unsupported');
  });
});
