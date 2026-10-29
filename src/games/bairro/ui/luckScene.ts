import { arrestLayer, squareRect } from './jailScenes';
import { CARD_MS } from './useBairroMotion';

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/** The card's moments, in ms from the start: it reaches the middle, settles, flips over, and starts to fade. */
const ARRIVE_MS = 570;
const SETTLE_MS = 700;
const FLIP_FROM_MS = 620;
const FLIP_TO_MS = 940;
const FADE_MS = 310;

export interface LuckCardText {
  /** "Deu bom!" or "Deu ruim!". */
  title: string;
  /** Who drew it. */
  who: string;
  /** The card itself. */
  body: string;
}

/**
 * A Tigrinho card for everyone to read: it rises face down from its square, flies to the middle of the screen,
 * flips to a green (bom) or red (ruim) face, holds, and fades. Takes CARD_MS.
 */
export function playLuckCard(pos: number, tone: 'bom' | 'ruim', text: LuckCardText): void {
  const from = squareRect(pos);
  if (!from) return;
  const el = document.createElement('div');
  el.className = `bluck bluck--${tone}`;
  el.innerHTML =
    '<div class="bluck__inner">' +
    '<div class="bluck__back"><span>🐯</span></div>' +
    '<div class="bluck__face"><strong class="bluck__title"></strong><span class="bluck__who"></span><p class="bluck__body"></p></div>' +
    '</div>';
  el.querySelector('.bluck__title')!.textContent = text.title;
  el.querySelector('.bluck__who')!.textContent = text.who;
  el.querySelector('.bluck__body')!.textContent = text.body;
  arrestLayer().append(el);

  // The card sits centred on screen; it starts shrunk onto its square.
  const box = el.getBoundingClientRect();
  const dx = from.left + from.width / 2 - (box.left + box.width / 2);
  const dy = from.top + from.height / 2 - (box.top + box.height / 2);
  const small = Math.max(0.15, from.width / box.width);
  // Offsets from the moments above, so a longer CARD_MS only means more time to read.
  const at = (ms: number) => ms / CARD_MS;
  const anim = el.animate(
    [
      { offset: 0, easing: EASE, transform: `translate(${dx}px, ${dy}px) scale(${small})`, opacity: 0 },
      { offset: at(150), easing: EASE, transform: `translate(${dx}px, ${dy - 20}px) scale(${small * 1.3})`, opacity: 1 },
      { offset: at(ARRIVE_MS), easing: EASE, transform: 'translate(0, 0) scale(1.05)' },
      { offset: at(SETTLE_MS), easing: EASE, transform: 'translate(0, 0) scale(1)' },
      { offset: at(CARD_MS - FADE_MS), easing: EASE, transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { offset: 1, easing: EASE, transform: 'translate(0, -16px) scale(0.92)', opacity: 0 },
    ],
    // Ease each leg, not the whole timeline, so the card holds as long as the offsets say.
    { duration: CARD_MS, fill: 'both' },
  );
  el.querySelector('.bluck__inner')!.animate(
    [
      { offset: 0, transform: 'rotateY(0)' },
      { offset: at(FLIP_FROM_MS), easing: 'ease-in-out', transform: 'rotateY(0)' },
      { offset: at(FLIP_TO_MS), transform: 'rotateY(180deg)' },
      { offset: 1, transform: 'rotateY(180deg)' },
    ],
    { duration: CARD_MS, fill: 'both' },
  );
  const end = () => el.remove();
  anim.onfinish = end;
  anim.oncancel = end;
  // A paused timeline (some hidden panes) never finishes the animation; never leave the scene on screen.
  setTimeout(end, CARD_MS + 500);
}
