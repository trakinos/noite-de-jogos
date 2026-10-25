import type { Lang } from '../../../i18n/types';
import type { RuaId } from '../board';
import { pt } from './pt';
import { en } from './en';

export interface BairroDictionary {
  squares: Record<string, string>;
  ruas: Record<RuaId, string>;
  cards: Record<string, string>;
  log: Record<string, string>;
  reasons: Record<string, string>;
  terms: Record<string, string>;
  ui: Record<string, string>;
  /** The rulebook's text, laid out by `RULES_LAYOUT`; `{params}` come from the game's constants. */
  rules: Record<string, string>;
}

export const BAIRRO_DICTIONARIES: Record<Lang, BairroDictionary> = { pt, en };
