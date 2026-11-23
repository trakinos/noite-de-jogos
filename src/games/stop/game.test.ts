import { describe, expect, it } from 'vitest';
import {
  applyStop, CATEGORIES, cleanAnswer, createStop, DEFAULT_CATEGORIES, defaultStopOptions, GRACE_MS, INTRO_MS, LETTERS, markRound, MAX_ANSWER, normalize,
  REVIEW_MS, StopInstance, stopModule, stopView, votesNeeded, type StopOptions, type StopState,
} from './game';

const seats = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
const three: StopOptions = { rounds: 3, seconds: 60, categories: ['nome', 'animal', 'cor'] };

function game(options: StopOptions = three, players = seats, seed = 7): StopState {
  return createStop(players, options, seed, 0);
}

/** Answers for every category of the round, all starting with its letter. */
function sheet(s: StopState, suffixes: string[]): string[] {
  return suffixes.map(x => (x === '' ? '' : s.letters[s.round] + x));
}

/** Writes each player's sheet, then lets the time run out so the review opens. */
function toReview(s: StopState, sheets: string[][], now: number): void {
  sheets.forEach((answers, seat) => applyStop(s, seat, { type: 'answers', answers }, now));
  applyStop(s, 0, { type: 'tick' }, s.deadline!);
  expect(s.phase).toBe('review');
}

describe('stop', () => {
  it('draws a different letter each round and never a hard one', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = createStop(seats, { ...defaultStopOptions(), rounds: 10 }, seed, 0);
      expect(s.letters).toHaveLength(10);
      expect(new Set(s.letters).size).toBe(10);
      for (const l of s.letters) expect('KQWXY').not.toContain(l);
    }
    expect(LETTERS).toHaveLength(21);
  });

  it('cleans answers: single spaces, capped length, stable when cleaned twice', () => {
    expect(cleanAnswer('  São   Paulo ')).toBe('São Paulo');
    expect(cleanAnswer(42)).toBe('');
    const long = cleanAnswer(`${'a'.repeat(MAX_ANSWER - 1)} bcd`);
    expect(long).toHaveLength(MAX_ANSWER - 1);
    expect(cleanAnswer(long)).toBe(long);
    expect(normalize(' São-Paulo ')).toBe('sao paulo');
  });

  it("keeps everyone else's answers out of the view while writing", () => {
    const s = game();
    const secret = sheet(s, ['zzsecret', 'zzhidden', '']);
    applyStop(s, 0, { type: 'answers', answers: secret }, 1000);
    const other = stopView(s, 1, 1000);
    expect(other.answers).toBeNull();
    expect(other.marks).toBeNull();
    expect(other.rejects).toBeNull();
    expect(other.roundPoints).toBeNull();
    expect(other.mine).toEqual(['', '', '']);
    expect(other.filled).toEqual([2, 0, 0]);
    expect(JSON.stringify(other).toLowerCase()).not.toContain('zzsecret');
    expect(JSON.stringify(other).toLowerCase()).not.toContain('zzhidden');
    const own = stopView(s, 0, 1000);
    expect(own.mine).toEqual(secret);
    expect(own.endsInMs).toBe(59_000 + INTRO_MS);
    expect(own.introMs).toBe(INTRO_MS - 1000);
  });

  it('refuses STOP until every category has a word with the letter', () => {
    const s = game();
    expect(applyStop(s, 0, { type: 'stop', answers: sheet(s, ['a', 'b', '']) }, 10)).toEqual({ ok: false, reason: 'Fill every category first' });
    expect(applyStop(s, 0, { type: 'stop', answers: [...sheet(s, ['a', 'b']), '123'] }, 10)).toEqual({ ok: false, reason: 'Fill every category first' });
    expect(s.stopBy).toBeNull();
    expect(applyStop(s, 0, { type: 'stop', answers: sheet(s, ['a', 'b', 'c']) }, 5000)).toEqual({ ok: true });
    expect(s.stopBy).toBe(0);
    expect(s.deadline).toBe(5000 + GRACE_MS);
    expect(stopView(s, 1, 5000).totalMs).toBe(GRACE_MS);
  });

  it('gives the others a short grace after STOP, then locks the sheets', () => {
    const s = game();
    applyStop(s, 0, { type: 'stop', answers: sheet(s, ['a', 'b', 'c']) }, 5000);
    // Still inside the grace: B finishes a word.
    applyStop(s, 1, { type: 'answers', answers: sheet(s, ['x', '', '']) }, 6000);
    expect(s.phase).toBe('writing');
    // A second STOP does not move the deadline.
    applyStop(s, 1, { type: 'stop' }, 6000);
    expect(s.deadline).toBe(5000 + GRACE_MS);
    applyStop(s, 2, { type: 'tick' }, 5000 + GRACE_MS - 1);
    expect(s.phase).toBe('writing');
    applyStop(s, 2, { type: 'tick' }, 5000 + GRACE_MS);
    expect(s.phase).toBe('review');
    expect(s.deadline).toBe(5000 + GRACE_MS + REVIEW_MS);
    expect(s.answers[1]![0]).toBe(`${s.letters[0]}x`);
    // Too late: the sheet is locked and the late answer changes nothing.
    expect(applyStop(s, 1, { type: 'answers', answers: sheet(s, ['x', 'y', 'z']) }, 9000)).toEqual({ ok: true });
    expect(s.answers[1]![1]).toBe('');
    expect(stopView(s, 1, 9000).answers![0]).toEqual(sheet(s, ['a', 'b', 'c']));
  });

  it('ends the round when the time runs out even if nobody stops', () => {
    const s = game();
    applyStop(s, 0, { type: 'answers', answers: sheet(s, ['a', '', '']) }, 100);
    applyStop(s, 1, { type: 'tick' }, 59_999 + INTRO_MS);
    expect(s.phase).toBe('writing');
    // The last words typed reach the host with the intent that finds the time over, and still count.
    applyStop(s, 1, { type: 'answers', answers: sheet(s, ['b', '', '']) }, 60_000 + INTRO_MS);
    expect(s.phase).toBe('review');
    expect(s.answers[1]![0]).toBe(`${s.letters[0]}b`);
    expect(s.log.at(-1)).toEqual({ k: 'lock', timeout: true });
    // STOP after the time is up is too late.
    const again = game();
    expect(applyStop(again, 0, { type: 'stop', answers: sheet(again, ['a', 'b', 'c']) }, 60_000 + INTRO_MS)).toEqual({ ok: true });
    expect(again.phase).toBe('review');
    expect(again.stopBy).toBeNull();
    expect(again.answers[0]).toEqual(['', '', '']);
  });

  it('scores 10 for a unique answer, 5 for a shared one, 0 for empty or wrong letter; accents and case do not matter', () => {
    const s = game();
    const l = s.letters[0]!;
    const wrong = l === 'A' ? 'Bola' : 'Abacate';
    toReview(s, [
      [`${l}ÁBIO`, `${l}ato`, ''],
      [`${l.toLowerCase()}abio `, `${l}ema`, wrong],
      [`${l}abiu`, ` ${l}ATO  `, `${l}uva`],
    ], 10);
    expect(markRound(s)).toEqual([
      ['shared', 'shared', 'empty'],
      ['shared', 'unique', 'letter'],
      ['unique', 'shared', 'unique'],
    ]);
    const view = stopView(s, 0, s.deadline! - REVIEW_MS);
    expect(view.roundPoints).toEqual([10, 15, 25]);
    expect(view.scores).toEqual([0, 0, 0]);
    for (const seat of [0, 1, 2]) applyStop(s, seat, { type: 'ready' }, 70_000);
    expect(s.phase).toBe('scores');
    expect(s.scores).toEqual([10, 15, 25]);
    expect(stopView(s, 0, 70_000).roundPoints).toEqual([10, 15, 25]);
    expect(stopView(s, 0, 70_000).endsInMs).toBeNull();
  });

  it('strikes an answer when most of the other players reject it, and the rest of the category is scored again', () => {
    expect([2, 3, 4, 5, 8].map(votesNeeded)).toEqual([1, 2, 2, 3, 4]);
    const s = game();
    toReview(s, [sheet(s, ['abc', 'x', 'y']), sheet(s, ['abc', 'w', 'q']), sheet(s, ['zzz', 'k', 'j'])], 10);
    expect(markRound(s).map(r => r[0])).toEqual(['shared', 'shared', 'unique']);
    expect(applyStop(s, 0, { type: 'vote', seat: 0, cat: 0 }, 61_000)).toEqual({ ok: false, reason: 'You cannot vote on your own answer' });
    applyStop(s, 1, { type: 'vote', seat: 0, cat: 0 }, 61_000);
    // One vote of two is not a majority.
    expect(markRound(s)[0]![0]).toBe('shared');
    applyStop(s, 2, { type: 'vote', seat: 0, cat: 0 }, 61_000);
    expect(markRound(s).map(r => r[0])).toEqual(['struck', 'unique', 'unique']);
    expect(stopView(s, 1, 61_000).rejects![0]![0]).toEqual([1, 2]);
    // A vote can be taken back.
    applyStop(s, 2, { type: 'vote', seat: 0, cat: 0 }, 62_000);
    expect(markRound(s)[0]![0]).toBe('shared');
    expect(applyStop(s, 0, { type: 'vote', seat: 9, cat: 0 }, 62_000)).toEqual({ ok: false, reason: 'Bad move' });
  });

  it('with two players the other one decides; empty answers cannot be voted on', () => {
    const two = seats.slice(0, 2);
    const s = game(three, two);
    toReview(s, [sheet(s, ['a', 'b', '']), sheet(s, ['c', 'd', 'e'])], 10);
    expect(applyStop(s, 1, { type: 'vote', seat: 0, cat: 2 }, 61_000)).toEqual({ ok: false, reason: 'That answer is already invalid' });
    applyStop(s, 1, { type: 'vote', seat: 0, cat: 0 }, 61_000);
    expect(markRound(s)[0]).toEqual(['struck', 'unique', 'empty']);
    applyStop(s, 0, { type: 'ready' }, 62_000);
    expect(s.phase).toBe('review');
    applyStop(s, 1, { type: 'ready' }, 62_000);
    expect(s.phase).toBe('scores');
    expect(s.scores).toEqual([10, 30]);
  });

  it('answers voted to be the same word score as repeated, for both players', () => {
    const s = game();
    toReview(s, [sheet(s, ['ato', 'ata', 'a1']), sheet(s, ['bo', 'ato', 'a2']), sheet(s, ['co', 'x', 'a3'])], 1000);
    // Category 1: A wrote "..ata", B wrote "..ato": different words, so both are unique for now.
    expect(markRound(s)[0]![1]).toBe('unique');
    expect(applyStop(s, 2, { type: 'same', a: 1, b: 0, cat: 1 }, 2000)).toEqual({ ok: true });
    expect(markRound(s)[0]![1]).toBe('unique');
    applyStop(s, 0, { type: 'same', a: 0, b: 1, cat: 1 }, 2000);
    expect(s.sames).toHaveLength(1);
    expect(markRound(s)[0]![1]).toBe('shared');
    expect(markRound(s)[1]![1]).toBe('shared');
    // Taking a vote back unlinks them again.
    applyStop(s, 0, { type: 'same', a: 0, b: 1, cat: 1 }, 2000);
    expect(markRound(s)[0]![1]).toBe('unique');
    expect(applyStop(s, 0, { type: 'same', a: 0, b: 0, cat: 1 }, 2000).ok).toBe(false);
  });

  it('closes a stalled review by itself', () => {
    const s = game();
    toReview(s, [sheet(s, ['a', 'b', 'c']), sheet(s, ['d', 'e', 'f']), sheet(s, ['g', 'h', 'i'])], 10);
    applyStop(s, 0, { type: 'ready' }, 61_000);
    applyStop(s, 1, { type: 'tick' }, s.deadline! - 1);
    expect(s.phase).toBe('review');
    applyStop(s, 1, { type: 'tick' }, s.deadline!);
    expect(s.phase).toBe('scores');
    expect(s.scores).toEqual([30, 30, 30]);
  });

  it('"next" starts one new round however many players press it', () => {
    const s = game();
    expect(applyStop(s, 0, { type: 'next', round: 0 }, 5)).toEqual({ ok: false, reason: 'The round is still going' });
    toReview(s, [sheet(s, ['a', 'b', 'c']), [], []], 10);
    for (const seat of [0, 1, 2]) applyStop(s, seat, { type: 'ready' }, 61_000);
    applyStop(s, 0, { type: 'next', round: 0 }, 100_000);
    expect(applyStop(s, 1, { type: 'next', round: 0 }, 100_001)).toEqual({ ok: true });
    expect(s.round).toBe(1);
    expect(s.phase).toBe('writing');
    expect(s.deadline).toBe(160_000 + INTRO_MS);
    expect(s.answers).toEqual([['', '', ''], ['', '', ''], ['', '', '']]);
    expect(s.ready).toEqual([false, false, false]);
    expect(stopView(s, 0, 100_000).letter).toBe(s.letters[1]);
  });

  it('plays every round to a final ranking, with small views throughout', () => {
    let now = 0;
    const eight = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `Player number ${i}` }));
    const options: StopOptions = { rounds: 10, seconds: 60, categories: [...CATEGORIES] };
    const inst = new StopInstance(createStop(eight, options, 3, now), () => now);
    const s = inst.state;
    let biggest = 0;
    const measure = () => {
      for (const p of eight) biggest = Math.max(biggest, JSON.stringify(inst.viewFor(p.id)).length);
    };
    expect(inst.clockInput().over).toBe(true);
    for (let round = 0; round < 10; round++) {
      expect(inst.over).toBe(false);
      // Player 0 always fills everything and stops; the others write the longest words allowed.
      eight.forEach((p, seat) => {
        const answers = options.categories.map(() => (seat === 0 ? `${s.letters[round]}a` : s.letters[round] + 'ã'.repeat(MAX_ANSWER - 1)));
        if (seat > 0) expect(inst.apply(p.id, { type: 'answers', answers })).toEqual({ ok: true });
        else expect(inst.apply(p.id, { type: 'stop', answers })).toEqual({ ok: true });
      });
      measure();
      now += GRACE_MS;
      inst.apply('p1', { type: 'tick' });
      expect(s.phase).toBe('review');
      for (let seat = 1; seat < 8; seat++) inst.apply(`p${seat}`, { type: 'vote', seat: 0, cat: 0 });
      measure();
      for (const p of eight) inst.apply(p.id, { type: 'ready' });
      expect(s.phase).toBe('scores');
      measure();
      if (round < 9) inst.apply('p3', { type: 'next', round });
    }
    expect(inst.over).toBe(true);
    // Player 0 is alone with a unique word in every category but the struck one; the other seven share theirs.
    expect(s.scores[0]).toBe(10 * (CATEGORIES.length - 1) * 10);
    expect(s.scores[1]).toBe(10 * CATEGORIES.length * 5);
    expect(s.winners).toEqual([0]);
    expect(inst.apply('p0', { type: 'next', round: 9 })).toEqual({ ok: false, reason: 'The game is over' });
    // PeerJS refuses messages of about 16 KB; the host also adds up to 150 log entries, which here are tiny.
    expect(biggest).toBeLessThan(12_000);
    expect(s.log.length).toBeLessThan(150);
  });

  it('shares the win on a tie', () => {
    const s = game({ ...three, rounds: 3 }, seats.slice(0, 2));
    for (let round = 0; round < 3; round++) {
      const now = round * 200_000;
      applyStop(s, 0, { type: 'answers', answers: sheet(s, ['a', '', '']) }, now);
      applyStop(s, 1, { type: 'answers', answers: sheet(s, ['b', '', '']) }, now);
      applyStop(s, 0, { type: 'tick' }, s.deadline!);
      applyStop(s, 0, { type: 'tick' }, s.deadline!);
      expect(s.phase).toBe('scores');
      if (round < 2) applyStop(s, 0, { type: 'next', round }, now + 190_000);
    }
    expect(s.scores).toEqual([30, 30]);
    expect(s.winners).toEqual([0, 1]);
  });

  it('parses the lobby options', () => {
    expect(stopModule.parseOptions(undefined)).toEqual({ rounds: 5, seconds: 90, categories: DEFAULT_CATEGORIES });
    expect(stopModule.parseOptions({ rounds: 7, seconds: 120, categories: ['cor', 'nome', 'sogra', 'bogus'] })).toEqual({ rounds: 7, seconds: 120, categories: ['nome', 'cor', 'sogra'] });
    expect(stopModule.parseOptions({ rounds: 99, seconds: 1 })).toEqual({ rounds: 5, seconds: 90, categories: DEFAULT_CATEGORIES });
    expect(stopModule.parseOptions({ categories: ['nome', 'cor'] })).toEqual({ error: 'Pick at least 3 categories' });
    expect(DEFAULT_CATEGORIES).toHaveLength(8);
  });

  it('rejects moves from strangers and malformed moves', () => {
    const s = game();
    expect(applyStop(s, -1, { type: 'tick' }, 0)).toEqual({ ok: false, reason: 'Not a player' });
    expect(applyStop(s, 0, null as never, 0)).toEqual({ ok: false, reason: 'Bad move' });
    expect(applyStop(s, 0, { type: 'bogus' } as never, 0)).toEqual({ ok: false, reason: 'Bad move' });
    expect(applyStop(s, 0, { type: 'answers', answers: 'x' as never }, 0)).toEqual({ ok: true });
    expect(s.answers[0]).toEqual(['', '', '']);
  });
});

describe('stop excluded letters', () => {
  it('never draws an excluded letter and refuses options with too few letters left', () => {
    const excluded = ['A', 'B', 'C', 'D', 'E'];
    for (let seed = 0; seed < 20; seed++) {
      const s = createStop([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { ...defaultStopOptions(), rounds: 10, excluded }, seed, 0);
      expect(s.letters.some(l => excluded.includes(l))).toBe(false);
      expect(new Set(s.letters).size).toBe(10);
    }
    expect(stopModule.parseOptions({ rounds: 10, excluded: 'ABCDEFGHIJLMNO'.split('') })).toHaveProperty('error');
    expect(stopModule.parseOptions({ rounds: 5, excluded: ['A', 'Z', 'K'] })).toMatchObject({ excluded: ['A', 'Z'] });
  });
});

describe('stop tab-away tracking', () => {
  it('records who is away and counts each departure while writing', () => {
    const s = createStop([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], defaultStopOptions(), 1, 0);
    expect(applyStop(s, 0, { type: 'away', away: true }, 5000)).toEqual({ ok: true });
    expect(stopView(s, 1, 5000).away).toEqual([true, false]);
    applyStop(s, 0, { type: 'away', away: true }, 5100);
    applyStop(s, 0, { type: 'away', away: false }, 5200);
    applyStop(s, 0, { type: 'away', away: true }, 5300);
    expect(s.awayCount).toEqual([2, 0]);
    expect(applyStop(s, 0, { type: 'away', away: 'yes' as unknown as boolean }, 5400).ok).toBe(false);
  });
});
