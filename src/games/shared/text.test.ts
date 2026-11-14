import { describe, expect, it } from 'vitest';
import { CAREERS, HOUSES, BOARD } from '../vida/board';
import { CHESS_TEXT } from '../chess/text';
import { FORCA_TEXT } from '../forca/ForcaScreen';
import { NAVAL_TEXT } from '../naval/text';
import { VELHA_TEXT } from '../velha/VelhaScreen';
import { ZEROU_TEXT } from '../zerou/ZerouScreen';
import { PISTA_TEXT } from '../pista/text';
import { VIDA_TEXT } from '../vida/text';

describe('newer games text', () => {
  it.each([['chess', CHESS_TEXT], ['pista', PISTA_TEXT], ['vida', VIDA_TEXT], ['naval', NAVAL_TEXT], ['zerou', ZEROU_TEXT], ['velha', VELHA_TEXT], ['forca', FORCA_TEXT]] as const)('%s has the same keys in pt and en', (_, texts) => {
    expect(Object.keys(texts.en).sort()).toEqual(Object.keys(texts.pt).sort());
  });

  it('vida names every square, career and house', () => {
    const keys = [
      ...BOARD.flatMap(sq => ('t' in sq ? [`t_${sq.t}`] : [])),
      ...CAREERS.map(c => `c_${c.id}`),
      ...HOUSES.map(h => `h_${h.id}`),
    ];
    for (const k of keys) expect(VIDA_TEXT.pt[k], k).toBeTruthy();
  });
});
