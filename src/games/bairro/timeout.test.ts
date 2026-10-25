import { describe, it, expect } from 'vitest';
import { apply } from './engine';
import { game, give, rig } from './testkit';
import { expire } from './timeout';
import type { BairroState } from './types';

const keys = (s: BairroState) => s.log.map(e => e.key);

describe('turn timeout', () => {
  it('declines the buy and ends the turn', () => {
    const s = game(2);
    rig(s, [[1, 2]]);
    apply(s, 0, { type: 'roll' });
    expire(s, 'turn');
    expect(s.owned[3]).toBeUndefined();
    expect(keys(s)).toEqual(['rolled', 'declined']);
    expect(s.current).toBe(1);
    expect(s.turnNumber).toBe(1);
  });

  it('rolls when the player has not rolled, then ends the turn', () => {
    const s = game(2);
    rig(s, [[1, 2]]);
    expire(s, 'turn');
    expect(keys(s)).toEqual(['rolled', 'declined']);
    expect(s.current).toBe(1);
  });

  it('rolls again after doubles before ending the turn', () => {
    const s = game(2);
    rig(s, [[3, 3], [1, 2]]);
    expire(s, 'turn');
    expect(keys(s)).toEqual(['rolled', 'declined', 'rolled', 'declined']);
    expect(s.players[0].pos).toBe(9);
    expect(s.current).toBe(1);
  });

  it('in the Xilindró it rolls instead of paying the fine or using a lawyer card', () => {
    const s = game(2);
    s.players[0].pos = 10;
    s.players[0].jailTurns = 0;
    s.players[0].lawyerCards = 1;
    s.deck.splice(s.deck.indexOf('c01'), 1);
    rig(s, [[1, 2]]);
    expire(s, 'turn');
    expect(keys(s)).toEqual(['rolled', 'jailRollFailed']);
    expect(s.players[0]).toMatchObject({ jailTurns: 1, lawyerCards: 1, cash: 1500 });
    expect(s.current).toBe(1);
  });

  it('pays the player\'s own debt by liquidating, then ends the turn', () => {
    const s = game(2);
    give(s, 0, 1, { houses: 1 });
    give(s, 0, 3, { houses: 1 });
    s.players[0].cash = 0;
    s.phase = { kind: 'manage', rollAgain: false };
    s.debts.push({ debtor: 0, creditor: null, amount: 100 });
    expire(s, 'turn');
    // Two buildings sold (25 each), then both pontos mortgaged (30 each): 110, 100 paid.
    expect(s.owned[1]).toMatchObject({ houses: 0, mortgaged: true });
    expect(s.owned[3]).toMatchObject({ houses: 0, mortgaged: true });
    expect(s.players[0]).toMatchObject({ cash: 10, bankrupt: false });
    expect(s.debts).toEqual([]);
    expect(keys(s).at(-1)).toBe('paidDebtBank');
    expect(s.current).toBe(1);
  });

  it('goes bankrupt when liquidating everything cannot cover the debt', () => {
    const s = game(3);
    give(s, 0, 5);
    s.players[0].cash = 10;
    s.phase = { kind: 'manage', rollAgain: false };
    s.debts.push({ debtor: 0, creditor: 2, amount: 500 });
    expire(s, 'turn');
    expect(s.players[0].bankrupt).toBe(true);
    expect(s.owned[5].owner).toBe(2);
    expect(s.current).toBe(1);
  });

  it('never buys, builds, unmortgages or proposes, even with plenty of cash', () => {
    const s = game(2);
    give(s, 0, 1);
    give(s, 0, 3);
    give(s, 0, 5, { mortgaged: true });
    s.players[0].cash = 10_000;
    rig(s, [[3, 3], [1, 1], [1, 2]]);
    expire(s, 'turn');
    expect(Object.keys(s.owned).map(Number).sort((a, b) => a - b)).toEqual([1, 3, 5]);
    expect([s.owned[1].houses, s.owned[3].houses, s.owned[5].mortgaged]).toEqual([0, 0, true]);
    expect(s.offer).toBeNull();
    for (const k of ['bought', 'builtPuxadinho', 'builtPredio', 'unmortgaged', 'tradeProposed']) expect(keys(s)).not.toContain(k);
    expect(s.current).toBe(1);
  });

  it('cancels the player\'s own open offer first', () => {
    const s = game(2);
    s.phase = { kind: 'manage', rollAgain: false };
    apply(s, 0, { type: 'proposeTrade', offer: { to: 1, give: { assets: [], cash: 5, lawyerCards: 0 }, get: { assets: [], cash: 0, lawyerCards: 0 } } });
    expire(s, 'turn');
    expect(s.offer).toBeNull();
    expect(keys(s)).toEqual(['tradeProposed', 'tradeCancelled']);
    expect(s.current).toBe(1);
  });

  it('does nothing once the game is over', () => {
    const s = game(2);
    s.winner = 1;
    expire(s, 'turn');
    expire(s, 'response');
    expect(s.log).toEqual([]);
  });
});

describe('response timeout', () => {
  it('declines the open offer for the recipient and leaves the turn running', () => {
    const s = game(3);
    apply(s, 0, { type: 'proposeTrade', offer: { to: 2, give: { assets: [], cash: 5, lawyerCards: 0 }, get: { assets: [], cash: 0, lawyerCards: 0 } } });
    expire(s, 'response');
    expect(s.offer).toBeNull();
    expect(s.log.at(-1)).toMatchObject({ player: 2, key: 'tradeDeclined' });
    expect(s.current).toBe(0);
    expect(s.phase).toEqual({ kind: 'roll' });
  });

  it('settles every off-turn debtor: pays when liquidation covers it, else bankrupt', () => {
    const s = game(3);
    s.phase = { kind: 'manage', rollAgain: false };
    give(s, 1, 5);
    s.players[1].cash = 0;
    s.players[2].cash = 0;
    s.debts.push({ debtor: 1, creditor: 0, amount: 50 }, { debtor: 2, creditor: 0, amount: 50 });
    expire(s, 'response');
    expect(s.debts).toEqual([]);
    expect(s.owned[5]).toMatchObject({ owner: 1, mortgaged: true });
    expect(s.players[1]).toMatchObject({ cash: 50, bankrupt: false });
    expect(s.players[2].bankrupt).toBe(true);
    expect(s.players[0].cash).toBe(1550);
    expect(s.current).toBe(0);
    expect(s.turnNumber).toBe(0);
  });
});
