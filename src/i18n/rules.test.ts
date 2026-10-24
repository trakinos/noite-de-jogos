import { describe, it, expect } from 'vitest';
import { RULES, RULES_CARDS } from './rules';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

describe('rulebook', () => {
  it('has the same sections and items in every language', () => {
    const shape = (lang: keyof typeof RULES) => RULES[lang].map((s) => s.items.length);
    expect(shape('en')).toEqual(shape('pt'));
  });

  it('only names cards it knows how to fill in, the same ones in each language', () => {
    RULES.pt.forEach((section, i) =>
      section.items.forEach((item, k) => {
        const en = RULES.en[i].items[k];
        for (const id of [...placeholders(item), ...placeholders(en)]) expect(RULES_CARDS).toContain(id);
        expect(placeholders(item).sort()).toEqual(placeholders(en).sort());
      }),
    );
  });
});
