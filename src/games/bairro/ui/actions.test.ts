import { describe, expect, it } from 'vitest';
import { apply } from '../engine';
import { BAIRRO_DICTIONARIES } from '../i18n';
import { game, give, rig } from '../testkit';
import { viewFor } from '../view';
import { actionsFor } from './actions';

const ids = (v: Parameters<typeof actionsFor>[0], awaiting = false) => actionsFor(v, awaiting).map(a => a.id);

describe('actionsFor', () => {
  it('offers the roll on your turn', () => {
    const s = game(2);
    expect(actionsFor(viewFor(s, 0), false)).toEqual([
      { id: 'roll', intent: { type: 'roll' }, enabled: true, label: 'actRoll' },
      { id: 'trade', intent: null, enabled: true, label: 'actTrade' },
    ]);
  });

  it('adds the jail options when jailed, the lawyer only with a card', () => {
    const s = game(2);
    s.players[0]!.jailTurns = 0;
    expect(ids(viewFor(s, 0))).toEqual(['roll', 'payJailFine', 'trade']);
    expect(actionsFor(viewFor(s, 0), false)[1]).toMatchObject({ intent: { type: 'payJailFine' }, enabled: true, amount: 50 });
    s.players[0]!.lawyerCards = 1;
    expect(ids(viewFor(s, 0))).toEqual(['roll', 'payJailFine', 'useLawyer', 'trade']);
  });

  it('disables the jail fine without the cash', () => {
    const s = game(2);
    s.players[0]!.jailTurns = 1;
    s.players[0]!.cash = 49;
    expect(actionsFor(viewFor(s, 0), false).find(a => a.id === 'payJailFine')?.enabled).toBe(false);
  });

  it('offers buy and decline, with the price', () => {
    const s = game(2);
    rig(s, [[1, 2]]); // lands on 3, a ponto at $60
    apply(s, 0, { type: 'roll' });
    expect(viewFor(s, 0).pending).toBe('buy');
    expect(actionsFor(viewFor(s, 0), false)).toEqual([
      { id: 'buy', intent: { type: 'buy' }, enabled: true, label: 'actBuy', amount: 60 },
      { id: 'decline', intent: { type: 'decline' }, enabled: true, label: 'actDecline' },
    ]);
  });

  it('disables buy without the cash', () => {
    const s = game(2);
    rig(s, [[1, 2]]);
    apply(s, 0, { type: 'roll' });
    s.players[0]!.cash = 59;
    expect(actionsFor(viewFor(s, 0), false).map(a => [a.id, a.enabled])).toEqual([['buy', false], ['decline', true]]);
  });

  it('ends the turn in manage, or rolls again after doubles', () => {
    const s = game(2);
    s.phase = { kind: 'manage', rollAgain: false };
    expect(actionsFor(viewFor(s, 0), false)).toEqual([
      { id: 'endTurn', intent: { type: 'endTurn' }, enabled: true, label: 'actEndTurn' },
      { id: 'trade', intent: null, enabled: true, label: 'actTrade' },
    ]);
    s.phase = { kind: 'manage', rollAgain: true };
    expect(actionsFor(viewFor(s, 0), false)).toEqual([
      { id: 'roll', intent: { type: 'roll' }, enabled: true, label: 'actRollAgain' },
      { id: 'trade', intent: null, enabled: true, label: 'actTrade' },
    ]);
  });

  it('pays the oldest debt when the cash covers it', () => {
    const s = game(2);
    s.debts = [{ debtor: 0, creditor: 1, amount: 100 }, { debtor: 0, creditor: null, amount: 900 }];
    s.players[0]!.cash = 100;
    give(s, 0, 39); // liquidation 100 + 200 mortgage < 1000 owed
    expect(viewFor(s, 0).pending).toBe('debt');
    expect(actionsFor(viewFor(s, 0), false)).toEqual([
      { id: 'payDebt', intent: { type: 'payDebt' }, enabled: true, label: 'actPayDebt', amount: 100 },
      { id: 'goBankrupt', intent: { type: 'goBankrupt' }, enabled: true, label: 'actGoBankrupt' },
    ]);
    s.players[0]!.cash = 99;
    expect(actionsFor(viewFor(s, 0), false)[0]!.enabled).toBe(false);
  });

  it('shows Faliu only when liquidating everything cannot cover the debt', () => {
    const s = game(2);
    s.debts = [{ debtor: 0, creditor: null, amount: 300 }];
    s.players[0]!.cash = 100;
    give(s, 0, 39); // mortgage 200: liquidation 300 = owed
    expect(ids(viewFor(s, 0))).toEqual(['payDebt']);
    s.debts[0]!.amount = 301;
    expect(ids(viewFor(s, 0))).toEqual(['payDebt', 'goBankrupt']);
  });

  it('has no main buttons while waiting or answering a trade', () => {
    const s = game(2);
    expect(viewFor(s, 1).pending).toBe('wait');
    expect(actionsFor(viewFor(s, 1), false)).toEqual([]);
    s.offer = { from: 0, to: 1, give: { assets: [], cash: 10, lawyerCards: 0 }, get: { assets: [], cash: 0, lawyerCards: 0 } };
    expect(viewFor(s, 1).pending).toBe('tradeAnswer');
    expect(actionsFor(viewFor(s, 1), false)).toEqual([]);
  });

  it('disables every button while an intent is in flight', () => {
    const s = game(2);
    s.players[0]!.jailTurns = 0;
    s.players[0]!.lawyerCards = 1;
    const buttons = actionsFor(viewFor(s, 0), true);
    expect(buttons).toHaveLength(4);
    expect(buttons.every(a => !a.enabled)).toBe(true);
    s.debts = [{ debtor: 0, creditor: null, amount: 5000 }];
    expect(actionsFor(viewFor(s, 0), true).every(a => !a.enabled)).toBe(true);
  });
});

describe('trade action', () => {
  it('is offered on your turn in roll and manage, but not while buying, in debt, or with an offer open', () => {
    const s = game(2);
    expect(ids(viewFor(s, 0))).toContain('trade');
    s.phase = { kind: 'manage', rollAgain: false };
    expect(ids(viewFor(s, 0))).toContain('trade');
    s.phase = { kind: 'buy', square: 1, rollAgain: false };
    expect(ids(viewFor(s, 0))).not.toContain('trade');
    s.phase = { kind: 'manage', rollAgain: false };
    s.debts = [{ debtor: 0, creditor: null, amount: 5 }];
    expect(ids(viewFor(s, 0))).not.toContain('trade');
    s.debts = [];
    s.offer = { from: 0, to: 1, give: { assets: [], cash: 10, lawyerCards: 0 }, get: { assets: [], cash: 0, lawyerCards: 0 } };
    expect(ids(viewFor(s, 0))).toEqual([]);
  });

  it('is absent with nobody left to trade with, and disabled once the 3 proposals are used', () => {
    const s = game(3);
    s.tradesThisTurn = 3;
    expect(actionsFor(viewFor(s, 0), false).find(a => a.id === 'trade')).toMatchObject({ enabled: false, reason: 'tooManyTrades' });
    expect(actionsFor(viewFor(s, 0), true).find(a => a.id === 'trade')?.reason).toBe('tooManyTrades');
    s.tradesThisTurn = 2;
    expect(actionsFor(viewFor(s, 0), false).find(a => a.id === 'trade')).toEqual({ id: 'trade', intent: null, enabled: true, label: 'actTrade' });
    s.players[1]!.bankrupt = true;
    s.players[2]!.bankrupt = true;
    expect(ids(viewFor(s, 0))).not.toContain('trade');
  });
});

describe('action labels', () => {
  it('are bairro ui strings', () => {
    const s = game(2);
    s.players[0]!.jailTurns = 0;
    s.players[0]!.lawyerCards = 1;
    const labels = actionsFor(viewFor(s, 0), false).map(a => a.label);
    s.phase = { kind: 'buy', square: 1, rollAgain: false };
    labels.push(...actionsFor(viewFor(s, 0), false).map(a => a.label));
    s.phase = { kind: 'manage', rollAgain: true };
    labels.push(...actionsFor(viewFor(s, 0), false).map(a => a.label));
    s.phase = { kind: 'manage', rollAgain: false };
    labels.push(...actionsFor(viewFor(s, 0), false).map(a => a.label));
    s.debts = [{ debtor: 0, creditor: null, amount: 5000 }];
    labels.push(...actionsFor(viewFor(s, 0), false).map(a => a.label));
    expect(new Set(labels).size).toBe(10);
    for (const l of labels) expect(BAIRRO_DICTIONARIES.pt.ui, l).toHaveProperty(l);
  });
});
