import { describe, it, expect } from 'vitest';
import { BOARD, RUAS, unmortgageCost, type PontoSquare } from './board';
import { DECK, deckIds } from './deck';

const pontos = BOARD.filter((s): s is PontoSquare => s.kind === 'ponto');

describe('board', () => {
  it('has 40 squares with the expected kinds', () => {
    expect(BOARD).toHaveLength(40);
    expect(pontos).toHaveLength(22);
    expect(BOARD.filter(s => s.kind === 'servico')).toHaveLength(6);
    expect(BOARD.filter(s => s.kind === 'luck')).toHaveLength(6);
  });

  it('RUAS covers every ponto exactly once with the right sizes', () => {
    const ids = Object.values(RUAS).flat();
    expect(ids.sort()).toEqual(pontos.map(p => p.id).sort());
    expect(Object.values(RUAS).map(l => l.length)).toEqual([2, 3, 3, 3, 3, 3, 3, 2]);
    for (const p of pontos) expect(RUAS[p.rua]).toContain(p.id);
  });

  it('mortgage is half the price', () => {
    for (const s of BOARD) if (s.kind === 'ponto' || s.kind === 'servico') expect(s.mortgage).toBe(s.price / 2);
  });

  it('unmortgageCost adds 20% interest rounded up', () => {
    const p = pontos.find(x => x.price === 60)!;
    expect(unmortgageCost(p)).toBe(36);
  });
});

describe('deck', () => {
  it('has 30 cards with unique ids, and 12 more to keep for the lobby setting', () => {
    expect(DECK).toHaveLength(42);
    expect(new Set(DECK.map(c => c.id)).size).toBe(42);
    expect(deckIds(false)).toHaveLength(30);
    expect(deckIds(true)).toHaveLength(42);
    expect(DECK.slice(30).every(c => c.effect.kind === 'pocket')).toBe(true);
  });
});
