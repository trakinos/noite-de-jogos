import { describe, expect, it } from 'vitest';
import { viewFor } from '../view';
import { game, give } from '../testkit';
import { squareInfo } from './squareInfo';

describe('squareInfo', () => {
  it('describes an owned ponto with a prédio', () => {
    const s = game(2);
    give(s, 1, 1, { houses: 5 });
    expect(squareInfo(viewFor(s, 0), 1)).toMatchObject({
      kind: 'ponto', name: 'borracharia', ruaColor: '#8c5a2b', price: 60, owner: 1, houses: 5, mortgaged: false, tokens: [],
    });
  });
  it('shows a mortgaged serviço', () => {
    const s = game(2);
    give(s, 0, 5, { mortgaged: true });
    expect(squareInfo(viewFor(s, 0), 5)).toMatchObject({
      kind: 'servico', name: 'kombi', ruaColor: null, price: 200, owner: 0, mortgaged: true,
    });
  });
  it('lists the tokens on a luck square, not the owner or price', () => {
    const s = game(3);
    s.players[0]!.pos = 2; s.players[2]!.pos = 2;
    expect(squareInfo(viewFor(s, 0), 2)).toMatchObject({ kind: 'luck', price: null, owner: null, tokens: [0, 2] });
  });
  it('hides a bankrupt player\'s token', () => {
    const s = game(3);
    s.players[0]!.pos = 2; s.players[1]!.pos = 2; s.players[1]!.bankrupt = true;
    expect(squareInfo(viewFor(s, 0), 2).tokens).toEqual([0]);
  });
});
