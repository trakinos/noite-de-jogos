import { beforeAll, describe, it, expect } from 'vitest';
import { BOARD, RUAS } from '../board';
import { DECK } from '../deck';
import { runFuzz, runSimulation } from '../simkit';
import { BAIRRO_DICTIONARIES } from './index';
import { RULES_LAYOUT } from '../ui/rulesLayout';

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

describe('bairro ui strings', () => {
  it('every ui key exists in both languages', () => {
    const keys = new Set([...Object.keys(BAIRRO_DICTIONARIES.pt.ui), ...Object.keys(BAIRRO_DICTIONARIES.en.ui)]);
    for (const lang of ['pt', 'en'] as const) for (const k of keys) expect(BAIRRO_DICTIONARIES[lang].ui, `${lang}.${k}`).toHaveProperty(k);
  });
});

describe('bairro rules text', () => {
  it('every rules key exists in both languages', () => {
    const keys = new Set([...Object.keys(BAIRRO_DICTIONARIES.pt.rules), ...Object.keys(BAIRRO_DICTIONARIES.en.rules)]);
    for (const lang of ['pt', 'en'] as const) for (const k of keys) expect(BAIRRO_DICTIONARIES[lang].rules, `${lang}.${k}`).toHaveProperty(k);
  });
  it('the layout uses only existing keys and leaves none unused', () => {
    const used = RULES_LAYOUT.flatMap(sec => [sec.title, ...sec.items]);
    for (const lang of ['pt', 'en'] as const) {
      const rules = BAIRRO_DICTIONARIES[lang].rules;
      for (const k of used) expect(rules, `${lang}.${k}`).toHaveProperty(k);
      expect(Object.keys(rules).filter(k => !used.includes(k)), lang).toEqual([]);
    }
  });
});

describe('bairro log and reason keys', () => {
  let logKeys = new Set<string>();
  let reasons = new Set<string>();
  beforeAll(() => {
    const sim = runSimulation(200, 5000);
    const fuzz = runFuzz(50, 3000);
    logKeys = new Set([...sim.logKeys, ...fuzz.logKeys]);
    reasons = new Set([...sim.reasons, ...fuzz.reasons]);
  }, 30_000);

  /** Dictionary keys the runs can't reach, each with why. */
  const UNREACHED_LOG: Record<string, string> = {
    timedOut: 'only a clock running out writes it, and the sim and fuzz never expire one; covered in timeout.test.ts',
    tradeVoided: 'nothing can change while an offer is open, so an accepted offer is always still valid; covered in trades.test.ts',
  };
  const UNREACHED_REASONS: Record<string, string> = {
    debtOpen: 'the debt gate in apply answers waitingForDebts before any asset rule runs; covered in engine.test.ts via canBuild',
    tooManyTrades: 'the bots stop at the cap and the fuzz rarely stacks three proposals in a turn; covered in trades.test.ts',
  };

  it.each(['pt', 'en'] as const)('every key produced exists in %s', lang => {
    const d = BAIRRO_DICTIONARIES[lang];
    for (const k of logKeys) expect(d.log, k).toHaveProperty(k);
    for (const k of reasons) expect(d.reasons, k).toHaveProperty(k);
  });

  it.each(['pt', 'en'] as const)('every %s log and reason key is produced or allowlisted with a reason', lang => {
    const d = BAIRRO_DICTIONARIES[lang];
    expect(Object.keys(d.log).filter(k => !logKeys.has(k) && !UNREACHED_LOG[k])).toEqual([]);
    expect(Object.keys(d.reasons).filter(k => !reasons.has(k) && !UNREACHED_REASONS[k])).toEqual([]);
  });

  it('the allowlists name only keys that really are unreached', () => {
    for (const k of Object.keys(UNREACHED_LOG)) expect(logKeys.has(k), k).toBe(false);
    for (const k of Object.keys(UNREACHED_REASONS)) expect(reasons.has(k), k).toBe(false);
  });
});
