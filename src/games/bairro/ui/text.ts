import type { Lang } from '../../../i18n/types';
import { interpolate } from '../../../i18n';
import { BOARD } from '../board';
import type { RuaId } from '../board';
import { BAIRRO_DICTIONARIES } from '../i18n';
import type { BairroDictionary } from '../i18n';
import { themeOverlay, type BairroTheme } from '../i18n/themes';
import type { BairroLogEntry } from '../types';

/** `$1.240` in pt, `$1,240` in en; a negative amount gets a leading minus. */
export function money(lang: Lang, n: number): string {
  const sep = lang === 'pt' ? '.' : ',';
  const digits = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return `${n < 0 ? '-' : ''}$${digits}`;
}

/** How each log param is shown. Every param the engine logs must be listed here (text.test.ts checks it). */
export const PARAM_KIND: Record<string, 'seat' | 'square' | 'card' | 'money' | 'plain'> = {
  player: 'seat', creditor: 'seat', debtor: 'seat', to: 'seat', from: 'seat', owner: 'seat', winner: 'seat',
  pos: 'square', square: 'square',
  card: 'card',
  amount: 'money', price: 'money', rent: 'money', fine: 'money', total: 'money', cost: 'money', refund: 'money',
  d1: 'plain', d2: 'plain', turns: 'plain',
};

const own = (o: Record<string, string>, k: string): string | undefined => (Object.hasOwn(o, k) ? o[k] : undefined);

/** The dictionary for `lang` with `theme`'s wording laid over it. */
function themed(lang: Lang, theme: BairroTheme): BairroDictionary {
  const base = BAIRRO_DICTIONARIES[lang];
  const over = themeOverlay(theme, lang);
  const merged = { ...base } as Record<keyof BairroDictionary, Record<string, string>>;
  for (const section of Object.keys(over) as (keyof BairroDictionary)[]) {
    merged[section] = { ...base[section], ...(over[section] as Record<string, string>) };
  }
  return merged as BairroDictionary;
}

export function bairroText(lang: Lang, theme: BairroTheme = 'bairro') {
  const d = theme === 'bairro' ? BAIRRO_DICTIONARIES[lang] : themed(lang, theme);
  const square = (pos: number): string => {
    const id = BOARD[pos]?.id;
    return (id !== undefined && own(d.squares, id)) || id || String(pos);
  };
  const card = (id: string): string => own(d.cards, id) ?? id;
  return {
    square,
    rua: (id: RuaId): string => d.ruas[id] ?? id,
    card,
    reason: (key: string): string => own(d.reasons, key) ?? key,
    /** Whether `key` is one of the bairro's refusal reasons (else it is a platform one). */
    hasReason: (key: string): boolean => own(d.reasons, key) !== undefined,
    /** A rulebook line with its `{params}` filled. */
    rule: (key: string, params: Record<string, string | number>): string => interpolate(own(d.rules, key) ?? key, params),
    term: (key: string): string => own(d.terms, key) ?? key,
    /** A `ui` string with its `{params}` filled. */
    ui: (key: string, params?: Record<string, string | number>): string => interpolate(own(d.ui, key) ?? key, params ?? {}),
    /** The templates own the wording, `{player}` included; this only fills the params. */
    logLine(entry: BairroLogEntry, names: string[]): string {
      const template = own(d.log, entry.key);
      if (template === undefined) return entry.key;
      const params: Record<string, string | number> = {};
      if (entry.player !== null) params.player = names[entry.player] ?? '';
      for (const [k, v] of Object.entries(entry.params ?? {})) {
        switch (PARAM_KIND[k]) {
          case 'seat': params[k] = names[Number(v)] ?? ''; break;
          case 'square': params[k] = square(Number(v)); break;
          case 'card': params[k] = card(String(v)); break;
          case 'money': params[k] = money(lang, Number(v)); break;
          default: params[k] = v;
        }
      }
      return interpolate(template, params);
    },
  };
}

export type BairroText = ReturnType<typeof bairroText>;
