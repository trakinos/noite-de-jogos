import { describe, expect, it } from 'vitest';
import { HIDDEN_BID } from './auction';
import { apply } from './engine';
import { BairroInstance } from './module';
import { game, give } from './testkit';
import { viewFor } from './view';
import type { BairroState } from './types';

/** Player 0 goes bankrupt to the Prefeitura holding `assets`; returns the game with the auction open. */
function bankrupt(players: number, assets: number[], build: Partial<Record<number, { houses?: number; mortgaged?: boolean }>> = {}): BairroState {
  const s = game(players);
  s.phase = { kind: 'manage', rollAgain: false };
  for (const pos of assets) give(s, 0, pos, build[pos] ?? {});
  s.players[0].cash = 0;
  s.debts.push({ debtor: 0, creditor: null, amount: 5000 });
  expect(apply(s, 0, { type: 'goBankrupt' })).toEqual({ ok: true });
  return s;
}
const bid = (s: BairroState, player: number, amount: number) => apply(s, player, { type: 'bid', amount });

describe('bankruptcy auction', () => {
  it('sells each escritura to the highest sealed bid, in board order, and pays the bank', () => {
    const s = bankrupt(3, [6, 1]);
    expect(s.auction?.lots).toEqual([1, 6]);
    expect(bid(s, 1, 40)).toEqual({ ok: true });
    expect(s.owned[1]).toBeUndefined();
    expect(bid(s, 2, 55)).toEqual({ ok: true });
    expect(s.owned[1]).toEqual({ owner: 2, houses: 0, mortgaged: false });
    expect(s.players[2].cash).toBe(1500 - 55);
    expect(s.players[1].cash).toBe(1500);
    expect(s.auction?.lots).toEqual([6]);
    expect(s.auction?.bids).toEqual([null, null, null]);
    bid(s, 1, 100);
    bid(s, 2, 0);
    expect(s.owned[6]?.owner).toBe(1);
    expect(s.auction).toBeNull();
    expect(s.log.filter(e => e.key.startsWith('auction')).map(e => [e.key, e.params])).toEqual([
      ['auctionStarted', { pos: 1 }],
      ['auctionWon', { pos: 1, amount: 55 }],
      ['auctionNext', { pos: 6 }],
      ['auctionWon', { pos: 6, amount: 100 }],
    ]);
  });

  it('sells clean: buildings and mortgages are gone', () => {
    const s = bankrupt(2, [1, 3, 5], { 1: { houses: 2 }, 3: { houses: 2 }, 5: { mortgaged: true } });
    // Only two players: with player 0 bust the game is over, so no auction.
    expect(s.winner).toBe(1);
    expect(s.auction).toBeNull();
    const t = bankrupt(3, [1, 3, 5], { 1: { houses: 2 }, 3: { houses: 2 }, 5: { mortgaged: true } });
    for (const _ of [1, 3, 5]) { bid(t, 1, 10); bid(t, 2, 0); }
    expect([t.owned[1], t.owned[3], t.owned[5]]).toEqual([1, 1, 1].map(owner => ({ owner, houses: 0, mortgaged: false })));
  });

  it('leaves an escritura with the Prefeitura when nobody bids', () => {
    const s = bankrupt(3, [1]);
    bid(s, 1, 0);
    bid(s, 2, 0);
    expect(s.owned[1]).toBeUndefined();
    expect(s.auction).toBeNull();
    expect(s.log.at(-1)).toEqual({ player: null, key: 'auctionUnsold', params: { pos: 1 } });
  });

  it('breaks ties by turn order from the current player', () => {
    const s = bankrupt(4, [1]);
    // Player 0 was current and went bust, so player 1 is current now: 1, 2, 3.
    expect(s.current).toBe(1);
    bid(s, 3, 50);
    bid(s, 2, 50);
    bid(s, 1, 20);
    expect(s.owned[1]?.owner).toBe(2);
  });

  it('takes one bid per player, within their cash, and holds everything else until it ends', () => {
    const s = bankrupt(3, [1]);
    expect(bid(s, 1, 1501)).toEqual({ ok: false, reason: 'notEnoughCash' });
    expect(bid(s, 1, -5)).toEqual({ ok: false, reason: 'badBid' });
    expect(apply(s, 1, { type: 'bid', amount: 2.5 })).toEqual({ ok: false, reason: 'badBid' });
    expect(bid(s, 0, 10)).toEqual({ ok: false, reason: 'bankrupt' });
    expect(bid(s, 1, 10)).toEqual({ ok: true });
    expect(bid(s, 1, 20)).toEqual({ ok: false, reason: 'alreadyBid' });
    expect(apply(s, 1, { type: 'roll' })).toEqual({ ok: false, reason: 'auctionOpen' });
    expect(apply(s, 2, { type: 'bid', amount: 0 }).ok).toBe(true);
    expect(apply(s, 1, { type: 'roll' }).ok).toBe(true);
  });

  it('keeps bids sealed in the views until the lot closes', () => {
    const s = bankrupt(3, [1, 3]);
    bid(s, 1, 40);
    expect(viewFor(s, 1).auction?.bids).toEqual([null, 40, null]);
    expect(viewFor(s, 2).auction?.bids).toEqual([null, HIDDEN_BID, null]);
    expect(viewFor(s, 1).pending).toBe('wait');
    expect(viewFor(s, 2).pending).toBe('bid');
    expect(viewFor(s, 0).pending).toBe('wait');
  });

  it('passes for whoever runs out of time, then gives the next escritura its own clock', () => {
    const s = bankrupt(3, [1, 3]);
    const g = new BairroInstance(s);
    const first = g.clockInput();
    expect(first.group).not.toBeNull();
    bid(s, 1, 30);
    expect(g.clockInput().pending).toEqual({ player: 2 });
    g.expire('response', 1);
    expect(s.owned[1]?.owner).toBe(1);
    expect(s.log.some(e => e.key === 'timedOut' && e.player === 2)).toBe(true);
    expect(s.auction?.lots).toEqual([3]);
    expect(g.clockInput().group).not.toBe(first.group);
    g.expire('turn', 2);
    expect(s.auction).toBeNull();
    expect(s.owned[3]).toBeUndefined();
  });
});
