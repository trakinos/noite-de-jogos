import { arrestLayer, squareRect } from './jailScenes';
import { MORTGAGE_MS } from './useBairroMotion';

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/** The stamp hits like a rubber stamp: fast in, a small bounce. */
const THUD = 'cubic-bezier(0.5, 0, 0.75, 0)';

/** The escritura's box: the phone strip's tile when it is in view (bigger), else the map or mini-map. */
function tileRect(pos: number): DOMRect | null {
  const strip = document.querySelector(`.bstrip [data-sq="${pos}"]`)?.getBoundingClientRect();
  if (strip && strip.width > 0 && strip.right > 0 && strip.left < innerWidth) return strip;
  return squareRect(pos);
}

/**
 * A mortgage on `pos`: a red HIPOTECADA stamp slams onto the escritura and the money floats up in green.
 * Paying it off: a green QUITADA stamp lands and lifts away, and the payment floats up in red. Takes MORTGAGE_MS.
 */
export function playMortgage(pos: number, taken: boolean, stamp: string, label: string): void {
  const r = tileRect(pos);
  if (!r) return;
  const el = document.createElement('div');
  el.className = `bmortgage bmortgage--${taken ? 'taken' : 'paid'}`;
  el.style.left = `${r.left}px`;
  el.style.top = `${r.top}px`;
  el.style.width = `${r.width}px`;
  el.style.height = `${r.height}px`;
  el.style.setProperty('--stamp-size', `${Math.max(9, Math.min(16, r.width / 6))}px`);
  el.innerHTML = '<span class="bmortgage__stamp"></span><span class="bmortgage__money"></span>';
  el.querySelector('.bmortgage__stamp')!.textContent = stamp;
  el.querySelector('.bmortgage__money')!.textContent = label;
  arrestLayer().append(el);

  const base = 'translate(-50%, -50%) rotate(-14deg)';
  const stampFrames: Keyframe[] = taken
    ? [
        { offset: 0, easing: THUD, transform: `${base} scale(2.6)`, opacity: 0 },
        { offset: 0.16, easing: EASE, transform: `${base} scale(0.92)`, opacity: 1 },
        { offset: 0.24, easing: EASE, transform: `${base} scale(1)` },
        { offset: 0.82, easing: EASE, transform: `${base} scale(1)`, opacity: 1 },
        { offset: 1, transform: `${base} scale(1)`, opacity: 0 },
      ]
    : [
        { offset: 0, easing: THUD, transform: `${base} scale(2.2)`, opacity: 0 },
        { offset: 0.16, easing: EASE, transform: `${base} scale(1)`, opacity: 1 },
        { offset: 0.5, easing: EASE, transform: `${base} scale(1)`, opacity: 1 },
        { offset: 1, transform: 'translate(-50%, -160%) rotate(8deg) scale(1.15)', opacity: 0 },
      ];
  const anims = [
    el.querySelector('.bmortgage__stamp')!.animate(stampFrames, { duration: MORTGAGE_MS, fill: 'both' }),
    el.querySelector('.bmortgage__money')!.animate(
      [
        { offset: 0, transform: 'translate(-50%, 0)', opacity: 0 },
        { offset: 0.18, easing: EASE, transform: 'translate(-50%, 0)', opacity: 0 },
        { offset: 0.3, easing: EASE, transform: 'translate(-50%, -60%)', opacity: 1 },
        { offset: 0.8, easing: EASE, transform: 'translate(-50%, -150%)', opacity: 1 },
        { offset: 1, transform: 'translate(-50%, -190%)', opacity: 0 },
      ],
      { duration: MORTGAGE_MS, fill: 'both' },
    ),
    // The tile jolts as the stamp hits.
    el.animate(
      [
        { offset: 0, transform: 'none' },
        { offset: 0.16, transform: 'none' },
        { offset: 0.19, transform: 'translateY(2px)' },
        { offset: 0.24, transform: 'none' },
        { offset: 1, transform: 'none' },
      ],
      { duration: MORTGAGE_MS, fill: 'both' },
    ),
  ];
  const end = () => el.remove();
  anims[0]!.onfinish = end;
  anims[0]!.oncancel = end;
  // A paused timeline (some hidden panes) never finishes the animation; never leave the scene on screen.
  setTimeout(end, MORTGAGE_MS + 500);
}
