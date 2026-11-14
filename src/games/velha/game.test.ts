import { describe, expect, it } from 'vitest';
import { applyVelha, createVelha, VelhaInstance, velhaView, WINS_NEEDED } from './game';

const seats = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];

function play(s: ReturnType<typeof createVelha>, cells: number[]) {
  for (const cell of cells) expect(applyVelha(s, s.current, { type: 'mark', cell })).toEqual({ ok: true });
}

describe('jogo da velha', () => {
  it('a row wins the round; the starter alternates and is always X', () => {
    const s = createVelha(seats, 1);
    const first = s.current;
    expect(velhaView(s, 0).symbols[first]).toBe('X');
    play(s, [0, 3, 1, 4, 2]);
    expect(s.roundEnd).toEqual({ winner: first, line: [0, 1, 2] });
    expect(applyVelha(s, 0, { type: 'mark', cell: 5 }).ok).toBe(false);
    applyVelha(s, 1, { type: 'next' });
    expect(s.current).toBe(1 - first);
    expect(velhaView(s, 0).symbols[1 - first]).toBe('X');
  });

  it('refuses taken squares and moves out of turn', () => {
    const s = createVelha(seats, 1);
    play(s, [4]);
    expect(applyVelha(s, s.current, { type: 'mark', cell: 4 })).toEqual({ ok: false, reason: 'That square is taken' });
    expect(applyVelha(s, 1 - s.current, { type: 'mark', cell: 0 })).toEqual({ ok: false, reason: 'Not your turn' });
  });

  it('a full board with no line is a draw', () => {
    const s = createVelha(seats, 1);
    play(s, [0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(s.roundEnd).toEqual({ winner: null, line: null });
    expect(s.draws).toBe(1);
  });

  it(`the match ends at ${WINS_NEEDED} round wins; timeouts always finish it`, () => {
    const inst = new VelhaInstance(createVelha(seats, 5));
    for (let i = 0; i < 500 && !inst.over; i++) {
      if (inst.state.roundEnd) applyVelha(inst.state, 0, { type: 'next' });
      else inst.expire('turn', i);
    }
    expect(inst.over).toBe(true);
    expect(Math.max(...inst.state.score)).toBe(WINS_NEEDED);
  });
});
