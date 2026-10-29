import type { Lang } from '../../../i18n/types';
import type { BairroDictionary } from './index';
import { esquemaEn, esquemaPt } from './esquema';

/** The board's look and names, picked in the lobby. The rules and values are the same in every theme. */
export type BairroTheme = 'bairro' | 'esquema';
export const BAIRRO_THEMES: readonly BairroTheme[] = ['bairro', 'esquema'];

export function isBairroTheme(x: unknown): x is BairroTheme {
  return typeof x === 'string' && (BAIRRO_THEMES as readonly string[]).includes(x);
}

/** What a theme rewords, section by section; anything it leaves out reads as the neighborhood. */
export type ThemeOverlay = { [K in keyof BairroDictionary]?: Partial<BairroDictionary[K]> };

const OVERLAYS: Record<BairroTheme, Record<Lang, ThemeOverlay>> = {
  bairro: { pt: {}, en: {} },
  esquema: { pt: esquemaPt, en: esquemaEn },
};

export function themeOverlay(theme: BairroTheme, lang: Lang): ThemeOverlay {
  return OVERLAYS[theme][lang];
}
