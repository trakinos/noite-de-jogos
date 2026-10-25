import { useEffect, useRef } from 'react';
import { useLang } from '../../../i18n/LangProvider';
import type { BairroLogEntry } from '../types';
import { useBairroText } from './useBairroText';

/** How many of the latest entries the log shows. */
export const LOG_SHOWN = 50;

interface Props {
  entries: BairroLogEntry[];
  /** `view.logTotal`: every entry ever logged, which keeps counting once the wire caps `entries`. */
  total: number;
  names: string[];
}

/** The latest rows with their absolute log index, a stable key even when the wire log is capped. */
export function logRows(entries: BairroLogEntry[], total: number, limit = LOG_SHOWN): { index: number; entry: BairroLogEntry }[] {
  const shown = entries.slice(-limit);
  const first = total - shown.length;
  return shown.map((entry, i) => ({ index: first + i, entry }));
}

/** The last moves in words, newest at the bottom like Dominion's log; it scrolls to the newest. */
export function BairroLog({ entries, total, names }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  const ref = useRef<HTMLOListElement>(null);
  const rows = logRows(entries, total);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [total]);
  return (
    <ol className="blog" ref={ref} aria-label={tr.t('gameLog')} aria-live="polite">
      {rows.map(({ index, entry }) => (
        <li key={index}>{text.logLine(entry, names)}</li>
      ))}
    </ol>
  );
}
