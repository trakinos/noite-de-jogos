import { describe, expect, it } from 'vitest';
import { entryAction } from './entry';

describe('entryAction', () => {
  it('no hash: front page', () => expect(entryAction('', 'Ana')).toEqual({ kind: 'front' }));
  it('invalid code in hash: front page', () => expect(entryAction('#join=XX', 'Ana')).toEqual({ kind: 'front' }));
  it('invite with a saved name: join straight away', () =>
    expect(entryAction('#join=abcd', 'Ana')).toEqual({ kind: 'autoJoin', code: 'ABCD', name: 'Ana' }));
  it('invite without a saved name: ask for the name first', () =>
    expect(entryAction('#join=ABCD', '  ')).toEqual({ kind: 'invited', code: 'ABCD' }));
});
