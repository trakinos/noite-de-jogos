import { describe, expect, it } from 'vitest';
import { BOARD, CAREER_START, COLLEGE_LOANS, GRADUATE, RETIRE, START_CASH } from './board';
import { applyVida, createVida, defaultIntent, VidaInstance, vidaView } from './game';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

describe('vida adulta board', () => {
  it('has the campus, then the career start, and ends in retirement', () => {
    expect(BOARD[GRADUATE]).toEqual({ k: 'stop', s: 'graduate' });
    expect(CAREER_START).toBe(GRADUATE + 1);
    expect(BOARD[RETIRE]).toEqual({ k: 'stop', s: 'retire' });
    expect(BOARD.filter(sq => sq.k === 'stop' && sq.s === 'graduate')).toHaveLength(1);
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
