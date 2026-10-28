import { ARREST_MS } from './useBairroMotion';

const EASE = 'cubic-bezier(0.3, 0.7, 0.3, 1)';
/** How high the cop's path arcs above the straight line between the two squares. */
const ARC_PX = 60;

let layer: HTMLElement | null = null;
function arrestLayer(): HTMLElement {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div');
    layer.className = 'flights';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
  }
  return layer;
}

/** The square's box on screen: the map board on computers, the mini-map on phones (always in view there). */
function squareRect(pos: number): DOMRect | null {
  for (const scope of ['.bmap', '.bmini']) {
    const rect = document.querySelector(`${scope} [data-sq="${pos}"]`)?.getBoundingClientRect();
    if (rect && rect.width > 0) return rect;
  }
  return null;
}

const centre = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/**
 * The arrest scene above the page: a cop pops up on `from` with a siren, grabs the token (`color`),
 * carries it along an arc to `to` (the Papuda) and the bars drop. Takes ARREST_MS.
 */
export function playArrest(from: number, to: number, color: string): void {
  const a = squareRect(from);
  const b = squareRect(to);
  if (!a || !b) return;
  const p = centre(a);
  const q = centre(b);
  const mid = { x: (p.x + q.x) / 2, y: Math.min(p.y, q.y) - ARC_PX };

  const group = document.createElement('div');
  group.className = 'barrest';
  group.style.left = `${p.x}px`;
  group.style.top = `${p.y}px`;
  group.innerHTML =
    '<span class="barrest__siren">🚨</span><span class="barrest__cop">👮</span>' +
    `<span class="barrest__token" style="background-color:${color}"></span><span class="barrest__bars"></span>`;
  arrestLayer().append(group);

  const at = (pt: { x: number; y: number }, extra = '') => `translate(${pt.x - p.x}px, ${pt.y - p.y}px) ${extra}`;
  const anim = group.animate(
    [
      { offset: 0, transform: at(p, 'scale(0)'), opacity: 0 },
      { offset: 0.12, transform: at(p, 'scale(1.25)'), opacity: 1 },
      { offset: 0.2, transform: at(p, 'scale(1)') },
      { offset: 0.28, transform: at(p, 'scale(1) rotate(-6deg)') },
      { offset: 0.5, transform: at(mid, 'scale(1.1) rotate(4deg)') },
      { offset: 0.72, transform: at(q, 'scale(1)') },
      { offset: 0.92, transform: at(q, 'scale(1)'), opacity: 1 },
      { offset: 1, transform: at(q, 'scale(0.8)'), opacity: 0 },
    ],
    { duration: ARREST_MS, easing: EASE, fill: 'both' },
  );
  const end = () => group.remove();
  anim.onfinish = end;
  anim.oncancel = end;
}
