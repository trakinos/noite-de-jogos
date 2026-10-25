import { useMemo } from 'react';
import { useLang } from '../../../i18n/LangProvider';
import { bairroText } from './text';
import type { BairroText } from './text';

export function useBairroText(): BairroText {
  const { tr } = useLang();
  return useMemo(() => bairroText(tr.lang), [tr.lang]);
}
