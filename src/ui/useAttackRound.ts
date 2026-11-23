import { useRef } from 'react';
import type { PlayerView } from '../engine/view';
import { latestAttack, type AttackRound } from './attacks';

/** The attack to show badges for: the one played in the current turn, gone once the turn passes on. */
export function useAttackRound(view: PlayerView): AttackRound | null {
  const turn = useRef(view.turn.player);
  // Log lines before this point belong to turns that are over.
  const clearedAt = useRef(0);
  if (turn.current !== view.turn.player) {
    turn.current = view.turn.player;
    clearedAt.current = view.log.length;
  }
  const round = latestAttack(view);
  return round && round.index >= clearedAt.current && round.attacker === view.turn.player ? round : null;
}
