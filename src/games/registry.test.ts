import { describe, it, expect } from 'vitest';
import { GAMES } from './catalog';
import { MODULES } from './registry';

describe('module registry', () => {
  it('every registered module agrees with its catalog entry on the player range', () => {
    for (const [id, module] of Object.entries(MODULES)) {
      const info = GAMES.find((g) => g.id === id)!;
      expect([module.minPlayers, module.maxPlayers], id).toEqual([info.minPlayers, info.maxPlayers]);
    }
  });
});
