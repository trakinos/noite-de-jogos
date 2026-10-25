import { useEffect, useRef } from 'react';
import { useLang } from '../../../i18n/LangProvider';
import type { BairroLogEntry } from '../types';
import { useBairroText } from './useBairroText';

/** How many of the latest entries the log shows. */
export const LOG_SHOWN = 50;

interface Props {
  entries: BairroLogEntry[];
  names: string[];
}

/** The last moves in words, newest at the bottom like Dominion's log; it scrolls to the newest. */
export function BairroLog({ entries, names }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  const ref = useRef<HTMLOListElement>(null);
  const shown = entries.slice(-LOG_SHOWN);
  const first = entries.length - shown.length;
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);
  return (
    <ol className="blog" ref={ref} aria-label={tr.t('gameLog')} aria-live="polite">
      {shown.map((entry, i) => (
        <li key={first + i}>{text.logLine(entry, names)}</li>
      ))}
    </ol>
  );
}
