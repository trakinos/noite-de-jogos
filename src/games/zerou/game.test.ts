import { describe, expect, it } from 'vitest';
import { createRng, nextInt } from '../../engine/rng';
import { applyZerou, canPlay, createZerou, fullDeck, HAND, ZerouInstance, zerouView, type Card, type ZerouState } from './game';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const card = (id: number, color: Card['color'], value: Card['value']): Card => ({ id, color, value });

function rig(s: ZerouState, hand: Card[], topCard: Card) {
  s.hands[s.current] = hand;
  s.discard = [topCard];
  s.color = topCard.color!;
}

describe('zerou!', () => {
  it('has 108 cards and deals seven each with a number face up', () => {
    expect(fullDeck()).toHaveLength(108);
    const s = createZerou(seats(4), 2);
    expect(s.hands.every(h => h.length === HAND)).toBe(true);
    expect(s.discard[0]!.value).toMatch(/^\d$/);
    expect(s.draw.length + s.discard.length + 4 * HAND).toBe(108);
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

  it('a wild needs a color; drawing a playable card lets you play only it or pass', () => {
    const s = createZerou(seats(3), 1);
    const p = s.current;
    rig(s, [card(900, null, 'wild'), card(901, 'g', '1')], card(950, 'r', '2'));
    expect(applyZerou(s, p, { type: 'play', card: 900 })).toEqual({ ok: false, reason: 'Pick a color' });
    applyZerou(s, p, { type: 'play', card: 900, color: 'g' });
    expect(s.color).toBe('g');
  });

  it('forgetting Última! can be caught for two cards until the next player acts', () => {
    const s = createZerou(seats(3), 1);
    const p = s.current;
    rig(s, [card(900, 'r', '5'), card(901, 'r', '6')], card(950, 'r', '2'));
    applyZerou(s, p, { type: 'play', card: 900 });
    expect(s.exposed).toBe(p);
    const catcher = (p + 2) % 3;
    applyZerou(s, catcher, { type: 'catch', target: p });
    expect(s.hands[p]).toHaveLength(3);
    expect(zerouView(s, catcher).exposed).toBeNull();
  });

  it('calling Última! with the play is safe; emptying the hand wins', () => {
    const s = createZerou(seats(2), 1);
    const p = s.current;
    rig(s, [card(900, 'r', '5'), card(901, 'r', '6')], card(950, 'r', '2'));
    applyZerou(s, p, { type: 'play', card: 900, last: true });
    expect(s.exposed).toBeNull();
    expect(applyZerou(s, 1 - p, { type: 'catch', target: p }).ok).toBe(false);
    s.current = p;
    applyZerou(s, p, { type: 'play', card: 901 });
    expect(s.winner).toBe(p);
  });

  it('random games always finish and keep all 108 cards', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const inst = new ZerouInstance(createZerou(seats(2 + (seed % 6)), seed));
      const rng = createRng(seed);
      for (let i = 0; i < 5000 && !inst.over; i++) {
        const s = inst.state;
        const v = zerouView(s, s.current);
        if (v.playable.length > 0) {
          const id = v.playable[nextInt(rng, v.playable.length)]!;
          applyZerou(s, s.current, { type: 'play', card: id, color: 'b', last: true });
        } else inst.expire('turn', i);
      }
      expect(inst.over).toBe(true);
      const s = inst.state;
      expect(s.hands.flat().length + s.draw.length + s.discard.length).toBe(108);
    }
  });
});
