import { beforeAll, describe, expect, it } from 'vitest';
import { BOARD } from '../board';
import { BAIRRO_DICTIONARIES } from '../i18n';
import { runFuzz, runSimulation } from '../simkit';
import { bairroText, money, PARAM_KIND } from './text';

describe('money', () => {
  it('formats both languages', () => {
    expect(money('pt', 1240)).toBe('$1.240');
    expect(money('en', 1240)).toBe('$1,240');
    expect(money('pt', 0)).toBe('$0');
    expect(money('en', 0)).toBe('$0');
    expect(money('pt', 1234567)).toBe('$1.234.567');
  });
  it('puts the minus first', () => {
    expect(money('pt', -50)).toBe('-$50');
    expect(money('en', -1500)).toBe('-$1,500');
  });
});

/** A representative param set for every log key. */
const SAMPLE: Record<string, Record<string, string | number>> = {
  rolled: { d1: 3, d2: 4 }, passStart: { amount: 200 }, bought: { pos: 1, price: 60 }, declined: { pos: 1 },
  paidRent: { to: 1, pos: 1, amount: 2 }, paidTax: { pos: 4, amount: 200 }, wonBolao: { amount: 300 },
  wentToJail: {}, thirdDouble: {}, paidJailFine: { amount: 50 }, usedLawyer: {}, leftJailDoubles: {},
  jailRollFailed: { turns: 2 }, jailFineForced: { amount: 50 }, luck: { card: 'c07' }, owesBank: { amount: 90 },
  owesPlayer: { to: 1, amount: 90 }, builtPuxadinho: { pos: 1, cost: 50 }, builtPredio: { pos: 1, cost: 50 },
  soldBuilding: { pos: 1, amount: 25 }, mortgaged: { pos: 1, amount: 30 }, unmortgaged: { pos: 1, amount: 33 },
  paidDebtBank: { amount: 90 }, paidDebtPlayer: { to: 1, amount: 90 }, bankruptToBank: {}, bankruptToPlayer: { to: 1 },
  tradeProposed: { to: 1 }, tradeAccepted: { to: 1 }, tradeDeclined: { to: 1 }, tradeCountered: { to: 1 }, tradeCancelled: { to: 1 },
  tradeVoided: { to: 1 }, won: {}, turnStarted: {}, timedOut: {},
};

describe.each(['pt', 'en'] as const)('logLine %s', lang => {
  const text = bairroText(lang);
  const names = ['Ana', 'Beto'];
  it('leaves no placeholder in any log key', () => {
    expect(Object.keys(BAIRRO_DICTIONARIES[lang].log).filter(k => !SAMPLE[k])).toEqual([]);
    for (const k of Object.keys(BAIRRO_DICTIONARIES[lang].log)) {
      const line = text.logLine({ player: 0, key: k, params: SAMPLE[k] }, names);
      expect(line, k).not.toMatch(/[{}]/);
    }
  });
  it('renders names, squares and money', () => {
    const line = text.logLine({ player: 0, key: 'paidRent', params: { to: 1, pos: 1, amount: 1240 } }, names);
    expect(line).toContain('Ana');
    expect(line).toContain('Beto');
    expect(line).toContain(BAIRRO_DICTIONARIES[lang].squares[BOARD[1].id]);
    expect(line).toContain(money(lang, 1240));
  });
  it('renders the drawn card text', () => {
    const line = text.logLine({ player: 0, key: 'luck', params: { card: 'c07' } }, names);
    expect(line).toContain(BAIRRO_DICTIONARIES[lang].cards.c07);
  });
  it('falls back to the key for unknown log keys and reasons', () => {
    expect(text.logLine({ player: 0, key: 'nope' }, names)).toBe('nope');
    expect(text.reason('nope')).toBe('nope');
    expect(text.card('zzz')).toBe('zzz');
  });
  it('names squares, ruas, reasons and terms', () => {
    expect(text.square(0)).toBe(BAIRRO_DICTIONARIES[lang].squares[BOARD[0].id]);
    expect(text.rua('r1')).toBe(BAIRRO_DICTIONARIES[lang].ruas.r1);
    expect(text.reason('notNow')).toBe(BAIRRO_DICTIONARIES[lang].reasons.notNow);
    expect(text.term('puxadinho')).toBe(BAIRRO_DICTIONARIES[lang].terms.puxadinho);
  });
});

describe('PARAM_KIND', () => {
  let params = new Set<string>();
  beforeAll(() => {
    const sim = runSimulation(100, 5000);
    const fuzz = runFuzz(30, 3000);
    params = new Set([...sim.logParams, ...fuzz.logParams]);
  }, 30_000);
  it('classifies every param the engine logs', () => {
    expect([...params].filter(p => !(p in PARAM_KIND))).toEqual([]);
  });
});
