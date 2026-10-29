import { describe, expect, it } from 'vitest';
import { game } from '../testkit';
import { viewFor } from '../view';
import { bairroText } from './text';
import { joinNames, waitingFor } from './waiting';

describe('joinNames', () => {
  it('uses the language list style without an Oxford comma', () => {
    expect(joinNames('pt', ['Ana'])).toBe('Ana');
    expect(joinNames('pt', ['Ana', 'Bia'])).toBe('Ana e Bia');
    expect(joinNames('pt', ['Ana', 'Bia', 'Caio'])).toBe('Ana, Bia e Caio');
    expect(joinNames('en', ['Ana', 'Bia'])).toBe('Ana and Bia');
    expect(joinNames('en', ['Ana', 'Bia', 'Caio'])).toBe('Ana, Bia and Caio');
  });
});

describe('waitingFor', () => {
  const names = ['Ana', 'Bia', 'Caio'];
  const waiting = (s: ReturnType<typeof game>, seat: number) => waitingFor(viewFor(s, seat), names, 'en');

  it('is null when you have something to do', () => {
    expect(waiting(game(3), 0)).toBeNull();
  });

  it('says who is playing', () => {
    expect(waiting(game(3), 1)).toEqual({ key: 'waitPlaying', params: { name: 'Ana' } });
  });

  it('lists everyone who owes, in seat order, when you are not one of them', () => {
    const s = game(3);
    s.debts = [{ debtor: 2, creditor: 0, amount: 50 }, { debtor: 1, creditor: null, amount: 20 }, { debtor: 2, creditor: 1, amount: 5 }];
    expect(waiting(s, 0)).toEqual({ key: 'waitDebts', params: { names: 'Bia and Caio' } });
  });

  it('says who is answering a trade', () => {
    const s = game(3);
    s.offer = { from: 0, to: 2, give: { assets: [], cash: 10, lawyerCards: 0 }, get: { assets: [], cash: 0, lawyerCards: 0 }, counters: 0 };
    expect(waiting(s, 0)).toEqual({ key: 'waitTrade', params: { name: 'Caio' } });
  });

  it('says the game is over', () => {
    const s = game(3);
    s.winner = 1;
    expect(waiting(s, 0)).toEqual({ key: 'gameOver', params: {} });
    expect(bairroText('pt').ui('gameOver')).not.toBe('gameOver');
  });
});

describe('waitingFor during an auction', () => {
  it('says the auction is on, for whoever has already bid', () => {
    const s = game(3);
    s.auction = { from: 0, lots: [1], bids: [null, 40, null] };
    s.players[0].bankrupt = true;
    expect(waitingFor(viewFor(s, 1), ['A', 'B', 'C'], 'pt')).toEqual({ key: 'waitAuction', params: {} });
    expect(waitingFor(viewFor(s, 2), ['A', 'B', 'C'], 'pt')).toBeNull();
  });
});
