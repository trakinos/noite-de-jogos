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
  it('shows the rent landing here costs now', () => {
    const s = game(2);
    give(s, 0, 1);
    expect(squareInfo(viewFor(s, 0), 1).rent).toEqual({ amount: 2 });
    give(s, 0, 3);
    expect(squareInfo(viewFor(s, 0), 1).rent).toEqual({ amount: 4 }); // whole rua, no buildings: doubled
    s.owned[1]!.houses = 2;
    expect(squareInfo(viewFor(s, 0), 1).rent).toEqual({ amount: 30 });
    s.owned[3]!.mortgaged = true;
    expect(squareInfo(viewFor(s, 0), 3).rent).toBeNull();
    expect(squareInfo(viewFor(s, 0), 6).rent).toBeNull(); // nobody owns it
  });
  it('gives a serviço\'s rent per dice point, doubled with all six', () => {
    const s = game(2);
    give(s, 1, 5);
    expect(squareInfo(viewFor(s, 0), 5).rent).toEqual({ perDice: 8 });
    for (const i of [15, 25, 35, 12, 28]) give(s, 1, i);
    expect(squareInfo(viewFor(s, 0), 5).rent).toEqual({ perDice: 16 });
    s.players[1]!.bankrupt = true;
    expect(squareInfo(viewFor(s, 0), 5).rent).toBeNull();
  });
  it('tells the players locked in the Papuda from the ones visiting', () => {
    const s = game(3);
    for (const p of s.players) p.pos = 10;
    s.players[1]!.jailTurns = 0;
    expect(squareInfo(viewFor(s, 0), 10)).toMatchObject({ tokens: [0, 1, 2], jailed: [1] });
    // Walking to the Papuda before the cop drops them there: not in the cell yet.
    s.players[1]!.pos = 30;
    expect(squareInfo(viewFor(s, 0), 30).jailed).toEqual([]);
  });
});
