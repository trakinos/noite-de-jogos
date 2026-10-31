import { describe, it, expect } from 'vitest';
import { moduleFor } from '../registry';
import { apply } from './engine';
import { bairroModule, BairroInstance } from './module';
import { game, give, rig } from './testkit';
import { viewFor } from './view';
import type { OfferTerms } from './types';

const offer = (to: number): OfferTerms => ({ to, give: { assets: [], cash: 10, lawyerCards: 0 }, get: { assets: [], cash: 0, lawyerCards: 0 } });

describe('viewFor', () => {
  it('never includes the deck order, the rng or rigged dice, but counts the deck', () => {
    const s = game(3);
    rig(s, [[1, 2]]);
    const v = viewFor(s, 1);
    expect(v).not.toHaveProperty('deck');
    expect(v).not.toHaveProperty('riggedDice');
    expect(v).not.toHaveProperty('rng');
    expect(v.deckCount).toBe(30);
    expect(v.you).toBe(1);
    expect(JSON.stringify(v)).not.toContain('c01');
  });

  it('reports the full log length', () => {
    const s = game(2);
    rig(s, [[1, 2]]);
    apply(s, 0, { type: 'roll' });
    expect(viewFor(s, 0).logTotal).toBe(s.log.length);
  });

  it('is a copy: changing the view leaves the state alone', () => {
    const s = game(2);
    give(s, 0, 1);
    const v = viewFor(s, 0);
    v.players[0].cash = 0;
    v.owned[1].houses = 3;
    expect(s.players[0].cash).toBe(1500);
    expect(s.owned[1].houses).toBe(0);
  });

  it('pending follows the current player\'s phase; others wait', () => {
    const s = game(2);
    expect([viewFor(s, 0).pending, viewFor(s, 1).pending]).toEqual(['roll', 'wait']);
    rig(s, [[1, 2]]);
    apply(s, 0, { type: 'roll' });
    expect([viewFor(s, 0).pending, viewFor(s, 1).pending]).toEqual(['buy', 'wait']);
    apply(s, 0, { type: 'decline' });
    expect(viewFor(s, 0).pending).toBe('manage');
  });

  it('pending is debt for an off-turn debtor, and the current player waits', () => {
    const s = game(3);
    s.phase = { kind: 'manage', rollAgain: false };
    s.debts.push({ debtor: 1, creditor: 0, amount: 50 });
    expect([0, 1, 2].map(p => viewFor(s, p).pending)).toEqual(['wait', 'debt', 'wait']);
  });

  it('pending is tradeAnswer for the recipient, and the proposer waits', () => {
    const s = game(3);
    expect(apply(s, 0, { type: 'proposeTrade', offer: offer(2) })).toEqual({ ok: true });
    expect([0, 1, 2].map(p => viewFor(s, p).pending)).toEqual(['wait', 'wait', 'tradeAnswer']);
  });

  it('at game over everyone waits, even with stale debts', () => {
    const s = game(2);
    s.debts.push({ debtor: 0, creditor: null, amount: 10 });
    s.winner = 1;
    expect([viewFor(s, 0).pending, viewFor(s, 1).pending]).toEqual(['wait', 'wait']);
  });

  it('a bankrupt player waits', () => {
    const s = game(3);
    s.players[0].bankrupt = true;
    expect(viewFor(s, 0).pending).toBe('wait');
  });
});

describe('clock input', () => {
  const instance = (n: number) => bairroModule.create(
    Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), bairroModule.defaultOptions(), 1) as BairroInstance;

  it('keeps one turn object per turn and replaces it when the turn changes', () => {
    const g = instance(2);
    const a = g.clockInput();
    expect(g.clockInput().turn).toBe(a.turn);
    expect(a).toMatchObject({ currentPlayer: g.state.current, pending: null, over: false });
    g.state.phase = { kind: 'manage', rollAgain: false };
    expect(g.apply(g.state.players[g.state.current].id, { type: 'endTurn' })).toEqual({ ok: true });
    const b = g.clockInput();
    expect(b.turn).not.toBe(a.turn);
    expect(b.currentPlayer).toBe(g.state.current);
  });

  it('pending is the trade recipient, stable while the offer stands', () => {
    const g = instance(3);
    const s = g.state;
    const to = (s.current + 1) % 3;
    apply(s, s.current, { type: 'proposeTrade', offer: offer(to) });
    const a = g.clockInput();
    expect(a.pending).toEqual({ player: to });
    expect(a.group ?? null).toBeNull();
    expect(g.clockInput().pending).toBe(a.pending);
  });

  it('a single off-turn debtor is pending; the current player\'s own debt is not', () => {
    const g = instance(3);
    const s = g.state;
    const other = (s.current + 1) % 3;
    s.debts.push({ debtor: s.current, creditor: null, amount: 10 });
    expect(g.clockInput().pending).toBeNull();
    s.debts = [{ debtor: other, creditor: s.current, amount: 10 }];
    const a = g.clockInput();
    expect(a.pending).toEqual({ player: other });
    expect(g.clockInput().pending).toBe(a.pending);
  });

  it('two or more off-turn debtors share one group, renewed when the debts change', () => {
    const g = instance(4);
    const s = g.state;
    const [x, y] = [(s.current + 1) % 4, (s.current + 2) % 4];
    s.debts.push({ debtor: x, creditor: s.current, amount: 50 }, { debtor: y, creditor: s.current, amount: 50 });
    const a = g.clockInput();
    expect(a.group).toBeTruthy();
    expect(g.clockInput().group).toBe(a.group);
    s.debts.push({ debtor: (s.current + 3) % 4, creditor: s.current, amount: 50 });
    const b = g.clockInput();
    expect(b.group).toBeTruthy();
    expect(b.group).not.toBe(a.group);
  });

  it('is over once there is a winner', () => {
    const g = instance(2);
    g.state.winner = 0;
    expect(g.clockInput().over).toBe(true);
    expect(g.over).toBe(true);
  });
});

describe('bairroModule', () => {
  it('seats 2 to 6 players with no options', () => {
    expect(bairroModule).toMatchObject({ id: 'bairro', minPlayers: 2, maxPlayers: 6 });
    const off = { auctionDeclined: false, skills: false, pocketCards: false };
    expect(bairroModule.defaultOptions()).toEqual({ openTrades: false, theme: 'bairro', auctionDeclined: true, skills: true, pocketCards: true });
    expect(bairroModule.parseOptions({})).toEqual({ openTrades: false, theme: 'bairro', ...off });
    expect(bairroModule.parseOptions({ openTrades: true, theme: 'esquema', skills: true, anything: 1 })).toEqual({ openTrades: true, theme: 'esquema', ...off, skills: true });
    expect(bairroModule.parseOptions({ openTrades: 'yes', theme: 'castelo', pocketCards: 1 })).toEqual({ openTrades: false, theme: 'bairro', ...off });
    for (const raw of [null, undefined, 3, 'x', []]) expect(bairroModule.parseOptions(raw)).toHaveProperty('error');
  });

  it('is registered with the host', () => {
    expect(moduleFor('bairro')).toBe(bairroModule);
  });

  it('maps player ids to seats for apply and viewFor', () => {
    const g = bairroModule.create([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], bairroModule.defaultOptions(), 5);
    const s = (g as BairroInstance).state;
    const current = s.players[s.current].id;
    const other = s.players[1 - s.current].id;
    expect(g.apply(other, { type: 'roll' })).toEqual({ ok: false, reason: 'notYourTurn' });
    expect(g.apply('nobody', { type: 'roll' })).toEqual({ ok: false, reason: 'notYourTurn' });
    expect(g.apply(current, { type: 'roll' })).toEqual({ ok: true });
    expect((g.viewFor(other) as ReturnType<typeof viewFor>).you).toBe(1 - s.current);
    expect(() => g.viewFor('nobody')).toThrow();
  });
});

describe('trade privacy', () => {
  const offer = (s: ReturnType<typeof game>) => {
    give(s, 0, 1);
    s.offer = { from: 0, to: 1, give: { assets: [1], cash: 50, lawyerCards: 0 }, get: { assets: [], cash: 100, lawyerCards: 0 }, counters: 0 };
  };

  it('keeps the terms between the two players by default', () => {
    const s = game(3);
    offer(s);
    expect(viewFor(s, 0).offer).toEqual(s.offer);
    expect(viewFor(s, 1).offer).toEqual(s.offer);
    expect(viewFor(s, 2).offer).toEqual({ from: 0, to: 1, counters: 0, give: { assets: [], cash: 0, lawyerCards: 0 }, get: { assets: [], cash: 0, lawyerCards: 0 } });
  });

  it('shows everyone the terms with open trades', () => {
    const s = game(3);
    s.openTrades = true;
    offer(s);
    expect(viewFor(s, 2).offer).toEqual(s.offer);
  });

  it('starts a room with the lobby setting', () => {
    const seats = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    const off = { openTrades: false, theme: 'bairro', auctionDeclined: false, skills: false, pocketCards: false } as const;
    expect(bairroModule.create(seats, { ...off, openTrades: true }, 1)).toMatchObject({ state: { openTrades: true } });
    expect(bairroModule.create(seats, bairroModule.defaultOptions(), 1)).toMatchObject({ state: { openTrades: false, auctionDeclined: true, pocketCards: true } });
    expect((bairroModule.create(seats, off, 1) as BairroInstance).state.players.every(p => p.skill === null)).toBe(true);
    expect((bairroModule.create(seats, bairroModule.defaultOptions(), 1) as BairroInstance).state.players.every(p => p.skill !== null)).toBe(true);
  });
});
