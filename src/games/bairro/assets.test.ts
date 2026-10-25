import { describe, it, expect } from 'vitest';
import { BOARD } from './board';
import { apply } from './engine';
import { canBuild, canMortgage, canSell, liquidationValue, ownsWholeRua } from './assets';
import { game, give } from './testkit';
import { BAIRRO_DICTIONARIES } from './i18n';

const pos = (id: string) => BOARD.findIndex(x => x.id === id);
const B = pos('borracharia'), L = pos('lava-jato'); // r1, houseCost 50, price 60
const KOMBI = pos('kombi');

/** p0 owns all of r1 and is to move in `manage`. */
function r1() {
  const s = game(2);
  give(s, 0, B); give(s, 0, L);
  s.phase = { kind: 'manage', rollAgain: false };
  return s;
}

describe('building', () => {
  it('needs the whole rua', () => {
    const s = game(2);
    give(s, 0, B);
    expect(ownsWholeRua(s, 0, 'r1')).toBe(false);
    expect(apply(s, 0, { type: 'build', pos: B })).toEqual({ ok: false, reason: 'needWholeRua' });
    give(s, 1, L);
    expect(canBuild(s, 0, B)).toBe('needWholeRua');
  });

  it('builds evenly: the target must be at the rua minimum', () => {
    const s = r1();
    expect(apply(s, 0, { type: 'build', pos: B })).toEqual({ ok: true });
    expect(apply(s, 0, { type: 'build', pos: B })).toEqual({ ok: false, reason: 'unevenBuild' });
    expect(apply(s, 0, { type: 'build', pos: L })).toEqual({ ok: true });
    expect(s.owned[B].houses).toBe(1);
    expect(s.owned[L].houses).toBe(1);
    expect(s.players[0].cash).toBe(1500 - 100);
  });

  it('is refused while any ponto of the rua is mortgaged', () => {
    const s = r1();
    s.owned[L].mortgaged = true;
    expect(apply(s, 0, { type: 'build', pos: B })).toEqual({ ok: false, reason: 'ruaMortgaged' });
  });

  it('is refused without cash', () => {
    const s = r1();
    s.players[0].cash = 49;
    expect(apply(s, 0, { type: 'build', pos: B })).toEqual({ ok: false, reason: 'notEnoughCash' });
    expect(s.owned[B].houses).toBe(0);
  });

  it('four puxadinhos then a prédio, and no more', () => {
    const s = r1();
    for (let i = 0; i < 4; i++) {
      expect(apply(s, 0, { type: 'build', pos: B }).ok).toBe(true);
      expect(apply(s, 0, { type: 'build', pos: L }).ok).toBe(true);
    }
    expect(s.owned[B].houses).toBe(4);
    expect(apply(s, 0, { type: 'build', pos: B })).toEqual({ ok: true });
    expect(s.owned[B].houses).toBe(5);
    expect(s.log.at(-1)?.key).toBe('builtPredio');
    expect(apply(s, 0, { type: 'build', pos: B })).toEqual({ ok: false, reason: 'alreadyPredio' });
  });

  it('refuses malformed positions and non-pontos without throwing', () => {
    const s = r1();
    for (const p of [-1, 40, 1.5, NaN, undefined, '1', null, 0, KOMBI]) {
      const r = apply(s, 0, { type: 'build', pos: p as number });
      expect(r.ok).toBe(false);
    }
    expect(apply(s, 0, { type: 'build', pos: pos('quitanda') })).toEqual({ ok: false, reason: 'notOwner' });
  });

  it('is refused off turn, in buy phase, with an offer open, or with a debt', () => {
    const s = r1();
    expect(apply(s, 1, { type: 'build', pos: B })).toEqual({ ok: false, reason: 'notYourTurn' });
    s.phase = { kind: 'buy', square: 5, rollAgain: false };
    expect(canBuild(s, 0, B)).toBe('notNow');
    s.phase = { kind: 'roll' };
    expect(canBuild(s, 0, B)).toBeNull();
    s.offer = { from: 0, to: 1, give: { assets: [], cash: 0, lawyerCards: 0 }, get: { assets: [], cash: 0, lawyerCards: 0 } };
    expect(canBuild(s, 0, B)).toBe('notNow');
    s.offer = null;
    s.debts.push({ debtor: 0, creditor: null, amount: 10 });
    expect(canBuild(s, 0, B)).toBe('debtOpen');
  });
});

describe('selling', () => {
  it('sells evenly at half price, and a prédio becomes 4', () => {
    const s = r1();
    s.owned[B].houses = 5; s.owned[L].houses = 4;
    expect(apply(s, 0, { type: 'sellBuilding', pos: L })).toEqual({ ok: false, reason: 'unevenSell' });
    expect(apply(s, 0, { type: 'sellBuilding', pos: B })).toEqual({ ok: true });
    expect(s.owned[B].houses).toBe(4);
    expect(s.players[0].cash).toBe(1500 + 25);
    expect(apply(s, 0, { type: 'sellBuilding', pos: L })).toEqual({ ok: true });
    expect(s.owned[L].houses).toBe(3);
    expect(apply(s, 0, { type: 'sellBuilding', pos: L })).toEqual({ ok: false, reason: 'unevenSell' });
  });

  it('refuses when there is nothing to sell', () => {
    const s = r1();
    expect(canSell(s, 0, B)).toBe('noBuildings');
  });
});

describe('mortgages', () => {
  it('refuses while the rua has buildings, even on the other ponto', () => {
    const s = r1();
    s.owned[L].houses = 1;
    expect(apply(s, 0, { type: 'mortgage', pos: B })).toEqual({ ok: false, reason: 'ruaHasBuildings' });
    expect(canMortgage(s, 0, L)).toBe('ruaHasBuildings');
  });

  it('pays the mortgage value and refuses a second time', () => {
    const s = r1();
    expect(apply(s, 0, { type: 'mortgage', pos: B })).toEqual({ ok: true });
    expect(s.owned[B].mortgaged).toBe(true);
    expect(s.players[0].cash).toBe(1530);
    expect(apply(s, 0, { type: 'mortgage', pos: B })).toEqual({ ok: false, reason: 'alreadyMortgaged' });
  });

  it('mortgages a servico', () => {
    const s = game(2);
    give(s, 0, KOMBI);
    expect(apply(s, 0, { type: 'mortgage', pos: KOMBI })).toEqual({ ok: true });
    expect(s.players[0].cash).toBe(1600);
  });

  it('unmortgaging the 60 ponto costs 36, needs cash, and needs a mortgage', () => {
    const s = r1();
    expect(apply(s, 0, { type: 'unmortgage', pos: B })).toEqual({ ok: false, reason: 'notMortgaged' });
    s.owned[B].mortgaged = true;
    s.players[0].cash = 35;
    expect(apply(s, 0, { type: 'unmortgage', pos: B })).toEqual({ ok: false, reason: 'notEnoughCash' });
    s.players[0].cash = 100;
    expect(apply(s, 0, { type: 'unmortgage', pos: B })).toEqual({ ok: true });
    expect(s.players[0].cash).toBe(64);
    expect(s.owned[B].mortgaged).toBe(false);
  });
});

describe('liquidationValue', () => {
  it('counts cash, half the building cost and unmortgaged mortgage values', () => {
    const s = game(2);
    s.players[0].cash = 100;
    give(s, 0, B, { houses: 5 });          // 5*50/2 = 125, mortgage 30
    give(s, 0, L, { mortgaged: true });    // nothing
    give(s, 0, KOMBI);                     // 100
    give(s, 1, pos('quitanda'), { houses: 3 }); // not ours
    expect(liquidationValue(s, 0)).toBe(100 + 125 + 30 + 100);
  });
});

describe('reason dictionaries', () => {
  it('has text for every reason key the asset rules return', () => {
    const keys = ['notAPonto', 'notOwner', 'needWholeRua', 'ruaMortgaged', 'alreadyPredio', 'unevenBuild', 'noBuildings',
      'unevenSell', 'alreadyMortgaged', 'notMortgaged', 'ruaHasBuildings', 'notEnoughCash', 'debtOpen', 'notNow', 'notYourTurn'];
    for (const lang of ['pt', 'en'] as const) for (const k of keys) expect(BAIRRO_DICTIONARIES[lang].reasons[k], `${lang}.${k}`).toBeTruthy();
    for (const lang of ['pt', 'en'] as const)
      for (const k of ['builtPuxadinho', 'builtPredio', 'soldBuilding', 'mortgaged', 'unmortgaged']) expect(BAIRRO_DICTIONARIES[lang].log[k]).toBeTruthy();
  });
});
