import { useEffect, useRef } from 'react';
import type { PlayerView } from '../engine/view';
import { playSound } from '../games/shared/sound';
import { boardSounds } from './boardSounds';

/** Plays the sound effects for whatever changed in the game since the last view. */
export function useBoardSounds(view: PlayerView): void {
  const last = useRef(view);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const prev = last.current;
    last.current = view;
    if (prev === view) return;
    for (const cue of boardSounds(prev, view)) {
      if (cue.at === 0) playSound(cue.sound);
      else {
        const id = window.setTimeout(() => {
          timers.current.delete(id);
          playSound(cue.sound);
        }, cue.at);
        timers.current.add(id);
      }
    }
  }, [view]);

  useEffect(() => () => timers.current.forEach((id) => clearTimeout(id)), []);
}
