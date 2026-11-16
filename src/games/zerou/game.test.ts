import { describe, expect, it } from 'vitest';
import { createRng, nextInt } from '../../engine/rng';
import {
  ACCUSE_PENALTY, applyZerou, canPlay, createZerou, DECK_SIZE, FALSE_ACCUSE_PENALTY, fullDeck, HAND, RACE_MS, RACE_PENALTY, SWAP_COPIES,
  ZerouInstance, zerouView, type Card, type ZerouState,
} from './game';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const card = (id: number, color: Card['color'], value: Card['value']): Card => ({ id, color, value });

function rig(s: ZerouState, hand: Card[], topCard: Card) {
  s.hands[s.current] = hand;
  s.discard = [topCard];
  s.color = topCard.color!;
}

/** A game where seat 0 is to play, clockwise. */
function game(n: number): ZerouState {
  const s = createZerou(seats(n), 1);
  s.current = 0;
  s.dir = 1;
  return s;
}

describe('zerou!', () => {
  it('has 108 cards plus the Troca-Troca and deals seven each with a number face up', () => {
    expect(fullDeck()).toHaveLength(108 + SWAP_COPIES);
    expect(fullDeck().filter(c => c.value === 'swap')).toHaveLength(SWAP_COPIES);
    expect(new Set(fullDeck().map(c => c.id)).size).toBe(DECK_SIZE);
    const s = createZerou(seats(4), 2);
    expect(s.hands.every(h => h.length === HAND)).toBe(true);
    expect(s.discard[0]!.value).toMatch(/^[0-8]$/);
    expect(s.draw.length + s.discard.length + 4 * HAND).toBe(DECK_SIZE);
  });

  it('matches by color or symbol; +4 only without the current color', () => {
    const s = createZerou(seats(2), 1);
    rig(s, [card(900, 'r', '5'), card(901, null, 'wild4')], card(950, 'r', '2'));
    const hand = s.hands[s.current]!;
    expect(canPlay(s, hand, card(1, 'b', '2'))).toBe(true);
    expect(canPlay(s, hand, card(1, 'b', '7'))).toBe(false);
    expect(canPlay(s, hand, hand[1]!)).toBe(false);
  });

  it('skip, reverse with two players and +2 all hand the turn back', () => {
    const s = createZerou(seats(2), 1);
    const p = s.current;
    rig(s, [card(900, 'r', 'draw2'), card(901, 'r', 'rev'), card(902, 'r', '5')], card(950, 'r', '2'));
    const before = s.hands[1 - p]!.length;
    applyZerou(s, p, { type: 'play', card: 900 });
    expect(s.hands[1 - p]!.length).toBe(before + 2);
    expect(s.current).toBe(p);
    applyZerou(s, p, { type: 'play', card: 901 });
    expect(s.current).toBe(p);
  });

  it('a wild needs a color', () => {
    const s = createZerou(seats(3), 1);
    const p = s.current;
    rig(s, [card(900, null, 'wild'), card(901, 'g', '1')], card(950, 'r', '2'));
    expect(applyZerou(s, p, { type: 'play', card: 900 })).toEqual({ ok: false, reason: 'Pick a color' });
    applyZerou(s, p, { type: 'play', card: 900, color: 'g' });
    expect(s.color).toBe('g');
  });

  it('emptying the hand wins', () => {
    const s = game(2);
    rig(s, [card(900, 'r', '5')], card(950, 'r', '2'));
    applyZerou(s, 0, { type: 'play', card: 900 });
    expect(s.winner).toBe(0);
  });

  describe('accusing', () => {
    it('nothing happens by itself; a right accusation costs the accused 5, for as long as the card is uncalled', () => {
      const s = game(3);
      rig(s, [card(900, 'r', '5'), card(901, 'r', '6')], card(950, 'r', '2'));
      applyZerou(s, 0, { type: 'play', card: 900 });
      expect(s.hands[0]).toHaveLength(1);
      // The next player acts and the window stays open.
      s.hands[1] = [card(910, 'r', '1'), card(911, 'b', '1'), card(912, 'g', '4')];
      applyZerou(s, 1, { type: 'play', card: 910 });
      expect(s.hands[0]).toHaveLength(1);
      expect(applyZerou(s, 2, { type: 'accuse', target: 0 })).toEqual({ ok: true });
      expect(s.hands[0]).toHaveLength(1 + ACCUSE_PENALTY);
      expect(s.log.at(-1)).toMatchObject({ k: 'accuse', seat: 0, by: 2, right: true, n: ACCUSE_PENALTY });
    });

    it('a wrong accusation costs the accuser 2: more than one card, or one card that was called', () => {
      const s = game(3);
      const before = s.hands[2]!.length;
      applyZerou(s, 2, { type: 'accuse', target: 1 });
      expect(s.hands[2]).toHaveLength(before + FALSE_ACCUSE_PENALTY);
      expect(s.hands[1]).toHaveLength(HAND);

      rig(s, [card(900, 'r', '5'), card(901, 'r', '6')], card(950, 'r', '2'));
      applyZerou(s, 0, { type: 'play', card: 900, last: true });
      applyZerou(s, 1, { type: 'accuse', target: 0 });
      expect(s.hands[0]).toHaveLength(1);
      expect(s.hands[1]).toHaveLength(HAND + FALSE_ACCUSE_PENALTY);
    });

    it('calling late is safe while nobody has accused; you cannot accuse yourself', () => {
      const s = game(3);
      rig(s, [card(900, 'r', '5'), card(901, 'r', '6')], card(950, 'r', '2'));
      applyZerou(s, 0, { type: 'play', card: 900 });
      expect(applyZerou(s, 0, { type: 'accuse', target: 0 }).ok).toBe(false);
      applyZerou(s, 0, { type: 'last' });
      applyZerou(s, 2, { type: 'accuse', target: 0 });
      expect(s.hands[0]).toHaveLength(1);
      expect(s.hands[2]).toHaveLength(HAND + FALSE_ACCUSE_PENALTY);
    });
  });

  describe('cutting in', () => {
    it('an identical card goes down out of turn and play continues after whoever cut in', () => {
      const s = game(4);
      rig(s, [card(900, 'g', '1')], card(950, 'r', '5'));
      s.hands[2] = [card(910, 'r', '5'), card(911, 'b', '5'), card(912, 'g', '3')];
      expect(zerouView(s, 2).cut).toEqual([910]);
      // Same number in another color is not identical.
      expect(applyZerou(s, 2, { type: 'play', card: 911 })).toEqual({ ok: false, reason: 'Not your turn' });
      expect(applyZerou(s, 2, { type: 'play', card: 910 })).toEqual({ ok: true });
      expect(s.current).toBe(3);
      expect(s.discard.at(-1)!.id).toBe(910);
      expect(s.log.at(-1)).toMatchObject({ k: 'play', seat: 2, cut: true });
    });

    it('is too late once the current player has drawn', () => {
      const s = game(3);
      rig(s, [card(900, 'g', '1')], card(950, 'r', '5'));
      s.draw.push(card(960, 'r', '8'));
      s.hands[2] = [card(910, 'r', '5'), card(912, 'g', '3')];
      applyZerou(s, 0, { type: 'draw' });
      expect(s.drawn).toBe(960);
      expect(applyZerou(s, 2, { type: 'play', card: 910 })).toEqual({ ok: false, reason: 'Too late to cut in' });
      expect(zerouView(s, 2).cut).toEqual([]);
    });

    it("applies the card's effect from the player who cut in, and wilds never cut in", () => {
      const s = game(4);
      rig(s, [card(900, 'g', '1')], card(950, 'r', 'draw2'));
      s.hands[2] = [card(910, 'r', 'draw2'), card(912, 'g', '3')];
      applyZerou(s, 2, { type: 'play', card: 910 });
      expect(s.hands[3]).toHaveLength(HAND + 2);
      expect(s.current).toBe(0);

      s.discard.push(card(951, null, 'wild'));
      s.hands[2] = [card(913, null, 'wild'), card(914, 'g', '3')];
      expect(applyZerou(s, 2, { type: 'play', card: 913, color: 'r' }).ok).toBe(false);
    });

    it('can win the game, and counts for Última!', () => {
      const s = game(3);
      rig(s, [card(900, 'g', '1')], card(950, 'r', '5'));
      s.hands[2] = [card(910, 'r', '5'), card(912, 'g', '3')];
      applyZerou(s, 2, { type: 'play', card: 910, last: true });
      expect(s.called[2]).toBe(true);
      s.hands[1] = [card(920, 'r', '5')];
      s.current = 0;
      applyZerou(s, 1, { type: 'play', card: 920 });
      expect(s.winner).toBe(1);
    });
  });

  describe('the 9 race', () => {
    function nine(n: number): ZerouState {
      const s = game(n);
      rig(s, [card(900, 'r', '9'), card(901, 'g', '1'), card(902, 'g', '2')], card(950, 'r', '2'));
      expect(applyZerou(s, 0, { type: 'play', card: 900 }, 1000)).toEqual({ ok: true });
      return s;
    }

    it('pauses the game until everyone taps; the last one draws 2', () => {
      const s = nine(3);
      expect(s.race).not.toBeNull();
      expect(s.current).toBe(1);
      expect(zerouView(s, 1, 1000).playable).toEqual([]);
      expect(applyZerou(s, 1, { type: 'draw' }, 1100)).toEqual({ ok: false, reason: 'Tap the 9 first' });
      applyZerou(s, 2, { type: 'tap' }, 1200);
      expect(zerouView(s, 0, 1200).race).toMatchObject({ by: 0, tapped: [false, false, true], left: RACE_MS - 200 });
      applyZerou(s, 2, { type: 'tap' }, 1250);
      expect(s.race).not.toBeNull();
      applyZerou(s, 0, { type: 'tap' }, 1300);
      expect(s.race).toBeNull();
      expect(s.hands[1]).toHaveLength(HAND + RACE_PENALTY);
      expect(s.hands[0]).toHaveLength(2);
      expect(s.log.at(-1)).toEqual({ k: 'slow', seat: 1, n: RACE_PENALTY });
      expect(s.current).toBe(1);
      expect(applyZerou(s, 1, { type: 'draw' }, 1400).ok).toBe(true);
    });

    it('when time runs out, everyone who has not tapped draws', () => {
      const s = nine(4);
      applyZerou(s, 3, { type: 'tap' }, 1500);
      // Too early: nothing happens.
      applyZerou(s, 3, { type: 'raceEnd' }, 1600);
      expect(s.race).not.toBeNull();
      applyZerou(s, 3, { type: 'raceEnd' }, 1000 + RACE_MS);
      expect(s.race).toBeNull();
      expect(s.hands.map(h => h.length)).toEqual([2 + RACE_PENALTY, HAND + RACE_PENALTY, HAND + RACE_PENALTY, HAND]);
    });

    it('a late tap or any other move ends an expired race first', () => {
      const s = nine(3);
      applyZerou(s, 0, { type: 'tap' }, 1100);
      applyZerou(s, 1, { type: 'tap' }, 1000 + RACE_MS + 1);
      expect(s.race).toBeNull();
      expect(s.hands[1]).toHaveLength(HAND + RACE_PENALTY);
      expect(s.hands[2]).toHaveLength(HAND + RACE_PENALTY);
    });

    it("the host's clock sees the race as a prompt for everyone and can end it", () => {
      const s = game(3);
      rig(s, [card(900, 'r', '9'), card(901, 'g', '1')], card(950, 'r', '2'));
      const inst = new ZerouInstance(s, () => 1000);
      const turn = inst.clockInput().turn;
      inst.apply('p0', { type: 'play', card: 900 });
      const input = inst.clockInput();
      expect(input.pending).not.toBeNull();
      expect(input.pending!.player).not.toBe(input.currentPlayer);
      expect(inst.clockInput().pending).toBe(input.pending);
      inst.expire('response', 1);
      expect(s.race).toBeNull();
      expect(inst.clockInput().pending).toBeNull();
      expect(inst.clockInput().turn).not.toBe(turn);
      expect(s.hands.map(h => h.length)).toEqual([1 + RACE_PENALTY, HAND + RACE_PENALTY, HAND + RACE_PENALTY]);
    });

    it('winning with a 9 starts no race', () => {
      const s = game(2);
      rig(s, [card(900, 'r', '9')], card(950, 'r', '2'));
      applyZerou(s, 0, { type: 'play', card: 900 });
      expect(s.winner).toBe(0);
      expect(s.race).toBeNull();
    });
  });

  describe('Troca-Troca', () => {
    it('picks a color and swaps whole hands with the chosen player', () => {
      const s = game(3);
      rig(s, [card(900, null, 'swap'), card(901, 'g', '1'), card(902, 'g', '2')], card(950, 'r', '2'));
      const theirs = s.hands[2]!.slice();
      expect(applyZerou(s, 0, { type: 'play', card: 900, color: 'b' })).toEqual({ ok: false, reason: 'Pick a player' });
      expect(applyZerou(s, 0, { type: 'play', card: 900, color: 'b', target: 0 })).toEqual({ ok: false, reason: 'Pick a player' });
      expect(applyZerou(s, 0, { type: 'play', card: 900, target: 2 })).toEqual({ ok: false, reason: 'Pick a color' });
      expect(applyZerou(s, 0, { type: 'play', card: 900, color: 'b', target: 2 })).toEqual({ ok: true });
      expect(s.hands[0]).toEqual(theirs);
      expect(s.hands[2]!.map(c => c.id)).toEqual([901, 902]);
      expect(s.color).toBe('b');
      expect(s.current).toBe(1);
      expect(s.log.at(-1)).toEqual({ k: 'swap', seat: 0, with: 2 });
    });

    it('a one-card hand received in a swap counts as called', () => {
      const s = game(3);
      rig(s, [card(900, null, 'swap'), card(901, 'g', '1')], card(950, 'r', '2'));
      applyZerou(s, 0, { type: 'play', card: 900, color: 'b', target: 1 });
      expect(s.hands[1]).toHaveLength(1);
      expect(s.called).toEqual([false, true, false]);
      applyZerou(s, 2, { type: 'accuse', target: 1 });
      expect(s.hands[1]).toHaveLength(1);
    });

    it('as the last card it just wins', () => {
      const s = game(3);
      rig(s, [card(900, null, 'swap')], card(950, 'r', '2'));
      expect(applyZerou(s, 0, { type: 'play', card: 900, color: 'b' })).toEqual({ ok: true });
      expect(s.winner).toBe(0);
    });
  });

  describe('pairs', () => {
    it('same number in different colors goes down together; the last one is on top', () => {
      const s = game(3);
      rig(s, [card(900, 'r', '5'), card(901, 'b', '5'), card(902, 'g', '5'), card(903, 'g', '1')], card(950, 'r', '2'));
      // The first one has to be legal on the pile.
      expect(applyZerou(s, 0, { type: 'play', cards: [901, 900] })).toEqual({ ok: false, reason: 'That card does not match' });
      expect(applyZerou(s, 0, { type: 'play', cards: [900, 903] })).toEqual({ ok: false, reason: 'Only cards of the same number go together' });
      expect(applyZerou(s, 0, { type: 'play', cards: [900, 900] }).ok).toBe(false);
      expect(applyZerou(s, 0, { type: 'play', cards: [900, 902, 901] })).toEqual({ ok: true });
      expect(s.hands[0]!.map(c => c.id)).toEqual([903]);
      expect(s.discard.at(-1)!.id).toBe(901);
      expect(s.color).toBe('b');
      expect(s.current).toBe(1);
    });

    it('can empty the hand, and Última! covers a pair that leaves one card', () => {
      const s = game(2);
      rig(s, [card(900, 'r', '5'), card(901, 'b', '5'), card(902, 'b', '7')], card(950, 'r', '2'));
      applyZerou(s, 0, { type: 'play', cards: [900, 901], last: true });
      expect(s.called[0]).toBe(true);
      s.hands[1] = [card(910, 'b', '3'), card(911, 'g', '3')];
      applyZerou(s, 1, { type: 'play', cards: [910, 911] });
      expect(s.winner).toBe(1);
    });

    it('doubled action cards add up: +2s, skips and reverses', () => {
      let s = game(4);
      rig(s, [card(900, 'r', 'draw2'), card(901, 'b', 'draw2'), card(902, 'g', '1')], card(950, 'r', '2'));
      applyZerou(s, 0, { type: 'play', cards: [900, 901] });
      expect(s.hands[1]).toHaveLength(HAND + 4);
      expect(s.current).toBe(2);

      s = game(4);
      rig(s, [card(900, 'r', 'skip'), card(901, 'b', 'skip'), card(902, 'g', '1')], card(950, 'r', '2'));
      applyZerou(s, 0, { type: 'play', cards: [900, 901] });
      expect(s.current).toBe(3);

      s = game(4);
      rig(s, [card(900, 'r', 'rev'), card(901, 'b', 'rev'), card(902, 'g', '1')], card(950, 'r', '2'));
      applyZerou(s, 0, { type: 'play', cards: [900, 901] });
      expect(s.dir).toBe(1);
      expect(s.current).toBe(1);

      s = game(2);
      rig(s, [card(900, 'r', 'skip'), card(901, 'b', 'skip'), card(902, 'g', '1')], card(950, 'r', '2'));
      applyZerou(s, 0, { type: 'play', cards: [900, 901] });
      expect(s.current).toBe(0);
    });

    it('two 9s make one race worth 4; wilds do not pair; after drawing only the drawn card goes', () => {
      let s = game(3);
      rig(s, [card(900, 'r', '9'), card(901, 'b', '9'), card(902, 'g', '1')], card(950, 'r', '2'));
      applyZerou(s, 0, { type: 'play', cards: [900, 901] }, 0);
      applyZerou(s, 0, { type: 'tap' }, 1);
      applyZerou(s, 1, { type: 'tap' }, 2);
      expect(s.hands[2]).toHaveLength(HAND + 2 * RACE_PENALTY);

      s = game(3);
      rig(s, [card(900, null, 'wild'), card(901, null, 'wild'), card(902, 'g', '1')], card(950, 'r', '2'));
      expect(applyZerou(s, 0, { type: 'play', cards: [900, 901], color: 'r' }).ok).toBe(false);

      s = game(3);
      rig(s, [card(900, 'b', '5'), card(902, 'g', '1')], card(950, 'r', '2'));
      s.draw.push(card(960, 'r', '5'));
      applyZerou(s, 0, { type: 'draw' });
      expect(applyZerou(s, 0, { type: 'play', cards: [960, 900] })).toEqual({ ok: false, reason: 'You can only play the card you drew' });
      expect(applyZerou(s, 0, { type: 'play', card: 960 }).ok).toBe(true);
    });
  });

  it("a view never carries another player's hand and stays small", () => {
    const s = game(8);
    // Someone hoarding half the deck after a string of wrong accusations.
    for (let i = 0; i < 25; i++) applyZerou(s, 0, { type: 'accuse', target: 1 });
    for (let i = 0; i < 200; i++) s.log.push({ k: 'play', seat: 7, card: card(100, null, 'wild4'), color: 'b', cut: true });
    const view = zerouView(s, 0);
    expect(view.hand.length).toBeGreaterThan(40);
    expect(JSON.stringify(view).length).toBeLessThan(8000);
    const other = JSON.stringify(zerouView(s, 1));
    const mine = s.hands[0]!.filter(c => c.id !== view.top.id);
    expect(mine.some(c => other.includes(`"id":${c.id},`))).toBe(false);
  });

  it('random games with races, cut-ins, pairs and accusations always finish and keep every card', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let now = 0;
      const inst = new ZerouInstance(createZerou(seats(2 + (seed % 6)), seed), () => now);
      const rng = createRng(seed);
      const s = inst.state;
      for (let i = 0; i < 8000 && !inst.over; i++) {
        now += 100;
        const n = s.players.length;
        if (s.race) {
          if (nextInt(rng, 4) === 0) inst.expire('response', i);
          else applyZerou(s, nextInt(rng, n), { type: 'tap' }, now);
          continue;
        }
        if (nextInt(rng, 25) === 0) {
          const by = nextInt(rng, n);
          applyZerou(s, by, { type: 'accuse', target: (by + 1) % n }, now);
        }
        const cutter = nextInt(rng, n);
        const cut = zerouView(s, cutter, now).cut;
        if (cut.length > 0 && nextInt(rng, 2) === 0) {
          expect(applyZerou(s, cutter, { type: 'play', card: cut[0]! }, now)).toEqual({ ok: true });
          continue;
        }
        const v = zerouView(s, s.current, now);
        if (v.playable.length > 0) {
          const id = v.playable[nextInt(rng, v.playable.length)]!;
          const first = v.hand.find(c => c.id === id)!;
          const mates = v.drawn === null && first.color !== null ? v.hand.filter(c => c.id !== id && c.color !== null && c.value === first.value).map(c => c.id) : [];
          const res = applyZerou(s, s.current, { type: 'play', cards: [id, ...mates], color: 'b', target: (s.current + 1) % n, last: nextInt(rng, 2) === 0 }, now);
          expect(res).toEqual({ ok: true });
        } else inst.expire('turn', i);
      }
      expect(inst.over).toBe(true);
      const ids = [...s.hands.flat(), ...s.draw, ...s.discard].map(c => c.id);
      expect(ids).toHaveLength(DECK_SIZE);
      expect(new Set(ids).size).toBe(DECK_SIZE);
    }
  });
});
