import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { stayStill } from '../../../ui/useCardMotion';
import type { BairroView } from '../view';
import { movesBetween, rolledBetween } from './motion';

/** One step of a token's walk. */
export const STEP_MS = 120;
/** The dice shake before the faces show. */
export const ROLL_MS = 500;
/** How often the faces change while shaking. */
const SHAKE_TICK_MS = 80;

const positionsOf = (view: BairroView) => view.players.map(p => p.pos);

/**
 * Where each seat's token is drawn: walks through `steps` after a move (after the dice have shaken),
 * and ends on the real position. Jumps, reduced motion and hidden tabs show the real position at once.
 */
export function useDisplayedPositions(view: BairroView): number[] {
  const [shown, setShown] = useState(() => positionsOf(view));
  const prev = useRef(view);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = view;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const real = positionsOf(view);
    const moves = movesBetween(before, view);
    if (moves.length === 0 || stayStill()) {
      setShown(real);
      return;
    }
    // Start from the old squares so the walk begins where the token was.
    const start = [...real];
    for (const m of moves) start[m.player] = m.from;
    setShown(start);
    const delay = rolledBetween(before, view) ? ROLL_MS : 0;
    const longest = Math.max(...moves.map(m => m.steps.length));
    for (let k = 0; k < longest; k++) {
      const frame = [...real];
      for (const m of moves) frame[m.player] = m.steps[Math.min(k, m.steps.length - 1)];
      timers.current.push(setTimeout(() => setShown(frame), delay + k * STEP_MS));
    }
  }, [view]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return shown;
}

/**
 * The faces to show for `view.lastRoll`: random faces for ROLL_MS after a new roll, then the real ones.
 * Not on first render, not on a view that rolled nothing new, not under reduced motion or in a hidden tab.
 */
export function useDiceFaces(view: BairroView): [number, number] | null {
  const prev = useRef(view);
  const [rolling, setRolling] = useState(false);
  const [faces, setFaces] = useState<[number, number]>([1, 1]);
  const timers = useRef<{ tick?: ReturnType<typeof setInterval>; done?: ReturnType<typeof setTimeout> }>({});
  const stop = () => {
    clearInterval(timers.current.tick);
    clearTimeout(timers.current.done);
  };

  useEffect(() => {
    const before = prev.current;
    prev.current = view;
    if (before === view || !rolledBetween(before, view) || stayStill()) return;
    stop();
    setRolling(true);
    const face = () => 1 + Math.floor(Math.random() * 6);
    timers.current.tick = setInterval(() => setFaces([face(), face()]), SHAKE_TICK_MS);
    timers.current.done = setTimeout(() => {
      stop();
      setRolling(false);
    }, ROLL_MS);
  }, [view]);

  useEffect(() => stop, []);

  return rolling ? faces : view.lastRoll;
}
