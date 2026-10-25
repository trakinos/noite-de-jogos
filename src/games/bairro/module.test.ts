import { describe, it, expect } from 'vitest';
import { BairroInstance } from './module';
import { game } from './testkit';

describe('BairroInstance.clockInput response group', () => {
  it('keeps the group identity when one of several debts is paid, and changes it when the debtor set changes', () => {
    const s = game(4);
    s.debts.push({ debtor: 1, creditor: 0, amount: 50 }, { debtor: 2, creditor: 0, amount: 50 }, { debtor: 3, creditor: 0, amount: 50 });
    const inst = new BairroInstance(s);
    const first = inst.clockInput().group;
    expect(first).not.toBeNull();
    s.debts[0].amount = 20; // partial payment
    expect(inst.clockInput().group).toBe(first);
    s.debts.shift(); // debtor 1 settled; 2 and 3 still owe
    const rest = inst.clockInput().group;
    expect(rest).not.toBe(first); // the debtor set changed
    s.debts[0].amount = 10;
    expect(inst.clockInput().group).toBe(rest);
  });
});
