import { createContext, useContext, useMemo } from 'react';
import { useLang } from '../../../i18n/LangProvider';
import type { BairroTheme } from '../i18n/themes';
import { bairroText } from './text';
import type { BairroText } from './text';

/** The room's theme, set by the Bairro screens from the lobby's options; the neighborhood when unset. */
export const BairroThemeContext = createContext<BairroTheme>('bairro');

export function useBairroTheme(): BairroTheme {
  return useContext(BairroThemeContext);
}

export function useBairroText(): BairroText {
  const { tr } = useLang();
  const theme = useBairroTheme();
  return useMemo(() => bairroText(tr.lang, theme), [tr.lang, theme]);
}
