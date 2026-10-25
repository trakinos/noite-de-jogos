import { describe, expect, it } from 'vitest';
import type { BairroLogEntry } from '../types';
import { logRows } from './BairroLog';

const entry = (n: number): BairroLogEntry => ({ key: 'rolled', params: { n } }) as unknown as BairroLogEntry;

describe('logRows', () => {
  it('keys rows by absolute index', () => {
    expect(logRows([entry(0), entry(1)], 2).map(r => r.index)).toEqual([0, 1]);
  });
  it('keeps the keys moving once the wire cap holds the entries at a fixed length', () => {
    const entries = Array.from({ length: 150 }, (_, i) => entry(i));
    expect(logRows(entries, 150, 3).map(r => r.index)).toEqual([147, 148, 149]);
    expect(logRows(entries, 151, 3).map(r => r.index)).toEqual([148, 149, 150]);
  });
});
