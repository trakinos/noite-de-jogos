import { ARREST_MS, RELEASE_MS, JAILED_MS } from './useBairroMotion';
import type { ReleaseKind } from './motion';

const EASE = 'cubic-bezier(0.3, 0.7, 0.3, 1)';
/** How high the cop's path arcs above the straight line between the two squares. */
const ARC_PX = 60;

let layer: HTMLElement | null = null;
/** The layer above the page that board scenes play in, shared with the card motion's styles. */
export function arrestLayer(): HTMLElement {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div');
    layer.className = 'flights';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
  }
  return layer;
}

/** The square's box on screen: the map board on computers, the mini-map on phones (always in view there). */
export function squareRect(pos: number): DOMRect | null {
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
      { offset: 0, easing: EASE, transform: at(p, 'scale(0)'), opacity: 0 },
      { offset: 0.12, easing: EASE, transform: at(p, 'scale(1.25)'), opacity: 1 },
      { offset: 0.2, easing: EASE, transform: at(p, 'scale(1)') },
      { offset: 0.28, easing: EASE, transform: at(p, 'scale(1) rotate(-6deg)') },
      { offset: 0.5, easing: EASE, transform: at(mid, 'scale(1.1) rotate(4deg)') },
      { offset: 0.72, easing: EASE, transform: at(q, 'scale(1)') },
      { offset: 0.92, easing: EASE, transform: at(q, 'scale(1)'), opacity: 1 },
      { offset: 1, easing: EASE, transform: at(q, 'scale(0.8)'), opacity: 0 },
    ],
    // Ease each leg, not the whole timeline, so the cop arrives when the bars drop.
    { duration: ARREST_MS, fill: 'both' },
  );
  const end = () => group.remove();
  anim.onfinish = end;
  anim.oncancel = end;
  // A paused timeline (some hidden panes) never finishes the animation; never leave the scene on screen.
  setTimeout(end, ARREST_MS + 500);
}

const RELEASE_ICONS: Record<ReleaseKind, string> = { fine: '💸', lawyer: '📜', doubles: '🎲' };

/**
 * Leaving the Papuda: the bars lift off the square, the token hops out and what paid for it
 * (money, the lawyer card, the dice) floats up. Takes RELEASE_MS.
 */
export function playRelease(pos: number, color: string, kind: ReleaseKind, label: string): void {
  const r = squareRect(pos);
  if (!r) return;
  const c = centre(r);
  const group = document.createElement('div');
  group.className = `brelease brelease--${kind}`;
  group.style.left = `${c.x}px`;
  group.style.top = `${c.y}px`;
  group.innerHTML =
    '<span class="brelease__bars"></span>' +
    `<span class="brelease__token" style="background-color:${color}"></span>` +
    `<span class="brelease__icon">${RELEASE_ICONS[kind]}</span>` +
    (label ? `<span class="brelease__label"></span>` : '');
  const tag = group.querySelector<HTMLElement>('.brelease__label');
  if (tag) tag.textContent = label;
  arrestLayer().append(group);
  setTimeout(() => group.remove(), RELEASE_MS);
}

/** Your own arrest, across your whole screen: bars slam down with the news, then lift. Takes JAILED_MS. */
export function playJailedScreen(title: string, sub: string): void {
  const el = document.createElement('div');
  el.className = 'bjailed';
  el.innerHTML = '<span class="bjailed__bars"></span><div class="bjailed__card"><strong></strong><span></span></div>';
  el.querySelector('strong')!.textContent = title;
  el.querySelector('.bjailed__card span')!.textContent = sub;
  arrestLayer().append(el);
  setTimeout(() => el.remove(), JAILED_MS);
}
