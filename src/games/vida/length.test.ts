import { describe, expect, it } from 'vitest';
import { boardFor, CAREERS, SPIN_MAX } from './board';
import { applyVida, createVida, resolveLength, vidaModule } from './game';
import { measure } from './sim';
import { reach } from './track';

/**
 * A playtest found 2-player games over in under 5 minutes (about 14 spins each). At 15–20 s a turn, a 15–20 minute game
 * needs roughly 25–35 spins per player; the short track is about two thirds of that.
 */
describe('vida adulta game length', () => {
  for (const players of [2, 4, 6]) {
    it(`a normal game with ${players} players takes 25–35 spins each`, () => {
      const m = measure(players, 120, 'normal');
      expect(m.perPlayer).toBeGreaterThanOrEqual(25);
      expect(m.perPlayer).toBeLessThanOrEqual(35);
      // Nobody is done after a handful of spins.
      expect(m.min).toBeGreaterThanOrEqual(15);
    });
    it(`a short game with ${players} players takes 16–25 spins each`, () => {
      const m = measure(players, 120, 'short');
      expect(m.perPlayer).toBeGreaterThanOrEqual(16);
      expect(m.perPlayer).toBeLessThanOrEqual(25);
    });
  }

  it('the game only ends when the last player retires', () => {
    const s = createVida([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 3);
    const board = boardFor('normal');
    s.players.forEach(p => {
      p.started = true;
      p.career = CAREERS[0]!.id;
      p.salary = CAREERS[0]!.salary;
      p.pos = board.retire - 1;
    });
    s.prompt = null;
    applyVida(s, 0, { type: 'spin' });
    expect((s.prompt as { kind: string } | null)?.kind).toBe('retire');
    applyVida(s, 0, { type: 'retire', where: 'country' });
    expect(s.winner).toBeNull();
    expect(s.current).toBe(1);
    applyVida(s, 1, { type: 'spin' });
    applyVida(s, 1, { type: 'retire', where: 'mansion' });
    expect(s.winner).not.toBeNull();
  });

  it('a spin never moves more than the spinner shows and never skips a stop', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = createVida([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seed);
      const board = boardFor('normal');
      const p = s.players[0]!;
      p.started = true;
      p.career = CAREERS[0]!.id;
      p.pos = board.careerStart + (seed % 120);
      s.prompt = null;
      const from = p.pos;
      applyVida(s, 0, { type: 'spin' });
      const moved = p.pos - from;
      expect(moved).toBeGreaterThanOrEqual(1);
      expect(moved).toBeLessThanOrEqual(SPIN_MAX);
      expect(moved).toBeLessThanOrEqual(s.lastSpin!.n);
      for (let i = from + 1; i < p.pos; i++) expect(board.squares[i]!.k).not.toBe('stop');
    }
  });

  it('the short track drops whole chapters but keeps every kind of stop that matters', () => {
    const short = boardFor('short');
    const normal = boardFor('normal');
    expect(short.squares.length).toBeLessThan(normal.squares.length);
    for (const b of [short, normal]) {
      const stops = b.squares.flatMap(sq => (sq.k === 'stop' ? [sq.s] : []));
      expect(stops[0]).toBe('graduate');
      expect(stops.at(-1)).toBe('retire');
      for (const s of ['marry', 'house', 'job', 'invest'] as const) expect(stops).toContain(s);
      expect(b.squares[b.graduate]).toEqual({ k: 'stop', s: 'graduate' });
      expect(b.chapters.at(-1)!.to).toBe(b.retire);
    }
  });

  it('lobby options: auto picks the short track for big tables', () => {
    expect(vidaModule.parseOptions(undefined)).toEqual({ length: 'auto' });
    expect(vidaModule.parseOptions({ length: 'short' })).toEqual({ length: 'short' });
    expect('error' in (vidaModule.parseOptions({ length: 'huge' }) as object)).toBe(true);
    expect(resolveLength('auto', 2)).toBe('normal');
    expect(resolveLength('auto', 6)).toBe('short');
    expect(resolveLength('normal', 6)).toBe('normal');
  });
});

describe('vida adulta reach highlight', () => {
  it('maps each spin to the square it lands on, a stop catching every longer spin', () => {
    const board = boardFor('normal');
    const stop = board.squares.findIndex((sq, i) => i > board.careerStart && sq.k === 'stop');
    const from = stop - 3;
    const r = reach(board, from);
    expect(r.get(from + 1)).toEqual([1]);
    expect(r.get(from + 2)).toEqual([2]);
    expect(r.get(stop)).toEqual(Array.from({ length: SPIN_MAX - 2 }, (_, i) => i + 3));
    expect([...r.keys()].every(pos => pos <= stop)).toBe(true);
  });
});
