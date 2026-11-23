import type { ReactNode } from 'react';

/** Words for throwing cards away, in both languages: discarding and trashing each get their own emphasis. */
const KEYWORDS =
  /(?<![\p{L}])(discard(?:s|ed|ing)?|descart(?:e|a|am|ar|ando|adas?)|trash(?:es|ed|ing)?|no lixo)(?![\p{L}])/giu;

/** Rule text with the discard and trash words set in bold, colored by kind. */
export function emphasize(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(KEYWORDS)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const kind = /^(trash|no lixo)/i.test(m[0]) ? 'trash' : 'discard';
    out.push(
      <em key={at} className={`kw kw--${kind}`}>
        {m[0]}
      </em>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
