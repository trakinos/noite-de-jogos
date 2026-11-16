import { describe, expect, it } from 'vitest';
import { applyPista, createPista, DUET_GRID, DUET_TURNS, DUET_WORDS, pistaView, PistaInstance, TEAM_COLORS, type PistaState, type Team } from './game';
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

describe('pista certa against the rival (3 players)', () => {
  const pair = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];

  it('three players share the red team, which starts with nine words', () => {
    const s = createPista(pair, 4, 'pt');
    expect(s.mode).toBe('solo');
    expect(s.members.map(m => [m.team, m.role])).toEqual([['red', 'chief'], ['red', 'guess'], ['red', 'guess']]);
    expect(s.first).toBe('red');
    expect(applyPista(s, 1, { type: 'join', team: 'blue', role: 'guess' }).ok).toBe(false);
    expect(applyPista(s, 0, { type: 'begin' }).ok).toBe(true);
  });

  it('after the team stops, the rival uncovers one blue word and the team goes again', () => {
    const s = createPista(pair, 4, 'pt');
    applyPista(s, 0, { type: 'begin' });
    applyPista(s, 0, { type: 'clue', word: 'XYZ', count: 1 });
    const neutral = s.kinds.indexOf('neutral');
    applyPista(s, 1, { type: 'reveal', card: neutral });
    expect(s.turn).toBe('red');
    expect(s.phase).toBe('clue');
    expect(s.kinds.filter((k, i) => k === 'blue' && s.revealed[i])).toHaveLength(1);
    expect(s.log.at(-1)).toMatchObject({ kind: 'reveal', seat: null, team: 'blue', card: 'blue' });
  });

  it('the rival wins when it uncovers its last word', () => {
    const s = createPista(pair, 9, 'pt');
    applyPista(s, 0, { type: 'begin' });
    for (let round = 0; round < 8 && !s.winner; round++) {
      applyPista(s, 0, { type: 'clue', word: `X${round}`, count: 1 });
      // A neutral word ends the turn; once those run out, a blue one does (and helps the rival).
      const miss = s.kinds.findIndex((k, i) => (k === 'neutral' || k === 'blue') && !s.revealed[i]);
      applyPista(s, 1, { type: 'reveal', card: miss });
    }
    expect(s.winner).toBe('blue');
  });
});

describe('pista certa team colours', () => {
  it('teams start red and blue, and a member changes their own team colour', () => {
    const s = createPista(seats, 1, 'pt');
    expect(s.colors).toEqual({ red: 'red', blue: 'blue' });
    // Seat 0 is on the red team, seat 1 on blue.
    expect(applyPista(s, 0, { type: 'color', team: 'red', color: 'green' })).toEqual({ ok: true });
    expect(applyPista(s, 3, { type: 'color', team: 'blue', color: 'pink' })).toEqual({ ok: true });
    expect(s.colors).toEqual({ red: 'green', blue: 'pink' });
    for (const seat of [0, 1, 2, 3]) expect(pistaView(s, seat).colors).toEqual({ red: 'green', blue: 'pink' });
  });

  it("refuses the other team's colour, another team's choice, unknown colours and changes after the start", () => {
    const s = createPista(seats, 1, 'pt');
    expect(applyPista(s, 0, { type: 'color', team: 'red', color: 'blue' })).toEqual({ ok: false, reason: 'The other team has that colour' });
    expect(applyPista(s, 0, { type: 'color', team: 'blue', color: 'teal' })).toEqual({ ok: false, reason: 'Only the team picks its colour' });
    expect(applyPista(s, 0, { type: 'color', team: 'red', color: 'beige' as never }).ok).toBe(false);
    expect(s.colors).toEqual({ red: 'red', blue: 'blue' });
    applyPista(s, 0, { type: 'begin' });
    expect(applyPista(s, 0, { type: 'color', team: 'red', color: 'green' })).toEqual({ ok: false, reason: 'Teams are set' });
  });

  it('the palette has distinct colours and both defaults', () => {
    expect(new Set(TEAM_COLORS).size).toBe(TEAM_COLORS.length);
    expect(TEAM_COLORS.length).toBeGreaterThanOrEqual(6);
    expect(TEAM_COLORS).toContain('red');
    expect(TEAM_COLORS).toContain('blue');
  });

  it('against the rival, picking its colour swaps the two', () => {
    const s = createPista(seats.slice(0, 3), 1, 'pt');
    expect(applyPista(s, 2, { type: 'color', team: 'red', color: 'blue' })).toEqual({ ok: true });
    expect(s.colors).toEqual({ red: 'blue', blue: 'red' });
    expect(applyPista(s, 1, { type: 'color', team: 'blue', color: 'orange' })).toEqual({ ok: true });
    expect(s.colors).toEqual({ red: 'blue', blue: 'orange' });
  });
});

describe('pista certa for two (cooperative)', () => {
  const pair = seats.slice(0, 2);
  const duet = (seed = 5): PistaState => {
    const s = createPista(pair, seed, 'pt');
    expect(applyPista(s, 0, { type: 'begin' })).toEqual({ ok: true });
    return s;
  };
  const giver = (s: PistaState) => s.members.findIndex(m => m.role === 'chief');
  /** Unrevealed cards of `kind` on the current giver's key that the guesser hasn't tried. */
  const cards = (s: PistaState, kind: string) =>
    s.keys![giver(s)]!.map((k, i) => (k === kind && !s.revealed[i] && !s.misses![1 - giver(s)]![i] ? i : -1)).filter(i => i >= 0);
  /** Plays one turn: a clue, then the guesser reveals `picks` in order. */
  const turn = (s: PistaState, picks: number[]) => {
    const g = giver(s);
    expect(applyPista(s, g, { type: 'clue', word: `Q${s.turnNumber}`, count: 1 })).toEqual({ ok: true });
    for (const card of picks) expect(applyPista(s, 1 - g, { type: 'reveal', card })).toEqual({ ok: true });
  };

  it('deals a 30-card table with two keys: 11 words and 3 bombs each, 18 words in all', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = createPista(pair, seed, 'en');
      expect(s.mode).toBe('duet');
      expect(s.words).toHaveLength(DUET_GRID);
      expect(new Set(s.words).size).toBe(DUET_GRID);
      const [a, b] = s.keys!;
      for (const key of [a, b]) {
        expect(key.filter(k => k === 'red')).toHaveLength(11);
        expect(key.filter(k => k === 'bomb')).toHaveLength(3);
        expect(key.filter(k => k === 'neutral')).toHaveLength(16);
      }
      const both = (x: string, y: string) => a.filter((k, i) => k === x && b[i] === y).length;
      expect(both('red', 'red')).toBe(4);
      expect(both('red', 'bomb')).toBe(1);
      expect(both('bomb', 'red')).toBe(1);
      expect(both('bomb', 'bomb')).toBe(1);
      expect(a.filter((k, i) => k === 'red' || b[i] === 'red')).toHaveLength(DUET_WORDS);
      expect(pistaView(s, 0).left.red).toBe(DUET_WORDS);
      expect(s.turnsLeft).toBe(DUET_TURNS);
    }
  });

  it('there is no rival and no second team; either player may take the first clue', () => {
    const s = createPista(pair, 5, 'pt');
    expect(s.members.map(m => [m.team, m.role])).toEqual([['red', 'chief'], ['red', 'guess']]);
    expect(applyPista(s, 1, { type: 'join', team: 'blue', role: 'guess' }).ok).toBe(false);
    expect(applyPista(s, 1, { type: 'join', team: 'red', role: 'chief' })).toEqual({ ok: true });
    expect(s.members.map(m => m.role)).toEqual(['guess', 'chief']);
    expect(applyPista(s, 1, { type: 'join', team: 'red', role: 'guess' })).toEqual({ ok: true });
    expect(s.members.map(m => m.role)).toEqual(['chief', 'guess']);
    expect(applyPista(s, 1, { type: 'color', team: 'red', color: 'purple' })).toEqual({ ok: true });
    expect(pistaView(s, 0).colors.red).toBe('purple');
    expect(applyPista(s, 1, { type: 'begin' })).toEqual({ ok: true });
  });

  it("each view carries only that player's key, before, during and after the game", () => {
    const s = duet();
    const check = () => {
      for (const seat of [0, 1]) {
        const v = pistaView(s, seat);
        const own = s.keys![seat]!;
        v.kinds.forEach((k, i) => expect(k).toBe(s.revealed[i] ? (i === s.bombAt ? 'bomb' : 'red') : own[i]));
        // Nothing else in the view holds the keys.
        const { kinds: _kinds, ...rest } = v;
        expect(JSON.stringify(rest)).not.toContain('"keys"');
        expect(Object.keys(v).sort()).toEqual(Object.keys(pistaView(createPista(seats, 1, 'pt'), 0)).sort());
        expect(JSON.stringify(v).length).toBeLessThan(6000);
      }
    };
    check();
    // The two keys differ, so seeing one's own is not seeing the partner's.
    expect(pistaView(s, 0).kinds).not.toEqual(pistaView(s, 1).kinds);
    turn(s, [cards(s, 'red')[0]!, cards(s, 'neutral')[0]!]);
    check();
    turn(s, [cards(s, 'bomb')[0]!]);
    expect(s.winner).not.toBeNull();
    check();
  });

  it('a guess is judged by the clue giver\'s key; a hit goes on, a miss ends the turn and the roles swap', () => {
    const s = duet();
    expect(giver(s)).toBe(0);
    // Only the giver gives the clue, only the partner guesses.
    expect(applyPista(s, 1, { type: 'clue', word: 'XYZ', count: 2 }).ok).toBe(false);
    expect(applyPista(s, 0, { type: 'clue', word: 'XYZ', count: 1 })).toEqual({ ok: true });
    expect(s.guessesLeft).toBeNull();
    expect(applyPista(s, 0, { type: 'reveal', card: 0 }).ok).toBe(false);
    const [hit1, hit2, hit3] = cards(s, 'red');
    for (const card of [hit1!, hit2!, hit3!]) expect(applyPista(s, 1, { type: 'reveal', card })).toEqual({ ok: true });
    // Three hits on a clue of 1: guesses are not limited, and it is still the same turn.
    expect(giver(s)).toBe(0);
    expect(s.phase).toBe('guess');
    expect(s.revealed.filter(Boolean)).toHaveLength(3);
    const miss = cards(s, 'neutral')[0]!;
    expect(applyPista(s, 1, { type: 'reveal', card: miss })).toEqual({ ok: true });
    expect(s.revealed[miss]).toBe(false);
    expect(s.misses![1]![miss]).toBe(true);
    expect(pistaView(s, 0).misses![miss]).toBe(2);
    expect(s.turnsLeft).toBe(DUET_TURNS - 1);
    expect(s.phase).toBe('clue');
    expect(giver(s)).toBe(1);
    // Now seat 1 gives the clue and seat 0 guesses.
    expect(applyPista(s, 0, { type: 'clue', word: 'ABC', count: 1 }).ok).toBe(false);
    expect(applyPista(s, 1, { type: 'clue', word: 'ABC', count: 1 })).toEqual({ ok: true });
    expect(applyPista(s, 1, { type: 'reveal', card: cards(s, 'red')[0]! }).ok).toBe(false);
    expect(applyPista(s, 0, { type: 'reveal', card: cards(s, 'red')[0]! })).toEqual({ ok: true });
    expect(applyPista(s, 0, { type: 'pass' })).toEqual({ ok: true });
    expect(giver(s)).toBe(0);
    expect(s.turnsLeft).toBe(DUET_TURNS - 2);
    // Seat 1 can't try again the word it already missed.
    applyPista(s, 0, { type: 'clue', word: 'DEF', count: 1 });
    expect(applyPista(s, 1, { type: 'reveal', card: miss })).toEqual({ ok: false, reason: 'You already tried that word' });
    expect(applyPista(s, 1, { type: 'mark', card: miss }).ok).toBe(false);
  });

  it('finding all 18 words wins together', () => {
    const s = duet(8);
    for (let n = 0; n < 4 && !s.winner; n++) turn(s, cards(s, 'red'));
    expect(s.winner).toBe('red');
    expect(s.endReason).toBe('found');
    expect(pistaView(s, 1).left.red).toBe(0);
    expect(s.turnsLeft).toBeGreaterThan(0);
    expect(new PistaInstance(s).over).toBe(true);
  });

  it('once a key has no words left, its owner stops giving clues', () => {
    const s = duet(8);
    turn(s, cards(s, 'red'));
    // Seat 0's words are all found, which ended the turn; seat 1 gives clues from now on.
    expect(s.winner).toBeNull();
    expect(giver(s)).toBe(1);
    turn(s, [cards(s, 'neutral')[0]!]);
    expect(giver(s)).toBe(1);
  });

  it('a bomb on the clue giver\'s key loses at once', () => {
    const s = duet();
    turn(s, [cards(s, 'bomb')[0]!]);
    expect(s.winner).toBe('blue');
    expect(s.endReason).toBe('bomb');
    expect(pistaView(s, 0).kinds[s.bombAt!]).toBe('bomb');
    expect(applyPista(s, 0, { type: 'clue', word: 'MAIS', count: 1 }).ok).toBe(false);
  });

  it('running out of turns loses, whether they end by a miss or by the clock', () => {
    const s = duet();
    const inst = new PistaInstance(s);
    for (let n = 0; n < DUET_TURNS - 1; n++) {
      if (n % 2 === 0) turn(s, [cards(s, 'neutral')[0]!]);
      else inst.expire('turn', 0);
      expect(s.winner).toBeNull();
    }
    expect(s.turnsLeft).toBe(1);
    expect(inst.clockInput().currentPlayer).toBe(giver(s));
    turn(s, [cards(s, 'neutral')[0]!]);
    expect(s.winner).toBe('blue');
    expect(s.endReason).toBe('turns');
    expect(s.log.at(-1)).toEqual({ kind: 'win', team: 'blue', reason: 'turns' });
  });
});
