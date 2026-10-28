import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { stayStill } from '../../../ui/useCardMotion';
import type { BairroView } from '../view';
import { doublesBetween, movesBetween, releasesBetween, rolledBetween, type Bonus, type DoublesKind, type Release, type TokenMove } from './motion';

/** One step of a token's walk. */
export const STEP_MS = 220;
/** The dice shake before the faces show. */
export const ROLL_MS = 800;
/** How long the doubles burst stays up after the dice land. */
export const BURST_MS = 1800;
/** How often the faces change while shaking. */
const SHAKE_TICK_MS = 100;

const positionsOf = (view: BairroView) => view.players.map(p => p.pos);

/** The cop's whole scene: grab the token, carry it to the Papuda, close the bars. */
export const ARREST_MS = 2000;
/** Leaving the Papuda: the bars lift and the token hops out. */
export const RELEASE_MS = 1400;
/** Your own arrest on your whole screen, starting as the bars drop on the Papuda. */
export const JAILED_MS = 1800;
/** When the bars drop in the arrest scene. */
export const BARS_AT_MS = ARREST_MS * 0.72;
/** When the cop has the token in hand: the token leaves its square and travels with the cop. */
export const GRAB_MS = 450;
/** Drawn nowhere: the token is in the cop's hands. */
const CARRIED = -1;

/** A Tigrinho card on screen: it rises from its square, flips over and stays long enough to read. */
export const CARD_MS = 2600;
/** Money from the board: the amount pops off the square and floats up. */
export const BONUS_MS = 1600;

export interface BoardScenes {
  /** The cop takes the token away (see ARREST_MS). */
  onArrest?: (move: TokenMove) => void;
  /** A Tigrinho card is drawn (see CARD_MS). */
  onCard?: (move: TokenMove) => void;
  /** The board pays or charges as the token reaches the square (see BONUS_MS); the walk goes on meanwhile. */
  onBonus?: (move: TokenMove, bonus: Bonus) => void;
}

/**
 * Where each seat's token is drawn: walks through `steps` after a move (after the dice have shaken),
 * and ends on the real position. A Tigrinho card holds the walk on its square for CARD_MS. An arrest calls
 * `onArrest` on the arrest square, and the token is carried (drawn nowhere) until the cop drops it in the Papuda.
 * Board money (`onBonus`) fires as the token reaches its square. Views that move nobody don't cut a walk short.
 * Reduced motion and hidden tabs show the real position at once.
 */
export function useDisplayedPositions(view: BairroView, scenes: BoardScenes = {}): number[] {
  const [shown, setShown] = useState(() => positionsOf(view));
  const prev = useRef(view);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Where the walk under way ends; null when nothing is walking. */
  const walkingTo = useRef<number[] | null>(null);
  const cb = useRef(scenes);
  cb.current = scenes;

  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = view;
    const real = positionsOf(view);
    const moves = movesBetween(before, view);
    // A view that moves nobody (ending the turn, buying) lets the walk under way finish, scenes and all.
    const same = (a: number[]) => a.length === real.length && a.every((p, i) => p === real[i]);
    if (moves.length === 0 && walkingTo.current && same(walkingTo.current) && !stayStill()) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    walkingTo.current = null;
    if (moves.length === 0 || stayStill()) {
      setShown(real);
      return;
    }
    // Start from the old squares so the walk begins where the token was.
    const start = [...real];
    for (const m of moves) start[m.player] = m.from;
    setShown(start);
    let end = 0;
    const later = (ms: number, fn: () => void) => {
      end = Math.max(end, ms);
      timers.current.push(setTimeout(fn, ms));
    };
    const at = (ms: number, player: number, pos: number) =>
      later(ms, () => setShown(cur => cur.map((p, i) => (i === player ? pos : p))));
    for (const m of moves) {
      let t = rolledBetween(before, view) ? ROLL_MS : 0;
      m.steps.forEach((pos, k) => {
        if (m.card && k === m.card.after) {
          later(t, () => cb.current.onCard?.(m));
          t += CARD_MS;
        }
        if (m.arrestAt !== undefined && k === m.steps.length - 1) {
          later(t, () => cb.current.onArrest?.(m));
          at(t + GRAB_MS, m.player, CARRIED);
          at(t + ARREST_MS, m.player, pos);
          return;
        }
        at(t, m.player, pos);
        for (const b of m.bonuses ?? []) if (b.at === k) later(t, () => cb.current.onBonus?.(m, b));
        t += STEP_MS;
      });
      if (m.card && m.card.after === m.steps.length) later(t, () => cb.current.onCard?.(m));
    }
    walkingTo.current = real;
    later(end + 1, () => {
      walkingTo.current = null;
    });
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

  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = view;
    if (before === view || !rolledBetween(before, view) || stayStill()) return;
    stop();
    setRolling(true);
    let n = 0;
    timers.current.tick = setInterval(() => setFaces([1 + ((n * 5 + 2) % 6), 1 + ((n++ * 3 + 4) % 6)]), SHAKE_TICK_MS);
    timers.current.done = setTimeout(() => {
      stop();
      setRolling(false);
    }, ROLL_MS);
  }, [view]);

  useEffect(() => stop, []);

  return rolling ? faces : view.lastRoll;
}

/**
 * The doubles burst to show: from the moment the dice land after a doubles roll, for BURST_MS.
 * Not on first render; in a hidden tab nobody sees it, and under reduced motion it shows without waiting.
 */
export function useDoublesBurst(view: BairroView): DoublesKind | null {
  const prev = useRef(view);
  const [burst, setBurst] = useState<DoublesKind | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = view;
    if (before === view) return;
    const kind = doublesBetween(before, view);
    if (!kind || document.visibilityState === 'hidden') return;
    timers.current.forEach(clearTimeout);
    setBurst(null);
    const delay = stayStill() ? 0 : ROLL_MS;
    timers.current = [
      setTimeout(() => setBurst(kind), delay),
      setTimeout(() => setBurst(null), delay + BURST_MS),
    ];
  }, [view]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return burst;
}

/**
 * Calls `onRelease` for each player who left the Papuda in a new view: at once for the fine or a lawyer card,
 * after the dice for doubles and the forced fine. Not on first render, under reduced motion or in a hidden tab.
 */
export function useReleases(view: BairroView, onRelease: (release: Release) => void): void {
  const prev = useRef(view);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cb = useRef(onRelease);
  cb.current = onRelease;

  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = view;
    if (before === view || stayStill()) return;
    for (const r of releasesBetween(before, view)) {
      timers.current.push(setTimeout(() => cb.current(r), r.rolled ? ROLL_MS : 0));
    }
  }, [view]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
}
