import { isType } from '../cards/registry';
import type { CardId, LogEntry } from '../engine/types';
import type { PlayerView } from '../engine/view';

/** How a player came out of an attack. */
export type AttackOutcome = 'hit' | 'blocked';

export interface AttackRound {
  card: CardId;
  attacker: number;
  /** Where the attack card's "plays" line sits in the log, which never changes once written. */
  index: number;
  outcomes: Record<number, AttackOutcome>;
}

/** The latest attack card played, and who answered it with a Reaction or took the hit. */
export function latestAttack(view: Pick<PlayerView, 'log' | 'players'>): AttackRound | null {
  const log: LogEntry[] = view.log;
  let index = -1;
  for (let i = log.length - 1; i >= 0 && index < 0; i--) {
    const e = log[i];
    if (e.text === 'plays' && e.player !== null && e.cards?.some((c) => isType(c, 'attack'))) index = i;
  }
  if (index < 0) return null;
  const { player: attacker, cards } = log[index];
  const outcomes: Record<number, AttackOutcome> = {};
  view.players.forEach((_, i) => {
    if (i !== attacker) outcomes[i] = 'hit';
  });
  for (const e of log.slice(index + 1)) {
    if (e.text === 'blocks the attack with' && e.player !== null && e.player !== attacker) outcomes[e.player] = 'blocked';
  }
  return { card: cards!.find((c) => isType(c, 'attack'))!, attacker: attacker!, index, outcomes };
}
