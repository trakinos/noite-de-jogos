import { isType } from '../cards/registry';
import type { SoundName } from '../games/shared/sound';
import type { PlayerView } from '../engine/view';
import { cardMotion } from './motion';

/** A sound to play `at` milliseconds after the view changed. */
export interface SoundCue {
  sound: SoundName;
  at: number;
}

/** Prompts that show you cards just turned face up. */
const REVEAL_PROMPTS = new Set(['sentryChoice', 'librarySetAside', 'trashRevealedTreasure']);

/** Gap between several Treasures played at once, so "play all" reads as a handful of coins. */
const COIN_GAP_MS = 70;
const MAX_COINS = 4;
/** Draws land after the discards they follow, like the card animation. */
const DRAW_AFTER_MS = 220;
const TURN_AFTER_MS = 520;

/**
 * Which sounds a change between two views of the same game deserves: cards played, discarded,
 * trashed and drawn each sound different, plus buys, curses, questions for you, your turn and the end.
 */
export function boardSounds(prev: PlayerView, next: PlayerView): SoundCue[] {
  if (prev.you !== next.you || prev.players.length !== next.players.length) return [];
  const me = next.players[next.you];

  if (next.result) {
    if (prev.result) return [];
    return [{ sound: next.result.winners.includes(me.id) ? 'win' : 'lose', at: 250 }];
  }

  const cues: SoundCue[] = [];
  const motion = cardMotion(prev, next);

  // Cards played this turn: coins for Treasures, a snap for anything else.
  if (prev.turn.player === next.turn.player) {
    const before = prev.players[prev.turn.player].inPlay.length;
    const played = next.players[next.turn.player].inPlay.slice(before);
    let coins = 0;
    played.forEach((card, i) => {
      if (isType(card, 'treasure')) {
        if (coins++ < MAX_COINS) cues.push({ sound: 'coin', at: i * COIN_GAP_MS });
      } else cues.push({ sound: 'card', at: i * COIN_GAP_MS });
    });
  }

  const discarded = motion.flights.some((f) => f.to === 'discard') || motion.deckToDiscard > 0;
  if (discarded) cues.push({ sound: 'discard', at: 0 });
  if (next.trash.length > prev.trash.length) cues.push({ sound: 'trash', at: discarded ? 120 : 0 });
  if (motion.drawn.length > 0) cues.push({ sound: 'draw', at: discarded ? DRAW_AFTER_MS : 0 });

  if (motion.bought) cues.push({ sound: 'buy', at: 0 });
  else if (next.supply.curse < prev.supply.curse) cues.push({ sound: 'wrong', at: 0 });

  // Something you must answer: an attack from another player, or a choice in your own turn.
  const fresh = next.log.slice(prev.log.length);
  if (fresh.some((e) => e.text === 'blocks the attack with')) cues.push({ sound: 'block', at: 0 });
  if (fresh.some((e) => e.text === 'reveals' || e.text === 'reveals a hand with no Victory cards')) cues.push({ sound: 'reveal', at: 0 });
  if (Object.keys(next.supply).some((id) => next.supply[id] === 0 && (prev.supply[id] ?? 0) > 0)) cues.push({ sound: 'pileout', at: 0 });

  const asked = next.prompt && (!prev.prompt || prev.prompt.id !== next.prompt.id);
  const attacked = !prev.group && next.group?.players.some((p) => p.player === next.you && !p.done);
  if (asked && next.prompt && REVEAL_PROMPTS.has(next.prompt.id)) cues.push({ sound: 'reveal', at: 0 });
  else if (asked || attacked) cues.push({ sound: next.turn.player === next.you ? 'pop' : 'alert', at: 0 });

  if (next.turn.player === next.you && prev.turn.player !== next.you) {
    cues.push({ sound: 'turn', at: cues.length > 0 ? TURN_AFTER_MS : 0 });
  }
  return cues.filter((c, i) => cues.findIndex((o) => o.sound === c.sound && o.at === c.at) === i).sort((a, b) => a.at - b.at);
}
