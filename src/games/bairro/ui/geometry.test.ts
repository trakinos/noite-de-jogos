import { describe, expect, it } from 'vitest';
import { ringCell, ringGridArea, stripWindow } from './geometry';

describe('ringCell', () => {
  it('puts the corners and mid-sides in place', () => {
    expect(ringCell(0)).toEqual({ row: 10, col: 10 });
    expect(ringCell(5)).toEqual({ row: 10, col: 5 });
    expect(ringCell(10)).toEqual({ row: 10, col: 0 });
    expect(ringCell(15)).toEqual({ row: 5, col: 0 });
    expect(ringCell(20)).toEqual({ row: 0, col: 0 });
    expect(ringCell(25)).toEqual({ row: 0, col: 5 });
    expect(ringCell(30)).toEqual({ row: 0, col: 10 });
    expect(ringCell(35)).toEqual({ row: 5, col: 10 });
  });
  it('gives every square its own cell on the edge', () => {
    const cells = Array.from({ length: 40 }, (_, p) => ringCell(p));
    expect(new Set(cells.map(c => `${c.row},${c.col}`)).size).toBe(40);
    for (const { row, col } of cells) expect(row === 0 || row === 10 || col === 0 || col === 10).toBe(true);
  });
});

describe('stripWindow', () => {
  it('wraps at the start and the end', () => {
    expect(stripWindow(1, 5)).toEqual([39, 0, 1, 2, 3]);
    expect(stripWindow(38, 5)).toEqual([36, 37, 38, 39, 0]);
    expect(stripWindow(20, 5)).toEqual([18, 19, 20, 21, 22]);
  });
});

describe('ringCell wrapping and ringGridArea', () => {
  it('normalizes positions outside 0-39', () => {
    expect(ringCell(-1)).toEqual(ringCell(39));
    expect(ringCell(40)).toEqual(ringCell(0));
  });
  it('is 1-based', () => {
    expect(ringGridArea(0)).toEqual({ gridRow: 11, gridColumn: 11 });
    expect(ringGridArea(20)).toEqual({ gridRow: 1, gridColumn: 1 });
    expect(ringGridArea(-1)).toEqual(ringGridArea(39));
  });
});
