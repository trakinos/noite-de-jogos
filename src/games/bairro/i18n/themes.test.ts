import { describe, expect, it } from 'vitest';
import { BOARD, RUAS } from '../board';
import { DECK } from '../deck';
import { bairroText } from '../ui/text';
import { BAIRRO_DICTIONARIES } from './index';
import type { BairroDictionary } from './index';
import { BAIRRO_THEMES, isBairroTheme, themeOverlay } from './themes';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

describe.each(BAIRRO_THEMES.filter(t => t !== 'bairro'))('theme %s', theme => {
  it('rewords only keys the neighborhood has, keeping their {params}', () => {
    for (const lang of ['pt', 'en'] as const) {
      const base = BAIRRO_DICTIONARIES[lang];
      const over = themeOverlay(theme, lang);
      for (const section of Object.keys(over) as (keyof BairroDictionary)[]) {
        for (const [key, value] of Object.entries(over[section]!)) {
          const original = (base[section] as Record<string, string>)[key];
          expect(original, `${lang}.${section}.${key}`).toBeDefined();
          expect(placeholders(value as string), `${lang}.${section}.${key}`).toEqual(placeholders(original!));
        }
      }
    }
  });

  it('rewords the same keys in both languages', () => {
    const keys = (lang: 'pt' | 'en') =>
      Object.entries(themeOverlay(theme, lang)).flatMap(([section, entries]) => Object.keys(entries!).map(k => `${section}.${k}`)).sort();
    expect(keys('en')).toEqual(keys('pt'));
  });

  it('gives every escritura, serviço, rua and card its own name', () => {
    for (const lang of ['pt', 'en'] as const) {
      const themed = bairroText(lang, theme);
      const plain = bairroText(lang);
      for (const [pos, sq] of BOARD.entries()) {
        if (sq.kind === 'ponto' || sq.kind === 'servico') expect(themed.square(pos), sq.id).not.toBe(plain.square(pos));
      }
      for (const rua of Object.keys(RUAS) as (keyof typeof RUAS)[]) expect(themed.rua(rua), rua).not.toBe(plain.rua(rua));
      for (const c of DECK) expect(themed.card(c.id), c.id).not.toBe(plain.card(c.id));
    }
  });

  it('falls back to the neighborhood for anything it does not reword', () => {
    expect(bairroText('pt', theme).ui('yourTurn')).toBe(bairroText('pt').ui('yourTurn'));
  });
});

describe('themes', () => {
  it('know their own ids', () => {
    expect(isBairroTheme('esquema')).toBe(true);
    expect(isBairroTheme('castelo')).toBe(false);
    expect(bairroText('pt', 'esquema').square(0)).toBe('Mensalinho');
    expect(bairroText('pt', 'esquema').logLine({ player: 0, key: 'won' }, ['Ana'])).toBe('Ana é o Dono do Esquema!');
  });
});
