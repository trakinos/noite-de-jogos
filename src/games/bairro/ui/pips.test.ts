import { describe, expect, it } from 'vitest';
import { pipsFor } from './pips';

describe('pipsFor', () => {
  it('has as many pips as the face says', () => {
    for (let face = 1; face <= 6; face++) expect(pipsFor(face)).toHaveLength(face);
  });

  it('puts the odd faces\' middle pip in the center', () => {
    for (const face of [1, 3, 5]) expect(pipsFor(face)).toContain(4);
    for (const face of [2, 4, 6]) expect(pipsFor(face)).not.toContain(4);
  });

  it('keeps every pip inside the 3×3 grid', () => {
    for (let face = 1; face <= 6; face++) {
      for (const cell of pipsFor(face)) {
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThan(9);
      }
    }
  });

  it('shows nothing for a face that is not on a die', () => {
    expect(pipsFor(0)).toEqual([]);
    expect(pipsFor(7)).toEqual([]);
  });
});
