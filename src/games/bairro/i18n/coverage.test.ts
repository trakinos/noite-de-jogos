import { describe, it, expect } from 'vitest';
import { BOARD, RUAS } from '../board';
import { DECK } from '../deck';
import { BAIRRO_DICTIONARIES } from './index';

describe.each(['pt', 'en'] as const)('bairro dictionary %s', lang => {
  const d = BAIRRO_DICTIONARIES[lang];
  it('names every square id', () => {
    for (const s of BOARD) expect(d.squares[s.id], s.id).toBeTruthy();
  });
  it('names every rua', () => {
    for (const r of Object.keys(RUAS)) expect(d.ruas[r as keyof typeof RUAS], r).toBeTruthy();
  });
  it('has text for every card', () => {
    for (const c of DECK) expect(d.cards[c.id], c.id).toBeTruthy();
  });
  it('has the theme terms', () => {
    for (const t of ['puxadinho', 'predio', 'escritura', 'prefeitura', 'faliu', 'dono-do-bairro']) expect(d.terms[t], t).toBeTruthy();
  });
});
