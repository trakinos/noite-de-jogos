import { shuffle, type RngState } from '../../engine/rng';

/** The Catan board: 19 hexes (axial, pointy-top), the 54 corners and 72 edges they share, and the 9 harbors. Fixed geometry, identical on every device. */

export type Res = 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore';
export const RES: readonly Res[] = ['wood', 'brick', 'sheep', 'wheat', 'ore'];
export type Terrain = Res | 'desert';
export type PortKind = Res | 'any';

const SQ3 = Math.sqrt(3);

/** Rows from top to bottom, 3-4-5-4-3. */
export const HEX_AXIAL: readonly (readonly [number, number])[] = [
  [0, -2], [1, -2], [2, -2],
  [-1, -1], [0, -1], [1, -1], [2, -1],
  [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
  [-2, 1], [-1, 1], [0, 1], [1, 1],
  [-2, 2], [-1, 2], [0, 2],
];

export const HEX_CENTERS: readonly (readonly [number, number])[] = HEX_AXIAL.map(([q, r]) => [SQ3 * (q + r / 2), 1.5 * r]);

const key = (x: number, y: number) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;

const vertexIndex = new Map<string, number>();
export const VERTEX_POS: [number, number][] = [];
export const HEX_VERTS: number[][] = [];
const edgeIndex = new Map<string, number>();
export const EDGE_VERTS: [number, number][] = [];
const edgeHexCount: number[] = [];

HEX_CENTERS.forEach(([cx, cy]) => {
  const ring: number[] = [];
  for (let k = 0; k < 6; k++) {
    const a = ((60 * k - 30) * Math.PI) / 180;
    const x = cx! + Math.cos(a);
    const y = cy! + Math.sin(a);
    const kk = key(x, y);
    let id = vertexIndex.get(kk);
    if (id === undefined) {
      id = VERTEX_POS.length;
      vertexIndex.set(kk, id);
      VERTEX_POS.push([x, y]);
    }
    ring.push(id);
  }
  HEX_VERTS.push(ring);
  for (let k = 0; k < 6; k++) {
    const a = ring[k]!;
    const b = ring[(k + 1) % 6]!;
    const ek = a < b ? `${a}-${b}` : `${b}-${a}`;
    let id = edgeIndex.get(ek);
    if (id === undefined) {
      id = EDGE_VERTS.length;
      edgeIndex.set(ek, id);
      EDGE_VERTS.push(a < b ? [a, b] : [b, a]);
      edgeHexCount.push(0);
    }
    edgeHexCount[id]!++;
  }
});

export const VERTEX_COUNT = VERTEX_POS.length;
export const EDGE_COUNT = EDGE_VERTS.length;

export function edgeBetween(a: number, b: number): number {
  return edgeIndex.get(a < b ? `${a}-${b}` : `${b}-${a}`) ?? -1;
}

export const VERTEX_EDGES: number[][] = VERTEX_POS.map(() => []);
export const VERTEX_NEIGHBORS: number[][] = VERTEX_POS.map(() => []);
export const VERTEX_HEXES: number[][] = VERTEX_POS.map(() => []);
EDGE_VERTS.forEach(([a, b], e) => {
  VERTEX_EDGES[a]!.push(e);
  VERTEX_EDGES[b]!.push(e);
  VERTEX_NEIGHBORS[a]!.push(b);
  VERTEX_NEIGHBORS[b]!.push(a);
});
HEX_VERTS.forEach((ring, h) => ring.forEach(v => VERTEX_HEXES[v]!.push(h)));

/** The 30 edges on the coast, in order around the board. */
const COAST: number[] = EDGE_VERTS.map((_, e) => e)
  .filter(e => edgeHexCount[e] === 1)
  .sort((x, y) => angleOf(x) - angleOf(y));

function angleOf(e: number): number {
  const [a, b] = EDGE_VERTS[e]!;
  const mx = (VERTEX_POS[a]![0] + VERTEX_POS[b]![0]) / 2;
  const my = (VERTEX_POS[a]![1] + VERTEX_POS[b]![1]) / 2;
  return Math.atan2(my, mx);
}

/** Coast edges that carry a harbor: every third or fourth one around the board. */
export const PORT_EDGES: number[] = (() => {
  const out: number[] = [];
  let i = 0;
  for (const gap of [3, 4, 3, 3, 4, 3, 3, 4, 3]) {
    out.push(COAST[i]!);
    i += gap;
  }
  return out;
})();

export interface Port {
  edge: number;
  kind: PortKind;
}

const PORT_KINDS: PortKind[] = ['any', 'any', 'any', 'any', 'wood', 'brick', 'sheep', 'wheat', 'ore'];
const TERRAINS: Terrain[] = [
  ...Array<Terrain>(4).fill('wood'), ...Array<Terrain>(4).fill('sheep'), ...Array<Terrain>(4).fill('wheat'),
  ...Array<Terrain>(3).fill('brick'), ...Array<Terrain>(3).fill('ore'), 'desert',
];
const NUMBERS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

export interface Hex {
  terrain: Terrain;
  /** Dice number, 0 for the desert. */
  num: number;
}

const HEX_NEIGHBORS: number[][] = HEX_AXIAL.map(([q, r], i) =>
  HEX_AXIAL.map(([q2, r2], j) => [j, q2 - q, r2 - r] as const)
    .filter(([j, dq, dr]) => j !== i && ((Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2) === 1)
    .map(([j]) => j),
);

/** A random board: terrain and numbers shuffled, with no two hot numbers (6 and 8) side by side. */
export function randomBoard(rng: RngState): { hexes: Hex[]; ports: Port[]; robber: number } {
  for (;;) {
    const terrain = shuffle(rng, TERRAINS);
    const nums = shuffle(rng, NUMBERS);
    let n = 0;
    const hexes: Hex[] = terrain.map(t => ({ terrain: t, num: t === 'desert' ? 0 : nums[n++]! }));
    const hot = (i: number) => hexes[i]!.num === 6 || hexes[i]!.num === 8;
    if (hexes.some((_, i) => hot(i) && HEX_NEIGHBORS[i]!.some(j => hot(j)))) continue;
    const kinds = shuffle(rng, PORT_KINDS);
    return {
      hexes,
      ports: PORT_EDGES.map((edge, i) => ({ edge, kind: kinds[i]! })),
      robber: hexes.findIndex(h => h.terrain === 'desert'),
    };
  }
}

/** Dice odds as dots: 6 and 8 have five, 2 and 12 have one. */
export function pips(num: number): number {
  return 6 - Math.abs(7 - num);
}
