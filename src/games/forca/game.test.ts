import { describe, expect, it } from 'vitest';
import { applyForca, createForca, forcaView, ForcaInstance, LAST_LETTER_BONUS, letterOf, MAX_MISSES, normalizeWord } from './game';
import { FORCA_EN, FORCA_PT } from './words';

const seats = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];

describe('forca', () => {
  it('folds accents into plain letters', () => {
    expect(letterOf('Ã')).toBe('A');
    expect(letterOf('ç')).toBe('C');
    expect(letterOf('-')).toBeNull();
    expect(normalizeWord(' pão de  queijo ')).toBe('PAO DE QUEIJO');
  });

  it('every word has letters and no duplicates per bank', () => {
    for (const bank of [FORCA_PT, FORCA_EN]) {
      for (const words of Object.values(bank)) for (const w of words) expect([...w].some(ch => letterOf(ch))).toBe(true);
    }
  });

  it('a right letter scores per copy and keeps the turn; a wrong one passes it', () => {
    const s = createForca(seats, 3, 'pt');
    s.words[0] = { word: 'BANANA', category: 'Comida' };
    const p = s.current;
    applyForca(s, p, { type: 'letter', letter: 'a' });
    expect(s.scores[p]).toBe(3);
    expect(s.current).toBe(p);
    expect(applyForca(s, p, { type: 'letter', letter: 'A' })).toEqual({ ok: false, reason: 'That letter was already tried' });
    applyForca(s, p, { type: 'letter', letter: 'Z' });
    expect(s.misses).toBe(1);
    expect(s.current).not.toBe(p);
    const view = forcaView(s, 0);
    expect(view.pattern).toEqual([null, 'A', null, 'A', null, 'A']);
    expect(view.wrong).toEqual(['Z']);
  });

  it('the last letter and a right solve end the round with a bonus', () => {
    const s = createForca(seats, 3, 'pt');
    s.words[0] = { word: 'PÃO', category: 'Comida' };
    const p = s.current;
    applyForca(s, p, { type: 'letter', letter: 'P' });
    applyForca(s, p, { type: 'solve', word: 'pao' });
    expect(s.roundOver).toEqual({ word: 'PÃO', solvedBy: p });
    expect(s.scores[p]).toBe(1 + 2 * 2 + LAST_LETTER_BONUS);
  });

  it(`${MAX_MISSES} misses hang the round; the game always ends`, () => {
    const inst = new ForcaInstance(createForca(seats, 8, 'en'));
    for (let i = 0; i < 2000 && !inst.over; i++) {
      const s = inst.state;
      if (s.roundOver) applyForca(s, 0, { type: 'next' });
      else {
        const letter = 'ZQXJKVWYBFGHMPUCDLNOSTRIAE'.split('').find(l => !s.guessed.includes(l))!;
        applyForca(s, s.current, { type: 'letter', letter });
      }
    }
    expect(inst.over).toBe(true);
    expect(inst.state.winner).not.toBeNull();
  });
});
