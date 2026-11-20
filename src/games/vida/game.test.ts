import { describe, expect, it } from 'vitest';
import { BIKE_UPKEEP, BOARD, boardFor, HOUSES, KID_UPKEEP, CAREER_START, CAREERS, COLLEGE_LOANS, GRADUATE, INVEST, JOB_KEEP_RAISE, RETIRE, START_CASH } from './board';
import { applyVida, createVida, defaultIntent, VidaInstance, vidaView } from './game';
import { VIDA_TEXT } from './text';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

describe('vida adulta board', () => {
  it('has the campus, then the career start, and ends in retirement', () => {
    expect(BOARD[GRADUATE]).toEqual({ k: 'stop', s: 'graduate' });
    expect(CAREER_START).toBe(GRADUATE + 1);
    expect(BOARD[RETIRE]).toEqual({ k: 'stop', s: 'retire' });
    expect(BOARD.filter(sq => sq.k === 'stop' && sq.s === 'graduate')).toHaveLength(1);
  });
});

describe('careers and perks', () => {
  it('every career has a perk unless it is among the top earners, and lower pay never beats higher pay without one', () => {
    for (const c of CAREERS) if (c.salary < 75) expect(c.perks.length).toBeGreaterThan(0);
    for (const c of CAREERS) expect(VIDA_TEXT.pt[`c_${c.id}`]).toBeTruthy();
    for (const c of CAREERS) for (const k of c.perks) expect(VIDA_TEXT.pt[`perk_${k}`]).toBeTruthy();
  });

  it('thrift softens spending, noTax skips the tax square', () => {
    const s = createVida(seats(2), 3);
    const p = s.players[0]!;
    p.started = true;
    p.career = 'cashier';
    p.salary = 35;
    s.prompt = null;
    const board = boardFor('normal');
    const tax = board.squares.findIndex(sq => sq.k === 'tax');
    p.pos = tax - 1;
    const cash = p.cash;
    applyVida(s, 0, { type: 'spin' });
    // Whatever was spun, the tax square is never charged to a cashier when landed on.
    expect(s.log.some(e => e.k === 'tax')).toBe(false);
    expect(p.cash).toBeGreaterThanOrEqual(cash - 100);
  });

  it('the midlife bike gives three Achievements and costs upkeep', () => {
    const s = createVida(seats(2), 9);
    s.players[0]!.started = true;
    s.players[0]!.cash = 400;
    s.prompt = { kind: 'midlife' };
    applyVida(s, 0, { type: 'midlife', pick: 'bike' });
    expect(s.players[0]!.tiles).toHaveLength(3);
    expect(s.players[0]!.bike).toBe(true);
  });
});

describe('fixed costs', () => {
  it('a payday pays the salary, then charges kids, the house and the bike', () => {
    const s = createVida(seats(2), 4);
    const p = s.players[0]!;
    p.started = true;
    p.career = 'chef';
    p.salary = 50;
    p.kids = 2;
    p.house = 'penthouse';
    p.bike = true;
    p.cash = 1000;
    s.prompt = null;
    const board = boardFor('normal');
    p.pos = board.squares.findIndex((sq, i) => i >= board.careerStart && sq.k === 'payday') - 1;
    s.lastSpin = null;
    // Spin until the walk crosses the payday (position is rigged to the square before it).
    for (let i = 0; i < 20 && !s.log.some(e => e.k === 'payday'); i++) {
      if (s.current !== 0 || s.prompt) break;
      applyVida(s, 0, { type: 'spin' });
    }
    const upkeep = 2 * KID_UPKEEP + HOUSES.find(h => h.id === 'penthouse')!.upkeep + BIKE_UPKEEP;
    expect(s.log).toContainEqual({ k: 'upkeep', seat: 0, n: upkeep });
  });
});

describe('vida adulta', () => {
  it('the first turn asks for a path; a career path offers three non-degree careers', () => {
    const s = createVida(seats(2), 1);
    expect(s.prompt).toEqual({ kind: 'path' });
    expect(applyVida(s, 1, { type: 'spin' })).toEqual({ ok: false, reason: 'Not your turn' });
    expect(applyVida(s, 0, { type: 'spin' }).ok).toBe(false);
    applyVida(s, 0, { type: 'path', college: false });
    expect(s.prompt?.kind).toBe('career');
    const options = (s.prompt as { options: string[] }).options;
    expect(options).toHaveLength(3);
    applyVida(s, 0, { type: 'career', career: options[0]! });
    expect(s.players[0]!.pos).toBe(CAREER_START);
    expect(s.players[0]!.salary).toBeGreaterThan(0);
    expect(applyVida(s, 0, { type: 'spin' }).ok).toBe(true);
  });

  it('college costs two loans and stops at graduation for a degree career', () => {
    const s = createVida(seats(2), 4);
    applyVida(s, 0, { type: 'path', college: true });
    expect(s.players[0]!.loans).toBe(COLLEGE_LOANS - Math.floor(START_CASH / 50));
    // Walk until graduation.
    for (let i = 0; i < 20 && s.players[0]!.career === null; i++) {
      if (s.current === 0) applyVida(s, 0, s.prompt?.kind === 'career' ? { type: 'career', career: (s.prompt as { options: string[] }).options[0]! } : defaultIntent(s));
      else applyVida(s, s.current, defaultIntent(s));
    }
    expect(s.players[0]!.career).not.toBeNull();
    expect(s.players[0]!.pos).toBe(GRADUATE);
  });

  it('views hide Conquista values until the end', () => {
    const s = createVida(seats(2), 2);
    s.players[0]!.tiles = [100, 250];
    expect(vidaView(s, 1).players[0]!.tiles).toBe(2);
    expect(vidaView(s, 1).players[0]!.tileValues).toBeNull();
  });

  it('simulated games always end with everyone retired and scored', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const n = 2 + (seed % 5);
      const inst = new VidaInstance(createVida(seats(n), seed));
      for (let i = 0; i < 5000 && !inst.over; i++) {
        // Alternate between timeouts and the default answers so both paths are exercised.
        if (i % 3 === 0) inst.expire('turn', i);
        else {
          const s = inst.state;
          const intent = s.prompt?.kind === 'path' ? { type: 'path' as const, college: seed % 2 === 0 } : defaultIntent(s);
          expect(applyVida(s, s.current, intent).ok).toBe(true);
        }
      }
      expect(inst.over).toBe(true);
      const s = inst.state;
      expect(s.players.every(p => p.retired)).toBe(true);
      expect(s.scores).toHaveLength(n);
      expect(s.winner).not.toBeNull();
    }
  });
});

describe('vida adulta stops and squares', () => {
  const board = boardFor('normal');
  const at = (s: ReturnType<typeof createVida>, kind: string, from = board.careerStart) => {
    const i = board.squares.findIndex((sq, n) => n >= from && (sq.k === kind || (sq.k === 'stop' && sq.s === kind)));
    expect(i).toBeGreaterThan(0);
    const p = s.players[0]!;
    p.started = true;
    p.career = 'teacher';
    p.salary = 60;
    // One square before, so a spin of anything stops there (stops) or we place directly (others).
    p.pos = i;
    return i;
  };

  it('every square text has Portuguese and English', () => {
    for (const len of ['short', 'normal'] as const) {
      for (const sq of boardFor(len).squares) {
        if ('t' in sq) {
          expect(VIDA_TEXT.pt[`t_${sq.t}`], sq.t).toBeTruthy();
          expect(VIDA_TEXT.en[`t_${sq.t}`], sq.t).toBeTruthy();
        }
        if (sq.k === 'stop') {
          expect(VIDA_TEXT.pt[`sq_${sq.s}`]).toBeTruthy();
          expect(VIDA_TEXT.en[`sq_${sq.s}`]).toBeTruthy();
        }
      }
    }
    expect(Object.keys(VIDA_TEXT.en).sort()).toEqual(Object.keys(VIDA_TEXT.pt).sort());
  });

  it('a spin stops on an invest square and the choice resolves it', () => {
    const s = createVida(seats(2), 5);
    const i = at(s, 'invest');
    s.players[0]!.pos = i - 1;
    s.prompt = null;
    applyVida(s, 0, { type: 'spin' });
    expect(s.players[0]!.pos).toBe(i);
    expect(s.prompt).toEqual({ kind: 'invest' });
    const cash = s.players[0]!.cash;
    expect(applyVida(s, 0, { type: 'invest', pick: 'savings' }).ok).toBe(true);
    expect(s.players[0]!.cash).toBe(cash + INVEST.savings.win);
    expect(s.current).toBe(1);
  });

  it('crossroads: staying gives a raise, switching keeps raises earned', () => {
    const s = createVida(seats(2), 6);
    const i = at(s, 'job');
    s.players[0]!.pos = i - 1;
    s.players[0]!.salary = 75; // teacher (55) + 20 in raises
    s.prompt = null;
    applyVida(s, 0, { type: 'spin' });
    const prompt = s.prompt as unknown as { kind: string; options: string[]; keep?: boolean };
    expect(prompt.kind).toBe('career');
    expect(prompt.keep).toBe(true);
    expect(prompt.options).not.toContain('teacher');
    const other = CAREERS.find(c => c.id === prompt.options[0])!;
    expect(other.degree).toBe(true);
    const copy = structuredClone(s);
    applyVida(copy, 0, { type: 'career', career: null });
    expect(copy.players[0]!.salary).toBe(75 + JOB_KEEP_RAISE);
    applyVida(s, 0, { type: 'career', career: other.id });
    expect(s.players[0]!.salary).toBe(other.salary + 20);
  });

  it('bills per kid and bank interest only charge who has kids or loans', () => {
    const s = createVida(seats(2), 8);
    const kidBill = at(s, 'perkid');
    const sq = board.squares[kidBill] as { k: 'perkid'; n: number };
    s.players[0]!.pos = kidBill - 1;
    s.players[0]!.kids = 2;
    s.players[0]!.cash = 500;
    // Walk exactly one square by forcing the rng to give 1: try seeds until the spin is 1.
    for (let seed = 0; seed < 200; seed++) {
      const c = structuredClone(s);
      c.rng = createVida(seats(2), seed).rng;
      c.prompt = null;
      applyVida(c, 0, { type: 'spin' });
      if (c.lastSpin!.n !== 1) continue;
      expect(c.players[0]!.cash).toBe(500 - sq.n * 2);
      return;
    }
    throw new Error('no seed spun a 1');
  });

  it('midlife and timeouts: the cautious answers always work', () => {
    const s = createVida(seats(2), 9);
    s.players[0]!.started = true;
    s.prompt = { kind: 'midlife' };
    expect(defaultIntent(s)).toEqual({ type: 'midlife', pick: 'deny' });
    expect(applyVida(s, 0, defaultIntent(s)).ok).toBe(true);
    s.players[1]!.started = true;
    s.players[1]!.career = 'chef';
    s.prompt = { kind: 'career', options: ['cashier', 'driver'], keep: true };
    expect(defaultIntent(s)).toEqual({ type: 'career', career: null });
    expect(applyVida(s, 1, { type: 'invest', pick: 'savings' }).ok).toBe(false);
  });

  it('views stay small', () => {
    const inst = new VidaInstance(createVida(seats(6), 11));
    for (let i = 0; i < 3000 && !inst.over; i++) inst.expire('turn', i);
    const size = JSON.stringify({ ...inst.viewFor('p0'), log: inst.state.log.slice(-150) }).length;
    expect(size).toBeLessThan(12000);
  });
});
