import { describe, expect, it } from 'vitest';
import { applyPista, createPista, pistaView, PistaInstance, type PistaState, type Team } from './game';
import { WORDS_EN, WORDS_PT } from './words';

const seats = ['a', 'b', 'c', 'd'].map(id => ({ id, name: id.toUpperCase() }));

function started(seed = 3): PistaState {
  const s = createPista(seats, seed, 'pt');
  expect(applyPista(s, 0, { type: 'begin' })).toEqual({ ok: true });
  return s;
}

/** Seats for the team on turn: [chief, guesser]. */
function crew(s: PistaState, team: Team = s.turn): [number, number] {
  const chief = s.members.findIndex(m => m.team === team && m.role === 'chief');
  const guesser = s.members.findIndex(m => m.team === team && m.role === 'guess');
  return [chief, guesser];
}

describe('pista certa', () => {
  it('word pools have no duplicates and plenty of words', () => {
    for (const pool of [WORDS_PT, WORDS_EN]) {
      expect(new Set(pool).size).toBe(pool.length);
      expect(pool.length).toBeGreaterThan(150);
    }
  });

  it('deals 9 / 8 / 7 / 1 with the first team holding nine', () => {
    const s = createPista(seats, 7, 'en');
    expect(s.words).toHaveLength(25);
    expect(s.kinds.filter(k => k === s.first)).toHaveLength(9);
    expect(s.kinds.filter(k => k === 'neutral')).toHaveLength(7);
    expect(s.kinds.filter(k => k === 'bomb')).toHaveLength(1);
  });

  it('teams need one chief and two players each', () => {
    const s = createPista(seats, 1, 'pt');
    applyPista(s, 3, { type: 'join', team: 'red', role: 'guess' });
    expect(applyPista(s, 0, { type: 'begin' })).toEqual({ ok: false, reason: 'Each team needs at least two players' });
    applyPista(s, 3, { type: 'join', team: 'blue', role: 'chief' });
    expect(s.members[1]!.role).toBe('guess');
    expect(applyPista(s, 0, { type: 'begin' }).ok).toBe(true);
  });

  it('guessers only see revealed colors; chiefs see all', () => {
    const s = started();
    const [chief, guesser] = crew(s);
    expect(pistaView(s, chief).kinds.every(k => k !== null)).toBe(true);
    expect(pistaView(s, guesser).kinds.every(k => k === null)).toBe(true);
  });

  it('refuses clues that are on the table or not one word', () => {
    const s = started();
    const [chief, guesser] = crew(s);
    expect(applyPista(s, guesser, { type: 'clue', word: 'mar', count: 1 }).ok).toBe(false);
    expect(applyPista(s, chief, { type: 'clue', word: 'dois termos', count: 1 }).ok).toBe(false);
    const onTable = s.words[0]!.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    expect(applyPista(s, chief, { type: 'clue', word: onTable, count: 1 })).toEqual({ ok: false, reason: 'The clue cannot be a word on the table' });
  });

  it('a right guess continues, a wrong one passes the turn, count+1 guesses at most', () => {
    const s = started();
    const team = s.turn;
    const [chief, guesser] = crew(s);
    applyPista(s, chief, { type: 'clue', word: 'XYZ', count: 1 });
    const mine = s.kinds.map((k, i) => (k === team ? i : -1)).filter(i => i >= 0);
    expect(applyPista(s, guesser, { type: 'pass' }).ok).toBe(false);
    applyPista(s, guesser, { type: 'reveal', card: mine[0]! });
    expect(s.turn).toBe(team);
    applyPista(s, guesser, { type: 'reveal', card: mine[1]! });
    // Two guesses on a clue of 1 uses them up.
    expect(s.turn).not.toBe(team);
    expect(s.phase).toBe('clue');
  });

  it('the bomb loses the game for the team that touched it', () => {
    const s = started();
    const team = s.turn;
    const [chief, guesser] = crew(s);
    applyPista(s, chief, { type: 'clue', word: 'XYZ', count: 2 });
    applyPista(s, guesser, { type: 'reveal', card: s.kinds.indexOf('bomb') });
    expect(s.winner).toBe(team === 'red' ? 'blue' : 'red');
    expect(s.endReason).toBe('bomb');
  });

  it('finding every word wins', () => {
    const s = started();
    const team = s.turn;
    const [chief, guesser] = crew(s);
    applyPista(s, chief, { type: 'clue', word: 'TUDO', count: 0 });
    for (const [i, k] of s.kinds.entries()) if (k === team) applyPista(s, guesser, { type: 'reveal', card: i });
    expect(s.winner).toBe(team);
  });

  it('a timed-out turn passes to the other team; teams phase stops the clock', () => {
    const inst = new PistaInstance(createPista(seats, 2, 'pt'));
    expect(inst.clockInput().over).toBe(true);
    applyPista(inst.state, 0, { type: 'begin' });
    const team = inst.state.turn;
    expect(inst.clockInput().over).toBe(false);
    inst.expire('turn', 0);
    expect(inst.state.turn).not.toBe(team);
  });
});
