import { describe, it, expect } from 'vitest';
import { BAIRRO_DICTIONARIES } from './i18n';
import { runFuzz } from './simkit';

describe('fuzzing', () => {
  it('50 seeded games of random intents and bot moves never throw, refuse with known reasons and keep every invariant', () => {
    const stats = runFuzz(50, 3000);
    expect(stats.violations).toEqual([]);
    for (const lang of ['pt', 'en'] as const) {
      for (const r of stats.reasons) expect(BAIRRO_DICTIONARIES[lang].reasons, `${lang} ${r}`).toHaveProperty(r);
    }
  });
});
