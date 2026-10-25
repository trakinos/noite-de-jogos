import { describe, it, expect } from 'vitest';
import { ranking } from './ranking';
import { viewFor } from '../view';
import { apply } from '../engine';
import { game } from '../testkit';

/** A 4-player game where `order` go bankrupt in turn, to the bank. */
function brokeIn(order: number[], winner: number | null) {
  const s = game(4);
  s.bankruptOrder = order;
  for (const i of order) s.players[i].bankrupt = true;
  s.winner = winner;
  return viewFor(s, 0);
}

describe('ranking', () => {
  it('puts the winner first, then the bankrupt players latest-first', () => {
    expect(ranking(brokeIn([2, 0, 3], 1))).toEqual([1, 3, 0, 2]);
  });

  it('works for two players', () => {
    expect(ranking(brokeIn([1], 0))).toEqual([0, 1]);
  });

  it('with no winner, lists the survivors first (seat order), then the bankrupt latest-first', () => {
    expect(ranking(brokeIn([3, 1], null))).toEqual([0, 2, 1, 3]);
  });

  it('follows real play: three players going bust in order', () => {
    const s = game(4);
    s.phase = { kind: 'manage', rollAgain: false };
    for (const seat of [3, 1, 2]) {
      s.players[seat].cash = 0;
      s.debts.push({ debtor: seat, creditor: null, amount: 100 });
      expect(apply(s, seat, { type: 'goBankrupt' })).toEqual({ ok: true });
    }
    expect(s.winner).toBe(0);
    expect(ranking(viewFor(s, 0))).toEqual([0, 2, 1, 3]);
  });
});
