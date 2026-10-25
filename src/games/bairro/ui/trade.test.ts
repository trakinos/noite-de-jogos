import { describe, it, expect } from 'vitest';
import { game, give } from '../testkit';
import { viewFor } from '../view';
import { bairroText } from './text';
import { clampCount, isEmptySide, sideLines, tradePartners, tradeOptions, tradesLeft } from './trade';

describe('tradeOptions', () => {
  it('lists each side\'s assets in board order, with cash and lawyer cards', () => {
    const s = game(2);
    give(s, 0, 3);
    give(s, 0, 1);
    give(s, 1, 6);
    s.players[0].lawyerCards = 2;
    s.players[1].cash = 700;
    const o = tradeOptions(viewFor(s, 0), 1);
    expect(o.give.assets.map(a => a.pos)).toEqual([1, 3]);
    expect(o.get.assets.map(a => a.pos)).toEqual([6]);
    expect(o.give).toMatchObject({ cash: 1500, lawyerCards: 2 });
    expect(o.get).toMatchObject({ cash: 700, lawyerCards: 0 });
    expect(o.give.assets.every(a => a.enabled && a.reason === null)).toBe(true);
  });

  it('disables assets in a rua with buildings, whoever owns the building, with the engine\'s reason', () => {
    const s = game(2);
    give(s, 0, 1, { houses: 1 });
    give(s, 1, 3); // same rua, bare, other owner
    give(s, 0, 6);
    const o = tradeOptions(viewFor(s, 0), 1);
    expect(o.give.assets.map(a => [a.pos, a.enabled, a.reason])).toEqual([[1, false, 'ruaHasBuildings'], [6, true, null]]);
    expect(o.get.assets.map(a => [a.pos, a.enabled, a.reason])).toEqual([[3, false, 'ruaHasBuildings']]);
  });

  it('keeps mortgaged assets tradable', () => {
    const s = game(2);
    give(s, 0, 1, { mortgaged: true });
    expect(tradeOptions(viewFor(s, 0), 1).give.assets[0]).toMatchObject({ pos: 1, enabled: true });
  });
});

describe('trade helpers', () => {
  it('partners are the other solvent players', () => {
    const s = game(4);
    s.players[2].bankrupt = true;
    expect(tradePartners(viewFor(s, 0))).toEqual([1, 3]);
    expect(tradePartners(viewFor(s, 1))).toEqual([0, 3]);
  });

  it('counts the proposals left this turn', () => {
    const s = game(2);
    expect(tradesLeft(viewFor(s, 0))).toBe(3);
    s.tradesThisTurn = 2;
    expect(tradesLeft(viewFor(s, 0))).toBe(1);
    s.tradesThisTurn = 3;
    expect(tradesLeft(viewFor(s, 0))).toBe(0);
  });

  it('clamps typed counts to 0..max, whole numbers', () => {
    expect(clampCount(50, 100)).toBe(50);
    expect(clampCount(150, 100)).toBe(100);
    expect(clampCount(-5, 100)).toBe(0);
    expect(clampCount(12.7, 100)).toBe(12);
    expect(clampCount(NaN, 100)).toBe(0);
  });

  it('knows an empty side', () => {
    expect(isEmptySide({ assets: [], cash: 0, lawyerCards: 0 })).toBe(true);
    expect(isEmptySide({ assets: [], cash: 10, lawyerCards: 0 })).toBe(false);
    expect(isEmptySide({ assets: [1], cash: 0, lawyerCards: 0 })).toBe(false);
  });
});

describe('sideLines', () => {
  it('names squares, then cash, then lawyer cards', () => {
    const en = bairroText('en');
    const pt = bairroText('pt');
    expect(sideLines({ assets: [1, 3], cash: 1240, lawyerCards: 2 }, en, 'en')).toEqual([en.square(1), en.square(3), '$1,240', '2 lawyer cards']);
    expect(sideLines({ assets: [], cash: 0, lawyerCards: 1 }, pt, 'pt')).toEqual(['1 carta de advogado']);
    expect(sideLines({ assets: [], cash: 0, lawyerCards: 0 }, en, 'en')).toEqual([]);
  });
});
