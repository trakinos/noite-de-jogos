import { useEffect } from 'react';
import type { LocalClock } from '../net/guest';
import { playSound } from '../games/shared/sound';
import { LOW_TIME_S, secondsLeft } from './clock';

/** Ticks once a second over the last seconds of a clock that is waiting on you. */
export function useTimerTick(clock: LocalClock | null, mine: boolean): void {
  useEffect(() => {
    if (!clock || !mine) return;
    let last = secondsLeft(clock, Date.now());
    const id = window.setInterval(() => {
      const secs = secondsLeft(clock, Date.now());
      if (secs !== last && secs > 0 && secs <= LOW_TIME_S) playSound('tick');
      last = secs;
    }, 200);
    return () => clearInterval(id);
  }, [clock, mine]);
}
