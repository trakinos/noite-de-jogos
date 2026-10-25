import { describe, it, expect } from 'vitest';
import { runSimulation } from './simkit';

describe('bot simulation', () => {
  it('200 seeded games of 2–6 bots end with a winner or at 5,000 turns, with every invariant held', () => {
    const stats = runSimulation(200, 5000);
    expect(stats.violations).toEqual([]);
    expect(stats.games).toBe(200);
    expect(stats.winners).toBeGreaterThan(stats.games / 2);
  });
});
