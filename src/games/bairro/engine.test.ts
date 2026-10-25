import { describe, it, expect } from 'vitest';
import { BOARD, JAIL_POS, START_MONEY } from './board';
import { apply } from './engine';
import { createBairro } from './setup';
import { game, give, rig } from './testkit';
import type { BairroIntent, BairroState } from './types';
import { BAIRRO_DICTIONARIES } from './i18n';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const SERVICOS = BOARD.flatMap((s, i) => (s.kind === 'servico' ? [i] : []));

/** Rigs one roll for the current player and applies it. */
function roll(s: BairroState, d: [number, number]) {
  rig(s, [d]);
  return apply(s, s.current, { type: 'roll' });
}

describe('setup', () => {
  it('gives 2–6 players $1500 each and starts on roll', () => {
    for (let n = 2; n <= 6; n++) {
      const s = createBairro(seats(n), 7);
      expect(s.players).toHaveLength(n);
      for (const p of s.players) expect(p).toMatchObject({ cash: START_MONEY, pos: 0, jailTurns: null, lawyerCards: 0, bankrupt: false });
      expect(s.phase).toEqual({ kind: 'roll' });
      expect(s.deck).toHaveLength(30);
      expect(s.turnNumber).toBe(0);
      expect(s.riggedDice).toBeUndefined();
    }
  });

  it('shuffles turn order and deck from the seed', () => {
    const order = (seed: number) => createBairro(seats(6), seed).players.map(p => p.id).join();
    const orders = new Set([1, 2, 3, 4, 5].map(order));
    expect(orders.size).toBeGreaterThan(1);
    expect(order(3)).toBe(order(3));
    expect(createBairro(seats(2), 1).deck).not.toEqual(createBairro(seats(2), 2).deck);
  });
});

describe('rolling and moving', () => {
  it('rolling (3,4) from 0 lands on 7', () => {
    const s = game(2);
    expect(roll(s, [3, 4])).toEqual({ ok: true });
    expect(s.players[0].pos).toBe(7);
    expect(s.lastRoll).toEqual([3, 4]);
  });

  it('uses the rng when no dice are rigged', () => {
    const s = game(2);
    expect(apply(s, 0, { type: 'roll' })).toEqual({ ok: true });
    const [a, b] = s.lastRoll!;
    expect(a).toBeGreaterThanOrEqual(1); expect(a).toBeLessThanOrEqual(6);
    expect(b).toBeGreaterThanOrEqual(1); expect(b).toBeLessThanOrEqual(6);
    expect(s.players[0].pos).toBe(a + b);
  });

  it('passing 0 from 38 with (1,2) pays $200', () => {
    const s = game(2);
    s.players[0].pos = 38;
    roll(s, [1, 2]);
    expect(s.players[0].pos).toBe(1);
    expect(s.players[0].cash).toBe(START_MONEY + 200);
    expect(s.log.some(e => e.key === 'passStart' && e.player === 0)).toBe(true);
  });
});

describe('buying', () => {
  it('landing on an unowned 60 ponto offers it, and buying costs $60', () => {
    const s = game(2);
    roll(s, [1, 2]);
    expect(s.phase).toEqual({ kind: 'buy', square: 3, rollAgain: false });
    expect(apply(s, 0, { type: 'buy' })).toEqual({ ok: true });
    expect(s.players[0].cash).toBe(START_MONEY - 60);
    expect(s.owned[3]).toEqual({ owner: 0, houses: 0, mortgaged: false });
    expect(s.phase).toEqual({ kind: 'manage', rollAgain: false });
    expect(s.log.at(-1)).toMatchObject({ player: 0, key: 'bought' });
  });

  it('declining goes to manage and leaves the square unowned', () => {
    const s = game(2);
    roll(s, [1, 2]);
    expect(apply(s, 0, { type: 'decline' })).toEqual({ ok: true });
    expect(s.owned[3]).toBeUndefined();
    expect(s.phase).toEqual({ kind: 'manage', rollAgain: false });
    expect(s.log.at(-1)).toMatchObject({ player: 0, key: 'declined' });
  });

  it('refuses to buy without the cash', () => {
    const s = game(2);
    s.players[0].cash = 59;
    roll(s, [1, 2]);
    expect(apply(s, 0, { type: 'buy' })).toEqual({ ok: false, reason: 'notEnoughCash' });
    expect(s.phase).toEqual({ kind: 'buy', square: 3, rollAgain: false });
  });
});

describe('rent', () => {
  /** Player 0 moves from 38 onto Borracharia (1) with (1,2), collecting $200 on the way. */
  function landOnBorracharia(setupOwner: (s: BairroState) => void) {
    const s = game(2);
    setupOwner(s);
    s.players[0].pos = 38;
    roll(s, [1, 2]);
    return { s, paid: START_MONEY + 200 - s.players[0].cash, got: s.players[1].cash - START_MONEY };
  }

  it('is rent[0] on a lone ponto', () => {
    const { s, paid, got } = landOnBorracharia(s => give(s, 1, 1));
    expect([paid, got]).toEqual([2, 2]);
    expect(s.phase).toEqual({ kind: 'manage', rollAgain: false });
    expect(s.log.at(-1)).toMatchObject({ player: 0, key: 'paidRent', params: { to: 1, pos: 1, amount: 2 } });
  });

  it('doubles when the owner holds the whole rua with no buildings', () => {
    expect(landOnBorracharia(s => { give(s, 1, 1); give(s, 1, 3); }).paid).toBe(4);
  });

  it('uses rent[n] once the rua has buildings', () => {
    expect(landOnBorracharia(s => { give(s, 1, 1); give(s, 1, 3, { houses: 1 }); }).paid).toBe(2);
    expect(landOnBorracharia(s => { give(s, 1, 1, { houses: 2 }); give(s, 1, 3); }).paid).toBe(30);
  });

  it('is 0 while mortgaged or when the owner is the player', () => {
    expect(landOnBorracharia(s => give(s, 1, 1, { mortgaged: true })).paid).toBe(0);
    expect(landOnBorracharia(s => give(s, 0, 1)).paid).toBe(0);
  });

  it('is 0 when the owner is bankrupt', () => {
    expect(landOnBorracharia(s => { give(s, 1, 1); s.players[1].bankrupt = true; }).paid).toBe(0);
  });

  it('a servico charges dice × multiplier, doubled when the owner holds all 6', () => {
    const s = game(2);
    give(s, 1, 15);
    s.players[0].pos = 8;
    roll(s, [3, 4]);
    expect(s.players[0].cash).toBe(START_MONEY - 56);

    const t = game(2);
    for (const pos of SERVICOS) give(t, 1, pos);
    t.players[0].pos = 8;
    roll(t, [3, 4]);
    expect(t.players[0].cash).toBe(START_MONEY - 112);
    expect(t.players[1].cash).toBe(START_MONEY + 112);
  });

  it('records a debt instead of paying when the player is short', () => {
    const s = game(2);
    give(s, 1, 3, { houses: 1 });
    s.players[0].cash = 10;
    roll(s, [1, 2]);
    expect(s.debts).toEqual([{ debtor: 0, creditor: 1, amount: 20 }]);
    expect(s.players[0].cash).toBe(10);
    expect(s.players[1].cash).toBe(START_MONEY);
  });
});

describe('special squares', () => {
  it('IPTU takes 200', () => {
    const s = game(2);
    roll(s, [1, 3]);
    expect(s.players[0].cash).toBe(START_MONEY - 200);
  });

  it('IPTU becomes a debt to the bank when the player is short', () => {
    const s = game(2);
    s.players[0].cash = 100;
    roll(s, [1, 3]);
    expect(s.debts).toEqual([{ debtor: 0, creditor: null, amount: 200 }]);
    expect(s.players[0].cash).toBe(100);
  });

  it('Bolão adds 200', () => {
    const s = game(2);
    s.players[0].pos = 35;
    roll(s, [1, 2]);
    expect(s.players[0].pos).toBe(38);
    expect(s.players[0].cash).toBe(START_MONEY + 200);
  });

  it('landing on 30 sends to jail with no $200', () => {
    const s = game(2);
    s.players[0].pos = 27;
    roll(s, [1, 2]);
    expect(s.players[0]).toMatchObject({ pos: JAIL_POS, jailTurns: 0, cash: START_MONEY });
    expect(s.phase).toEqual({ kind: 'manage', rollAgain: false });
  });

});

describe('luck', () => {
  /** Player 0 rolls [1,2] from pos 4 onto the luck square at 7, with `top` on top of the deck. */
  function draw(top: string[]) {
    const s = game(2);
    s.players[0].pos = 4;
    s.deck = [...top, ...s.deck.filter(c => !top.includes(c))];
    roll(s, [1, 2]);
    return s;
  }

  it('money card pays from the bank, logs the card and goes to the bottom', () => {
    const s = draw(['c07']);
    expect(s.players[0].cash).toBe(START_MONEY + 200);
    expect(s.log.at(-1)).toEqual({ player: 0, key: 'luck', params: { card: 'c07' } });
    expect(s.deck.at(-1)).toBe('c07');
    expect(s.deck).toHaveLength(30);
    expect(s.phase).toEqual({ kind: 'manage', rollAgain: false });
  });

  it('negative money card pays the bank, or becomes a debt', () => {
    expect(draw(['c15']).players[0].cash).toBe(START_MONEY - 200);
    const s = game(2);
    s.players[0].pos = 4; s.players[0].cash = 50;
    s.deck = ['c15', ...s.deck.filter(c => c !== 'c15')];
    roll(s, [1, 2]);
    expect(s.debts).toEqual([{ debtor: 0, creditor: null, amount: 200 }]);
  });

  it('eachPlayer + collects from every solvent player, skipping bankrupt ones', () => {
    const s = game(4);
    s.players[0].pos = 4; s.players[2].bankrupt = true;
    s.deck = ['c23', ...s.deck.filter(c => c !== 'c23')];
    roll(s, [1, 2]);
    expect(s.players.map(p => p.cash)).toEqual([START_MONEY + 100, START_MONEY - 50, START_MONEY, START_MONEY - 50]);
  });

  it('eachPlayer + leaves a debt for a payer who is short', () => {
    const s = game(3);
    s.players[0].pos = 4; s.players[1].cash = 10;
    s.deck = ['c23', ...s.deck.filter(c => c !== 'c23')];
    roll(s, [1, 2]);
    expect(s.debts).toEqual([{ debtor: 1, creditor: 0, amount: 50 }]);
    expect(s.players[0].cash).toBe(START_MONEY + 50);
    expect(s.players[1].cash).toBe(10);
  });

  it('eachPlayer − pays every solvent player, skipping bankrupt ones', () => {
    const s = game(4);
    s.players[0].pos = 4; s.players[3].bankrupt = true;
    s.deck = ['c25', ...s.deck.filter(c => c !== 'c25')];
    roll(s, [1, 2]);
    expect(s.players.map(p => p.cash)).toEqual([START_MONEY - 100, START_MONEY + 50, START_MONEY + 50, START_MONEY]);
  });

  it('eachPlayer − records debts when the drawer is short', () => {
    const s = game(3);
    s.players[0].pos = 4; s.players[0].cash = 60;
    s.deck = ['c25', ...s.deck.filter(c => c !== 'c25')];
    roll(s, [1, 2]);
    expect(s.players[0].cash).toBe(10);
    expect(s.players[1].cash).toBe(START_MONEY + 50);
    expect(s.debts).toEqual([{ debtor: 0, creditor: 2, amount: 50 }]);
  });

  it('advanceToStart moves to 0 and collects $200, keeping the roll-again of doubles', () => {
    const s = game(2);
    s.players[0].pos = 5;
    s.deck = ['c05', ...s.deck.filter(c => c !== 'c05')];
    roll(s, [1, 1]);
    expect(s.players[0]).toMatchObject({ pos: 0, cash: START_MONEY + 200 });
    expect(s.phase).toEqual({ kind: 'manage', rollAgain: true });
  });

  it('goToJail jails with no extra roll even after doubles', () => {
    const s = game(2);
    s.players[0].pos = 5;
    s.deck = ['c03', ...s.deck.filter(c => c !== 'c03')];
    roll(s, [1, 1]);
    expect(s.players[0]).toMatchObject({ pos: JAIL_POS, jailTurns: 0, cash: START_MONEY });
    expect(s.phase).toEqual({ kind: 'manage', rollAgain: false });
    expect(s.deck.at(-1)).toBe('c03');
  });

  it('a lawyer card is kept and leaves the deck', () => {
    const s = draw(['c01']);
    expect(s.players[0].lawyerCards).toBe(1);
    expect(s.deck).toHaveLength(29);
    expect(s.deck).not.toContain('c01');
    expect(s.phase).toEqual({ kind: 'manage', rollAgain: false });
  });

  it('an empty deck does nothing', () => {
    const s = game(2);
    s.players[0].pos = 4; s.deck = [];
    roll(s, [1, 2]);
    expect(s.log.some(e => e.key === 'luck')).toBe(false);
    expect(s.phase).toEqual({ kind: 'manage', rollAgain: false });
  });
});

describe('doubles and turns', () => {
  it('doubles allow another roll and refuse endTurn', () => {
    const s = game(2);
    roll(s, [1, 1]);
    expect(s.phase).toEqual({ kind: 'manage', rollAgain: true });
    expect(s.doublesInRow).toBe(1);
    expect(apply(s, 0, { type: 'endTurn' })).toEqual({ ok: false, reason: 'notNow' });
    expect(roll(s, [1, 2])).toEqual({ ok: true });
    expect(s.players[0].pos).toBe(5);
  });

  it('a third double goes to jail instead of moving', () => {
    const s = game(2);
    roll(s, [1, 1]);
    roll(s, [2, 2]);
    apply(s, 0, { type: 'decline' });
    expect(s.phase).toEqual({ kind: 'manage', rollAgain: true });
    roll(s, [3, 3]);
    expect(s.players[0]).toMatchObject({ pos: JAIL_POS, jailTurns: 0 });
    expect(s.phase).toEqual({ kind: 'manage', rollAgain: false });
  });

  it('endTurn passes to the next player, skipping bankrupt ones', () => {
    const s = game(3);
    s.players[1].bankrupt = true;
    roll(s, [1, 2]);
    apply(s, 0, { type: 'decline' });
    expect(apply(s, 0, { type: 'endTurn' })).toEqual({ ok: true });
    expect(s.current).toBe(2);
    expect(s.phase).toEqual({ kind: 'roll' });
    expect(s.doublesInRow).toBe(0);
    expect(s.turnNumber).toBe(1);
    roll(s, [1, 2]);
    apply(s, 2, { type: 'decline' });
    apply(s, 2, { type: 'endTurn' });
    expect(s.current).toBe(0);
    expect(s.turnNumber).toBe(2);
  });

  it('endTurn is refused while a debt is open', () => {
    const s = game(2);
    s.players[0].cash = 100;
    roll(s, [1, 3]);
    expect(apply(s, 0, { type: 'endTurn' })).toEqual({ ok: false, reason: 'debtOpen' });
  });
});

describe('guards', () => {
  it('acting off-turn is refused', () => {
    const s = game(2);
    expect(apply(s, 1, { type: 'roll' })).toEqual({ ok: false, reason: 'notYourTurn' });
  });

  it('intents in the wrong phase are refused', () => {
    const s = game(2);
    expect(apply(s, 0, { type: 'buy' })).toEqual({ ok: false, reason: 'notNow' });
    expect(apply(s, 0, { type: 'endTurn' })).toEqual({ ok: false, reason: 'notNow' });
    roll(s, [1, 2]);
    expect(apply(s, 0, { type: 'roll' })).toEqual({ ok: false, reason: 'notNow' });
  });

  it('later-task intents are refused for now', () => {
    const s = game(2);
    expect(apply(s, 0, { type: 'mortgage', pos: 1 })).toEqual({ ok: false, reason: 'notNow' });
  });

  it('never throws on malformed input', () => {
    const s = game(2);
    const junk: unknown[] = [null, undefined, 3, 'roll', {}, { type: 'fly' }, { type: 7 }, []];
    for (const j of junk) expect(apply(s, 0, j as BairroIntent)).toEqual({ ok: false, reason: 'badIntent' });
    expect(apply(s, 9, { type: 'roll' })).toEqual({ ok: false, reason: 'notYourTurn' });
    expect(apply(s, NaN, { type: 'roll' })).toEqual({ ok: false, reason: 'notYourTurn' });
  });

  it('refuses everything once there is a winner', () => {
    const s = game(2);
    s.winner = 1;
    expect(apply(s, 0, { type: 'roll' })).toEqual({ ok: false, reason: 'gameOver' });
  });

  it('every reason and log key used has text in both dictionaries', () => {
    const s = game(3);
    for (let i = 0; i < 40; i++) {
      apply(s, s.current, { type: 'roll' });
      apply(s, s.current, { type: i % 2 ? 'buy' : 'decline' });
      if (s.debts.length) s.debts = [];
      apply(s, s.current, { type: 'endTurn' });
    }
    for (const lang of ['pt', 'en'] as const) {
      const d = BAIRRO_DICTIONARIES[lang];
      for (const e of s.log) expect(d.log[e.key], `${lang} log ${e.key}`).toBeTruthy();
      for (const r of ['notYourTurn', 'notNow', 'notEnoughCash', 'badIntent', 'debtOpen', 'gameOver']) {
        expect(d.reasons[r], `${lang} reason ${r}`).toBeTruthy();
      }
    }
  });
});

describe('jail', () => {
  const jailed = (s: BairroState, p = 0) => { s.players[p].pos = JAIL_POS; s.players[p].jailTurns = 0; };

  it('paying the $50 fine releases and then rolls normally', () => {
    const s = game(2);
    jailed(s);
    expect(apply(s, 0, { type: 'payJailFine' })).toEqual({ ok: true });
    expect(s.players[0]).toMatchObject({ jailTurns: null, cash: START_MONEY - 50 });
    expect(s.phase).toEqual({ kind: 'roll' });
    roll(s, [1, 1]);
    expect(s.players[0].pos).toBe(12);
    expect(s.phase).toEqual({ kind: 'buy', square: 12, rollAgain: true });
  });

  it('the fine needs $50 and a jailed player in the roll phase', () => {
    const s = game(2);
    expect(apply(s, 0, { type: 'payJailFine' })).toEqual({ ok: false, reason: 'notNow' });
    jailed(s);
    s.players[0].cash = 49;
    expect(apply(s, 0, { type: 'payJailFine' })).toEqual({ ok: false, reason: 'notEnoughCash' });
    expect(s.players[0].jailTurns).toBe(0);
  });

  it('a lawyer card releases and goes to the bottom of the deck', () => {
    const s = game(2);
    jailed(s);
    expect(apply(s, 0, { type: 'useLawyer' })).toEqual({ ok: false, reason: 'notNow' });
    s.players[0].lawyerCards = 1;
    s.deck = s.deck.filter(c => c !== 'c01');
    const len = s.deck.length;
    expect(apply(s, 0, { type: 'useLawyer' })).toEqual({ ok: true });
    expect(s.players[0]).toMatchObject({ jailTurns: null, lawyerCards: 0, cash: START_MONEY });
    expect(s.deck).toHaveLength(len + 1);
    expect(s.deck.at(-1)).toBe('c01');
    expect(s.phase).toEqual({ kind: 'roll' });
  });

  it('a second lawyer card returns c02 when c01 is already in the deck', () => {
    const s = game(2);
    jailed(s);
    s.players[0].lawyerCards = 1;
    s.deck = s.deck.filter(c => c !== 'c02');
    apply(s, 0, { type: 'useLawyer' });
    expect(s.deck.at(-1)).toBe('c02');
  });

  it('doubles release the player, who moves but does not roll again', () => {
    const s = game(2);
    jailed(s);
    roll(s, [2, 2]);
    expect(s.players[0]).toMatchObject({ jailTurns: null, pos: 14 });
    expect(s.doublesInRow).toBe(0);
    expect(s.phase).toEqual({ kind: 'buy', square: 14, rollAgain: false });
    apply(s, 0, { type: 'decline' });
    expect(s.phase).toEqual({ kind: 'manage', rollAgain: false });
    expect(apply(s, 0, { type: 'roll' })).toEqual({ ok: false, reason: 'notNow' });
  });

  it('a failed roll stays in jail and ends the roll phase', () => {
    const s = game(2);
    jailed(s);
    roll(s, [1, 2]);
    expect(s.players[0]).toMatchObject({ jailTurns: 1, pos: JAIL_POS });
    expect(s.phase).toEqual({ kind: 'manage', rollAgain: false });
    expect(apply(s, 0, { type: 'endTurn' })).toEqual({ ok: true });
  });

  it('the third failed roll pays the fine and moves by that roll', () => {
    const s = game(2);
    jailed(s);
    s.players[0].jailTurns = 2;
    roll(s, [1, 2]);
    expect(s.players[0]).toMatchObject({ jailTurns: null, pos: 13, cash: START_MONEY - 50 });
    expect(s.phase).toEqual({ kind: 'buy', square: 13, rollAgain: false });
  });

  it('the forced fine becomes a debt when cash is short', () => {
    const s = game(2);
    jailed(s);
    s.players[0].jailTurns = 2;
    s.players[0].cash = 10;
    roll(s, [1, 2]);
    expect(s.debts).toEqual([{ debtor: 0, creditor: null, amount: 50 }]);
    expect(s.players[0]).toMatchObject({ jailTurns: null, pos: 13, cash: 10 });
  });

  it('an owner in jail still collects rent', () => {
    const s = game(2);
    jailed(s, 1);
    give(s, 1, 1);
    s.players[0].pos = 38;
    roll(s, [1, 2]);
    expect(s.players[1].cash).toBe(START_MONEY + 2);
  });

  it('jail log keys and reasons have text in both dictionaries', () => {
    const s = game(2);
    jailed(s);
    s.players[0].lawyerCards = 1;
    apply(s, 0, { type: 'useLawyer' });
    jailed(s);
    apply(s, 0, { type: 'payJailFine' });
    jailed(s);
    roll(s, [1, 2]);
    s.players[0].jailTurns = 2;
    s.phase = { kind: 'roll' };
    roll(s, [1, 2]);
    s.players[0].jailTurns = 1;
    s.phase = { kind: 'roll' };
    roll(s, [3, 3]);
    for (const lang of ['pt', 'en'] as const) {
      const d = BAIRRO_DICTIONARIES[lang];
      for (const e of s.log) expect(d.log[e.key], `${lang} log ${e.key}`).toBeTruthy();
    }
    const keys = s.log.map(e => e.key);
    for (const k of ['usedLawyer', 'paidJailFine', 'jailRollFailed', 'jailFineForced', 'leftJailDoubles']) expect(keys, k).toContain(k);
  });
});
