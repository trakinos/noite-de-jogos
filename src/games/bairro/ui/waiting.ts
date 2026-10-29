import type { Lang } from '../../../i18n/types';
import type { BairroView } from '../view';

export interface WaitingMessage {
  /** A key of the bairro `ui` strings. */
  key: string;
  params: Record<string, string | number>;
}

/** "Ana e Bia" / "Ana, Bia e Caio" in pt; "Ana and Bia" / "Ana, Bia and Caio" in en. */
export function joinNames(lang: Lang, names: string[]): string {
  const and = lang === 'pt' ? 'e' : 'and';
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} ${and} ${names.at(-1)}`;
}

/** Why you can't act right now; null when you can. */
export function waitingFor(view: BairroView, names: string[], lang: Lang): WaitingMessage | null {
  if (view.pending !== 'wait') return null;
  if (view.winner !== null) return { key: 'gameOver', params: {} };
  if (view.auction) return { key: 'waitAuction', params: {} };
  if (view.offer) return { key: 'waitTrade', params: { name: names[view.offer.to] ?? '' } };
  if (view.debts.length > 0) {
    const debtors = [...new Set(view.debts.map(d => d.debtor))].sort((a, b) => a - b);
    return { key: 'waitDebts', params: { names: joinNames(lang, debtors.map(d => names[d] ?? '')) } };
  }
  return { key: 'waitPlaying', params: { name: names[view.current] ?? '' } };
}
