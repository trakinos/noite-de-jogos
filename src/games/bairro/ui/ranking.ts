import type { BairroView } from '../view';

/**
 * Seats in finishing order: the winner first, then the bankrupt players, the last to go broke ahead of the first.
 * With no winner (the game was cut short), the players still in come first, in seat order.
 */
export function ranking(view: BairroView): number[] {
  const out = view.players.flatMap((p, i) => (i === view.winner ? [i] : []));
  if (view.winner === null) view.players.forEach((p, i) => { if (!p.bankrupt) out.push(i); });
  for (const i of [...view.bankruptOrder].reverse()) if (!out.includes(i)) out.push(i);
  return out;
}
