/**
 * The cells of a 3×3 grid (0 top-left … 8 bottom-right, row by row) that hold a pip for each face,
 * laid out like a real die.
 */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** The pip cells for `face`; an unknown face shows none. */
export function pipsFor(face: number): number[] {
  return PIPS[face] ?? [];
}
