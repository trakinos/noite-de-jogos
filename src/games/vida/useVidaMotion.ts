import { useEffect, useRef, useState } from 'react';
import { playSound } from '../shared/sound';
import type { VidaLog, VidaView } from './game';
import { animBetween, COIN_MS, EVENT_MS, quickAnim, reducedMotion, STEP_MS, WHEEL_MS, type VidaAnim } from './motion';

export interface VidaMotion {
  /** Each player's square as drawn right now. */
  positions: number[];
  /** The wheel while it spins and settles, with the number it lands on. */
  wheel: { n: number; key: number } | null;
  coins: { pos: number; amount: number; key: number }[];
  /** The card for what just happened, after the walk. */
  event: { entry: VidaLog; key: number } | null;
  /** True while anything is still playing: choices wait for it. */
  busy: boolean;
  /** The view whose results may be shown: the one from before the move while it plays, so cash, square and log don't give the spin away. */
  shown: VidaView;
}

let keys = 0;

/** Plays each change as the wheel spinning, the token walking square by square (paydays popping coins), then a card for the event. */
export function useVidaMotion(view: VidaView): VidaMotion {
  const [positions, setPositions] = useState(() => view.players.map(p => p.pos));
  const [wheel, setWheel] = useState<VidaMotion['wheel']>(null);
  const [coins, setCoins] = useState<VidaMotion['coins']>([]);
  const [event, setEvent] = useState<VidaMotion['event']>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(view);
  const prev = useRef(view);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const before = prev.current;
    prev.current = view;
    if (before === view) return;
    // Anything still playing jumps to its end; then the new change plays.
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const found: VidaAnim | null = before.players.length === view.players.length ? animBetween(before, view) : null;
    // Reduced motion: no wheel and no walk, the token jumps; the card for what happened still shows (it's information).
    const quick = reducedMotion();
    const anim = found && quick ? quickAnim(found) : found;
    const settle = () => {
      setShown(view);
      setPositions(view.players.map(p => p.pos));
      setBusy(false);
    };
    if (!anim) {
      setWheel(null);
      setEvent(null);
      settle();
      return;
    }
    setBusy(true);
    setPositions(before.players.map(p => p.pos));
    let t = 0;
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    if (anim.spin !== null && !quick) {
      setWheel({ n: anim.spin, key: ++keys });
      playSound('spin');
      t += WHEEL_MS;
    }
    anim.steps.forEach((pos, i) => {
      at(t + i * STEP_MS, () => {
        if (i === 0) setWheel(null);
        setPositions(ps => ps.map((p, seat) => (seat === anim.seat ? pos : p)));
        playSound('move');
        for (const pay of anim.paydays.filter(x => x.at === i)) {
          const key = ++keys;
          setCoins(cs => [...cs, { pos: pay.pos, amount: pay.amount, key }]);
          playSound('coin');
          // Already inside a step: the removal is relative to now.
          timers.current.push(setTimeout(() => setCoins(cs => cs.filter(c => c.key !== key)), COIN_MS));
        }
      });
    });
    t += anim.steps.length * STEP_MS;
    if (anim.steps.length === 0 && anim.spin !== null && !quick) at(t, () => setWheel(null));
    at(t, () => setPositions(view.players.map(p => p.pos)));
    const main = anim.events.find(e => e.k !== 'loan') ?? anim.events[0];
    if (main) {
      at(t, () => {
        setEvent({ entry: main, key: ++keys });
        const gain = ((main.k === 'cash' || main.k === 'invest') && main.n > 0) || main.k === 'raise' || main.k === 'life' || main.k === 'marry' || main.k === 'baby' || main.k === 'dodge';
        playSound(main.k === 'life' ? 'pop' : gain ? 'coin' : main.k === 'loan' || main.k === 'tax' || main.k === 'cash' ? 'wrong' : 'card');
      });
      t += EVENT_MS;
      at(t, () => setEvent(null));
    }
    at(t, settle);
  }, [view]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return { positions, wheel, coins, event, busy, shown };
}
