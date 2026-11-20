import { describe, expect, it } from 'vitest';
import { createRng } from '../../engine/rng';
import { EDGE_COUNT, EDGE_VERTS, HEX_VERTS, PORT_EDGES, VERTEX_COUNT, VERTEX_EDGES, VERTEX_HEXES, pips, randomBoard } from './board';

describe('catan board geometry', () => {
  it('has 19 hexes, 54 corners and 72 edges', () => {
    expect(HEX_VERTS).toHaveLength(19);
    expect(VERTEX_COUNT).toBe(54);
    expect(EDGE_COUNT).toBe(72);
    for (const [a, b] of EDGE_VERTS) expect(a).not.toBe(b);
  });

  it('corners touch 1 to 3 hexes and 2 to 3 edges', () => {
    for (let v = 0; v < VERTEX_COUNT; v++) {
      expect(VERTEX_HEXES[v]!.length).toBeGreaterThanOrEqual(1);
      expect(VERTEX_HEXES[v]!.length).toBeLessThanOrEqual(3);
      expect(VERTEX_EDGES[v]!.length).toBeGreaterThanOrEqual(2);
      expect(VERTEX_EDGES[v]!.length).toBeLessThanOrEqual(3);
    }
  });

  it('has 9 harbors on distinct coast edges with distinct corners', () => {
    expect(new Set(PORT_EDGES).size).toBe(9);
    const corners = PORT_EDGES.flatMap(e => EDGE_VERTS[e]!);
    expect(new Set(corners).size).toBe(18);
  });
});

describe('random board', () => {
  it('has the right tiles, numbers and harbors, and no hot numbers side by side', () => {
    const { hexes, ports, robber } = randomBoard(createRng(3));
    const count = (t: string) => hexes.filter(h => h.terrain === t).length;
    expect([count('wood'), count('brick'), count('sheep'), count('wheat'), count('ore'), count('desert')]).toEqual([4, 3, 4, 4, 3, 1]);
    expect(hexes[robber]!.terrain).toBe('desert');
    expect(hexes.filter(h => h.num).map(h => h.num).sort((a, b) => a - b)).toEqual([2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]);
    expect(ports.filter(p => p.kind === 'any')).toHaveLength(4);
    expect(new Set(ports.map(p => p.kind)).size).toBe(6);
  });

  it('is the same for the same seed', () => {
    expect(randomBoard(createRng(9))).toEqual(randomBoard(createRng(9)));
  });

  it('counts dice dots', () => {
    expect([pips(2), pips(6), pips(7), pips(8), pips(12)]).toEqual([1, 5, 6, 5, 1]);
  });
});
