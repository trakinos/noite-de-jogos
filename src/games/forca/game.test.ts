import { describe, expect, it } from 'vitest';
import {
  applyForca, cleanSecret, createForca, forcaModule, forcaView, ForcaInstance, LAST_LETTER_BONUS, letterOf, MAX_MISSES, normalizeWord, pickWords,
  roundsFor, WRITE_SKIP_MS, WRITER_HANG_BONUS, WRITER_MISS_POINTS, type ForcaState,
} from './game';
import { BR_CAPITALS, BR_STATES, CEP_EN, CEP_PT, FORCA_EN, FORCA_PT } from './words';
import { createRng } from '../../engine/rng';

const seats = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];

/** Plays a guessing round to its end with a fixed letter order. */
function playRound(s: ForcaState, order = 'ZQXJKWYVBFGHMPUCDLNOSTRIAE'): void {
  while (!s.roundOver) {
    const letter = order.split('').find(l => !s.guessed.includes(l))!;
    expect(applyForca(s, s.current, { type: 'letter', letter })).toEqual({ ok: true });
  }
}

describe('forca', () => {
  it('folds accents into plain letters', () => {
    expect(letterOf('Ã')).toBe('A');
    expect(letterOf('ç')).toBe('C');
    expect(letterOf('-')).toBeNull();
    expect(normalizeWord(' pão de  queijo ')).toBe('PAO DE QUEIJO');
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

  it('multi-word and accented names: spaces and hyphens shown at once, accents matched by the base letter', () => {
    const s = createForca(seats, 3, 'pt');
    s.words[0] = { word: 'SÃO TOMÉ E PRÍNCIPE', category: CEP_PT };
    const p = s.current;
    expect(forcaView(s, p).pattern.filter(c => c !== null).join('')).toBe('   ');
    applyForca(s, p, { type: 'letter', letter: 'E' });
    expect(s.scores[p]).toBe(3); // É, E, E
    applyForca(s, p, { type: 'letter', letter: 'I' });
    expect(forcaView(s, p).pattern.map(c => c ?? '_').join('')).toBe('___ ___É E __Í__I_E');
    applyForca(s, p, { type: 'solve', word: 'sao tome e principe' });
    expect(s.roundOver?.solvedBy).toBe(p);

    const t = createForca(seats, 4, 'pt');
    t.words[0] = { word: 'GUINÉ-BISSAU', category: CEP_PT };
    const view = forcaView(t, 0);
    expect(view.pattern[5]).toBe('-');
    expect(view.pattern.filter(c => c === null)).toHaveLength(11);
    // A solve typed with a space for the hyphen is wrong; with the hyphen, right.
    expect(normalizeWord('guiné-bissau')).toBe(normalizeWord('GUINÉ-BISSAU'));
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

  it('never repeats a word within a match, and mixes categories', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const lang of ['pt', 'en'] as const) {
        const s = createForca(seats, seed, lang);
        const words = s.words.map(w => normalizeWord(w.word));
        expect(new Set(words).size).toBe(words.length);
        expect(new Set(s.words.map(w => w.category)).size).toBe(s.words.length);
      }
    }
    // Even when the match is longer than there are categories.
    const many = pickWords(createRng(1), FORCA_PT, 60);
    expect(new Set(many.map(w => normalizeWord(w.word))).size).toBe(60);
  });

  it('words played recently on this device are left out while others remain', () => {
    const first = createForca(seats, 5, 'pt');
    const avoid = new Set(first.words.map(w => w.word));
    for (let seed = 0; seed < 50; seed++) {
      const next = createForca(seats, seed, 'pt', 'list', avoid);
      for (const w of next.words) expect(avoid.has(w.word)).toBe(false);
    }
    // The module remembers in memory when there is no storage (as in these tests).
    const a = forcaModule.create(seats, { words: 'en', mode: 'list' }, 11) as ForcaInstance;
    const b = forcaModule.create(seats, { words: 'en', mode: 'list' }, 11) as ForcaInstance;
    const seen = new Set(a.state.words.map(w => w.word));
    for (const w of b.state.words) expect(seen.has(w.word)).toBe(false);
  });

  it('parses the lobby options, list words by default', () => {
    expect(forcaModule.defaultOptions()).toEqual({ words: 'pt', mode: 'list' });
    expect(forcaModule.parseOptions({ words: 'en', mode: 'written' })).toEqual({ words: 'en', mode: 'written' });
    expect(forcaModule.parseOptions({ mode: 'bogus' })).toEqual({ words: 'pt', mode: 'list' });
  });
});

describe('forca word lists', () => {
  const allowed = /^[A-ZÀ-ÖØ-Þ]+([ -][A-ZÀ-ÖØ-Þ]+)*$/u;

  it('are big, clean and without duplicates', () => {
    for (const bank of [FORCA_PT, FORCA_EN]) {
      let total = 0;
      for (const [category, words] of Object.entries(bank)) {
        total += words.length;
        expect(words.length, category).toBeGreaterThanOrEqual(60);
        expect(new Set(words.map(normalizeWord)).size, `duplicates in ${category}`).toBe(words.length);
        for (const w of words) {
          expect(w, `${category}: ${w}`).toMatch(allowed);
          expect(w.normalize('NFC')).toBe(w);
          expect('error' in cleanSecret(w) ? w : null, 'every list word must also be a valid written word').toBeNull();
        }
      }
      expect(total).toBeGreaterThanOrEqual(500);
    }
  });

  it('CEP has all 27 federative units and all 27 capitals', () => {
    expect(new Set(BR_STATES).size).toBe(27);
    expect(new Set(BR_CAPITALS).size).toBe(27);
    for (const bank of [FORCA_PT[CEP_PT]!, FORCA_EN[CEP_EN]!]) {
      for (const name of [...BR_STATES, ...BR_CAPITALS]) expect(bank).toContain(name);
    }
    for (const name of ['RIO GRANDE DO SUL', 'SÃO PAULO', 'DISTRITO FEDERAL', 'FLORIANÓPOLIS', 'BRASIL', 'ALEMANHA']) expect(FORCA_PT[CEP_PT]).toContain(name);
    expect(FORCA_EN[CEP_EN]).toContain('GERMANY');
  });
});

describe('forca: a player writes the word', () => {
  function written(n = 3, seed = 7): ForcaInstance {
    const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
    return new ForcaInstance(createForca(players, seed, 'pt', 'written'));
  }

  it('validates the word and the hint', () => {
    expect(cleanSecret('  rio  grande do sul ')).toEqual({ word: 'RIO GRANDE DO SUL' });
    expect(cleanSecret('guarda-chuva')).toEqual({ word: 'GUARDA-CHUVA' });
    expect(cleanSecret('Ação')).toEqual({ word: 'AÇÃO' });
    expect(cleanSecret('ab')).toEqual({ error: 'The word is too short' });
    expect(cleanSecret('a-b')).toEqual({ error: 'The word is too short' });
    expect(cleanSecret('abc1')).toEqual({ error: 'Use only letters, spaces and hyphens' });
    expect(cleanSecret('abc!')).toEqual({ error: 'Use only letters, spaces and hyphens' });
    expect(cleanSecret('-abc')).toEqual({ error: 'Use only letters, spaces and hyphens' });
    expect(cleanSecret('ab--cd')).toEqual({ error: 'Use only letters, spaces and hyphens' });
    expect(cleanSecret('a'.repeat(17))).toEqual({ error: 'The word is too long' });
    expect(cleanSecret('abcd '.repeat(7))).toEqual({ error: 'The word is too long' });
    expect(cleanSecret('')).toEqual({ error: 'Type the word' });
    expect(cleanSecret(42)).toEqual({ error: 'Type the word' });

    const inst = written();
    const w = inst.state.writer!;
    expect(applyForca(inst.state, w, { type: 'write', word: 'x1' })).toEqual({ ok: false, reason: 'Use only letters, spaces and hyphens' });
    expect(applyForca(inst.state, w, { type: 'write', word: 'casa', hint: 'x'.repeat(31) })).toEqual({ ok: false, reason: 'The hint is too long' });
    expect(applyForca(inst.state, (w + 1) % 3, { type: 'write', word: 'casa' })).toEqual({ ok: false, reason: 'Not your turn' });
    expect(applyForca(inst.state, (w + 1) % 3, { type: 'letter', letter: 'A' })).toEqual({ ok: false, reason: 'Wait for the word' });
    expect(inst.state.phase).toBe('write');
  });

  it('never sends the secret to the guessers, and the writer only watches', () => {
    const inst = written();
    const s = inst.state;
    const w = s.writer!;
    const fallback = s.words[0]!.word;
    for (const p of s.players) {
      const json = JSON.stringify(inst.viewFor(p.id));
      expect(json).not.toContain(fallback);
      expect(inst.viewFor(p.id).pattern).toEqual([]);
    }
    expect(applyForca(s, w, { type: 'write', word: 'jabuticabeira', hint: 'Árvore' })).toEqual({ ok: true });
    expect(s.current).not.toBe(w);
    for (const p of s.players) {
      const view = inst.viewFor(p.id);
      const json = JSON.stringify(view);
      if (view.me === w) expect(view.secret).toBe('JABUTICABEIRA');
      else {
        expect(json).not.toMatch(/JABUTICABEIRA/i);
        expect(view.secret).toBeUndefined();
      }
      expect(view.category).toBe('Árvore');
      expect(view.pattern).toHaveLength(13);
      expect(json.length).toBeLessThan(4000);
    }
    expect(applyForca(s, w, { type: 'letter', letter: 'A' })).toEqual({ ok: false, reason: 'You wrote this word' });
    // The turn never lands on the writer.
    for (let i = 0; i < 20 && !s.roundOver; i++) {
      const letter = 'ZQXWYKVFGHMPDLNOSTRUC'.split('').find(l => !s.guessed.includes(l))!;
      applyForca(s, s.current, { type: 'letter', letter });
      expect(s.current).not.toBe(w);
    }
  });

  it('scores the writer per miss plus a bonus when the group is hanged', () => {
    const inst = written(3, 2);
    const s = inst.state;
    const w = s.writer!;
    applyForca(s, w, { type: 'write', word: 'casa' });
    applyForca(s, s.current, { type: 'letter', letter: 'Z' });
    expect(s.scores[w]).toBe(WRITER_MISS_POINTS);
    applyForca(s, s.current, { type: 'solve', word: 'cosa' });
    expect(s.scores[w]).toBe(2 * WRITER_MISS_POINTS);
    applyForca(s, s.current, { type: 'solve', word: 'casa' });
    expect(s.roundOver?.solvedBy).not.toBe(w);
    expect(s.scores[w]).toBe(2 * WRITER_MISS_POINTS);

    applyForca(s, 0, { type: 'next' });
    const w2 = s.writer!;
    const before = s.scores[w2]!;
    expect(w2).toBe((w + 1) % 3);
    applyForca(s, w2, { type: 'write', word: 'xyz' });
    playRound(s, 'ABCDEFGHI');
    expect(s.roundOver?.solvedBy).toBeNull();
    expect(s.scores[w2]! - before).toBe(MAX_MISSES * WRITER_MISS_POINTS + WRITER_HANG_BONUS);
  });

  it('everyone writes the same number of times before the match ends', () => {
    for (const n of [2, 3, 4, 5]) {
      const inst = written(n, n);
      const s = inst.state;
      expect(s.words).toHaveLength(roundsFor('written', n));
      const writes = Array(n).fill(0) as number[];
      while (!inst.over) {
        if (s.roundOver) {
          applyForca(s, 0, { type: 'next' });
          continue;
        }
        writes[s.writer!]++;
        expect(applyForca(s, s.writer!, { type: 'write', word: 'ovo' })).toEqual({ ok: true });
        playRound(s, 'OVABC');
      }
      expect(new Set(writes).size).toBe(1);
      expect(writes[0]).toBe(n <= 3 ? 2 : 1);
    }
  });

  it('a silent writer falls back to a list word and the role moves on', () => {
    let now = 0;
    const inst = new ForcaInstance(createForca(seats, 9, 'pt', 'written'), () => now);
    const s = inst.state;
    const w = s.writer!;
    const other = (w + 1) % 3;
    expect(applyForca(s, other, { type: 'skip' })).toEqual({ ok: false, reason: 'The writer still has time' });
    expect(inst.apply(seats[other]!.id, { type: 'skip' })).toEqual({ ok: false, reason: 'The writer still has time' });
    expect(inst.viewFor(seats[other]!.id).skipInMs).toBe(WRITE_SKIP_MS);
    now = WRITE_SKIP_MS;
    expect(inst.apply(seats[other]!.id, { type: 'skip' })).toEqual({ ok: true });
    expect(s.phase).toBe('guess');
    expect(s.writer).toBeNull();
    expect(s.current).toBe(other);
    expect(inst.viewFor(seats[w]!.id).pattern).toHaveLength([...s.words[0]!.word].length);
    // The former writer guesses along and earns nothing as writer.
    playRound(s);
    expect(s.log.some(e => e.k === 'fallback' && e.seat === w)).toBe(true);
    applyForca(s, 0, { type: 'next' });
    expect(s.writer).toBe((w + 1) % 3);

    // The turn clock running out does the same, and so does the writer passing.
    inst.expire('turn', 1);
    expect(s.phase).toBe('guess');
    expect(s.writer).toBeNull();
    playRound(s);
    applyForca(s, 0, { type: 'next' });
    expect(applyForca(s, s.writer!, { type: 'skip' })).toEqual({ ok: true });
    expect(s.writer).toBeNull();
  });
});
