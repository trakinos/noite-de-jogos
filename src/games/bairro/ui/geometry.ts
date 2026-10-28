import type { RuaId } from '../board';

/** The mockup's street colors; the only hard-coded colors in the Bairro UI. */
export const RUA_COLORS: Record<RuaId, string> = {
  r1: '#8c5a2b', r2: '#6fb6d9', r3: '#d65d9a', r4: '#e8862a',
  r5: '#c8372d', r6: '#f2b632', r7: '#2f7a35', r8: '#2c4ba8',
};

export const BOARD_SIZE = 40;
const SIDE = 10;

/** Cell (0-based) of square `pos` on an 11x11 grid: 0 bottom-right, counter-clockwise, 10 bottom-left, 20 top-left, 30 top-right. */
export function ringCell(pos: number): { row: number; col: number } {
  const p = ((pos % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  if (p < SIDE) return { row: SIDE, col: SIDE - p };
  if (p < 2 * SIDE) return { row: SIDE - (p - SIDE), col: 0 };
  if (p < 3 * SIDE) return { row: 0, col: p - 2 * SIDE };
  return { row: p - 3 * SIDE, col: SIDE };
}

/** Which side of square `pos` faces the Pracinha in the middle; null for the four corners. */
export type Facing = 'up' | 'right' | 'down' | 'left';
export function ringFacing(pos: number): Facing | null {
  const { row, col } = ringCell(pos);
  if ((row === 0 || row === SIDE) && (col === 0 || col === SIDE)) return null;
  if (row === SIDE) return 'up';
  if (col === 0) return 'right';
  if (row === 0) return 'down';
  return 'left';
}

/** `size` positions around `center`, wrapping around the board. */
export function stripWindow(center: number, size: number): number[] {
  const start = center - Math.floor(size / 2);
  return Array.from({ length: size }, (_, i) => (((start + i) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE);
}

/** `ringCell` as 1-based CSS grid lines, ready for an inline style. */
export function ringGridArea(pos: number): { gridRow: number; gridColumn: number } {
  const { row, col } = ringCell(pos);
  return { gridRow: row + 1, gridColumn: col + 1 };
}
