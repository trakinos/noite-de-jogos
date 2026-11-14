import { describe, expect, it } from 'vitest';
import { BOARD, CAREER_START } from './board';
import { applyVida, createVida, vidaView } from './game';
import { animBetween } from './motion';

const seats = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];

describe('vida motion', () => {
  it('a spin walks square by square and pays at each payday passed', () => {
    const s = createVida(seats, 7);
    applyVida(s, 0, { type: 'path', college: false });
    applyVida(s, 0, { type: 'career', career: (s.prompt as { options: string[] }).options[0]! });
    const before = vidaView(s, 1);
    applyVida(s, 0, { type: 'spin' });
    const after = vidaView(s, 1);
    const anim = animBetween(before, after)!;
    expect(anim.seat).toBe(0);
    expect(anim.spin).toBe(s.lastSpin!.n);
    expect(anim.steps[0]).toBe(CAREER_START + 1);
    expect(anim.steps.at(-1)).toBe(s.players[0]!.pos);
    const passed = anim.steps.filter(p => BOARD[p]!.k === 'payday');
    expect(anim.paydays.map(p => p.pos)).toEqual(passed);
  });

  it('nothing to play when the log did not grow', () => {
    const s = createVida(seats, 1);
    expect(animBetween(vidaView(s, 0), vidaView(s, 0))).toBeNull();
  });
});
