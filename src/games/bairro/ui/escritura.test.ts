import { describe, expect, it } from 'vitest';
import { game, give } from '../testkit';
import { viewFor } from '../view';
import { escrituraFor } from './escritura';

const current = (e: NonNullable<ReturnType<typeof escrituraFor>>) => e.rentRows.filter(r => r.current).map(r => r.label);
const btn = (e: NonNullable<ReturnType<typeof escrituraFor>>, id: string) => e.buttons.find(b => b.id === id);

describe('escrituraFor', () => {
  it('has no escritura for a square that is not a deed', () => {
    expect(escrituraFor(viewFor(game(2), 0), 0)).toBeNull();
  });

  it('lists the rent rows and marks the building level now', () => {
    const s = game(2);
    give(s, 1, 1, { houses: 2 });
    const e = escrituraFor(viewFor(s, 0), 1)!;
    expect(e).toMatchObject({ name: 'borracharia', rua: 'r1', price: 60, houseCost: 50, mortgage: 30, unmortgageCost: 36, owner: 1, houses: 2 });
    expect(e.rentRows.map(r => [r.label, r.amount])).toEqual([['base', 2], ['1', 10], ['2', 30], ['3', 90], ['4', 160], ['predio', 250]]);
    expect(current(e)).toEqual(['2']);
  });

  it('marks the prédio row', () => {
    const s = game(2);
    give(s, 1, 1, { houses: 5 });
    expect(current(escrituraFor(viewFor(s, 0), 1)!)).toEqual(['predio']);
  });

  it('shows double base rent for a whole rua with no buildings', () => {
    const s = game(2);
    give(s, 1, 1); give(s, 1, 3);
    const e = escrituraFor(viewFor(s, 0), 1)!;
    expect(e.rentRows[0]).toMatchObject({ label: 'base', amount: 4, current: true, doubled: true });
  });

  it('keeps plain base rent when the rua is split', () => {
    const s = game(2);
    give(s, 1, 1); give(s, 0, 3);
    expect(escrituraFor(viewFor(s, 0), 1)!.rentRows[0]).toMatchObject({ amount: 2, current: true, doubled: false });
  });

  it('shows a serviço rule, doubled with all six', () => {
    const s = game(2);
    give(s, 1, 5);
    let e = escrituraFor(viewFor(s, 0), 5)!;
    expect(e.rentRows).toEqual([]);
    expect(e.servico).toEqual({ multiplier: 8, doubled: false, current: true });
    for (const p of [5, 12, 15, 25, 28, 35]) give(s, 1, p);
    e = escrituraFor(viewFor(s, 0), 5)!;
    expect(e.servico).toEqual({ multiplier: 8, doubled: true, current: true });
  });

  it('enables building on an owned whole rua', () => {
    const s = game(2);
    give(s, 0, 1); give(s, 0, 3);
    const e = escrituraFor(viewFor(s, 0), 1)!;
    expect(btn(e, 'build')).toEqual({ id: 'build', enabled: true, reason: null, amount: 50 });
    expect(btn(e, 'sell')).toMatchObject({ enabled: false, reason: 'noBuildings', amount: 25 });
    expect(btn(e, 'mortgage')).toMatchObject({ enabled: true, amount: 30 });
    expect(btn(e, 'unmortgage')).toBeUndefined();
  });

  it('disables an uneven build with its reason', () => {
    const s = game(2);
    give(s, 0, 1, { houses: 1 }); give(s, 0, 3);
    expect(btn(escrituraFor(viewFor(s, 0), 1)!, 'build')).toMatchObject({ enabled: false, reason: 'unevenBuild' });
  });

  it('offers only unmortgage on a mortgaged asset', () => {
    const s = game(2);
    give(s, 0, 5, { mortgaged: true });
    const e = escrituraFor(viewFor(s, 0), 5)!;
    expect(e.buttons).toEqual([{ id: 'unmortgage', enabled: true, reason: null, amount: 120 }]);
    expect(e.mortgaged).toBe(true);
  });

  it('shows no buttons on someone else\'s asset or an unowned one', () => {
    const s = game(2);
    give(s, 1, 1);
    expect(escrituraFor(viewFor(s, 0), 1)!.buttons).toEqual([]);
    expect(escrituraFor(viewFor(s, 0), 3)!.buttons).toEqual([]);
    expect(escrituraFor(viewFor(s, 0), 3)!.owner).toBeNull();
  });

  it('lets a debtor in the buy phase sell and mortgage but not build', () => {
    const s = game(2);
    give(s, 0, 1, { houses: 1 }); give(s, 0, 3, { houses: 1 });
    s.phase = { kind: 'buy', square: 6, rollAgain: false };
    s.debts = [{ debtor: 0, creditor: 1, amount: 100 }];
    const e = escrituraFor(viewFor(s, 0), 1)!;
    expect(btn(e, 'sell')).toMatchObject({ enabled: true, reason: null });
    expect(btn(e, 'build')).toMatchObject({ enabled: false, reason: 'debtOpen' });
    expect(btn(e, 'mortgage')).toMatchObject({ enabled: false, reason: 'ruaHasBuildings' });
  });

  it('marks no rent row current on a mortgaged ponto or serviço', () => {
    const s = game(2);
    give(s, 1, 1, { houses: 0, mortgaged: true }); give(s, 1, 5, { mortgaged: true });
    expect(current(escrituraFor(viewFor(s, 0), 1)!)).toEqual([]);
    expect(escrituraFor(viewFor(s, 0), 5)!.servico).toMatchObject({ current: false });
  });

  it('marks no rent row current when the owner is bankrupt', () => {
    const s = game(3);
    give(s, 1, 1, { houses: 2 }); give(s, 1, 5);
    s.players[1]!.bankrupt = true;
    expect(current(escrituraFor(viewFor(s, 0), 1)!)).toEqual([]);
    expect(escrituraFor(viewFor(s, 0), 5)!.servico).toMatchObject({ current: false });
  });

  it('hides the buttons when the game is over or the viewer is bankrupt', () => {
    const s = game(3);
    give(s, 0, 1);
    expect(escrituraFor(viewFor(s, 0), 1)!.buttons.length).toBeGreaterThan(0);
    s.players[0]!.bankrupt = true;
    expect(escrituraFor(viewFor(s, 0), 1)!.buttons).toEqual([]);
    s.players[0]!.bankrupt = false;
    s.winner = 1;
    expect(escrituraFor(viewFor(s, 0), 1)!.buttons).toEqual([]);
  });
});
