import { describe, expect, it } from 'vitest';
import { applySudoku, countSolutions, createSudoku, makePuzzle, sudokuModule, sudokuView, type SudokuMode, type SudokuState } from './game';

const seats = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bia' }];

function start(mode: SudokuMode, n = 2, seed = 7): SudokuState {
  return createSudoku(seats.slice(0, n), seed, { mode, level: 'easy' }, 0);
}

function solve(s: SudokuState, seat: number, keepOne = false): number {
  const grid = s.grids[s.mode === 'coop' ? 0 : seat]!;
  const empties = grid.map((g, i) => (g === 0 ? i : -1)).filter(i => i >= 0);
  const todo = keepOne ? empties.slice(0, -1) : empties;
  for (const i of todo) expect(applySudoku(s, seat, { type: 'set', cell: i, value: s.solution[i]! }, 1000).ok).toBe(true);
  return empties[empties.length - 1]!;
}

describe('sudoku generator', () => {
  it('makes a valid puzzle with exactly one solution', () => {
    const { givens, solution } = makePuzzle(1, 'medium');
    expect(solution.every(v => v >= 1 && v <= 9)).toBe(true);
    for (let k = 0; k < 9; k++) {
      expect(new Set(solution.slice(k * 9, k * 9 + 9)).size).toBe(9);
      expect(new Set([...Array(9).keys()].map(r => solution[r * 9 + k])).size).toBe(9);
    }
    expect(givens.every((g, i) => g === 0 || g === solution[i])).toBe(true);
    expect(countSolutions(givens)).toBe(1);
    expect(givens.filter(Boolean).length).toBeLessThanOrEqual(36);
  });

  it('is the same for the same seed', () => {
    expect(makePuzzle(5, 'easy')).toEqual(makePuzzle(5, 'easy'));
    expect(makePuzzle(5, 'easy').solution).not.toEqual(makePuzzle(6, 'easy').solution);
  });
});

describe('sudoku rules', () => {
  it('refuses a wrong digit, counts it, and leaves the grid alone', () => {
    const s = start('race');
    const cell = s.givens.indexOf(0);
    const wrong = (s.solution[cell]! % 9) + 1;
    expect(applySudoku(s, 0, { type: 'set', cell, value: wrong })).toEqual({ ok: false, reason: 'Wrong digit' });
    expect(s.mistakes).toEqual([1, 0]);
    expect(s.grids[0]![cell]).toBe(0);
  });

  it('refuses bad input, givens and filled squares', () => {
    const s = start('race');
    const given = s.givens.findIndex(g => g !== 0);
    const cell = s.givens.indexOf(0);
    expect(applySudoku(s, 0, { type: 'set', cell: given, value: 1 }).ok).toBe(false);
    expect(applySudoku(s, 0, { type: 'set', cell: 99, value: 1 }).ok).toBe(false);
    expect(applySudoku(s, 0, { type: 'set', cell, value: 0 }).ok).toBe(false);
    expect(applySudoku(s, 5, { type: 'set', cell, value: 1 }).ok).toBe(false);
    expect(applySudoku(s, 0, { type: 'set', cell, value: s.solution[cell]! }).ok).toBe(true);
    expect(applySudoku(s, 0, { type: 'set', cell, value: s.solution[cell]! }).ok).toBe(false);
    expect(applySudoku(s, 0, null as never).ok).toBe(false);
  });

  it('coop: one shared grid, finished together', () => {
    const s = start('coop');
    const cell = s.givens.indexOf(0);
    applySudoku(s, 0, { type: 'set', cell, value: s.solution[cell]! });
    expect(sudokuView(s, 1).grid[cell]).toBe(s.solution[cell]);
    expect(sudokuView(s, 1).placedBy[cell]).toBe(0);
    const last = solve(s, 1, true);
    expect(s.done).toBe(false);
    applySudoku(s, 0, { type: 'set', cell: last, value: s.solution[last]! }, 5000);
    expect(s.done).toBe(true);
    expect(s.winner).toBeNull();
    expect(s.endMs).toBe(5000);
  });

  it('race: separate grids, first to finish wins, and others cannot see digits', () => {
    const s = start('race');
    const cell = s.givens.indexOf(0);
    applySudoku(s, 1, { type: 'set', cell, value: s.solution[cell]! });
    expect(sudokuView(s, 0).grid[cell]).toBe(0);
    expect(sudokuView(s, 0).filled[1]).toBe(sudokuView(s, 0).filled[0]! + 1);
    solve(s, 0);
    expect(s.winner).toBe(0);
    expect(s.done).toBe(true);
    expect(applySudoku(s, 1, { type: 'set', cell: 0, value: 1 }).ok).toBe(false);
  });

  it('solo: no winner, the game ends when everyone has finished', () => {
    const s = start('solo');
    solve(s, 0);
    expect(s.done).toBe(false);
    expect(applySudoku(s, 0, { type: 'set', cell: 0, value: 1 }).ok).toBe(false);
    solve(s, 1);
    expect(s.done).toBe(true);
    expect(s.winner).toBeNull();
    expect(s.finished).toEqual([0, 1]);
  });

  it('works for one player in any mode', () => {
    for (const mode of ['coop', 'race', 'solo'] as const) {
      const s = start(mode, 1);
      solve(s, 0);
      expect(s.done).toBe(true);
    }
  });

  it('parses options and has no clock', () => {
    expect(sudokuModule.parseOptions({ mode: 'race', level: 'hard' })).toEqual({ mode: 'race', level: 'hard' });
    expect(sudokuModule.parseOptions('x')).toEqual({ mode: 'coop', level: 'medium' });
    const g = sudokuModule.create(seats, sudokuModule.defaultOptions(), 3);
    expect(g.clockInput().over).toBe(true);
    expect(() => g.viewFor('zed')).toThrow();
  });
});
