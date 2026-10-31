import { arrestLayer, squareRect } from './jailScenes';
import type { BonusKind } from './motion';
import { BONUS_MS } from './useBairroMotion';

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const ICONS: Record<BonusKind, string> = { start: '🧦', iptu: '🧾', bolao: '🎟️', pracinha: '👑', home: '🏠', bicho: '🦁' };
/** Coins around the amount: they burst out for money in, and get sucked into the square for the IPTU. */
const COINS = 5;

/**
 * Money from the board on `pos`: the square's icon and the amount (`label`) pop off the square and float up,
 * green for money in, red for the IPTU, with coins flying out or in. Takes BONUS_MS.
 */
export function playBonus(pos: number, kind: BonusKind, gain: boolean, label: string): void {
  const sq = squareRect(pos);
  if (!sq) return;
  const el = document.createElement('div');
  el.className = `bbonus bbonus--${gain ? 'in' : 'out'}`;
  el.style.left = `${sq.left + sq.width / 2}px`;
  el.style.top = `${sq.top + sq.height / 2}px`;
  el.innerHTML = '<span class="bbonus__chip"><span class="bbonus__icon"></span><b class="bbonus__amount"></b></span>';
  el.querySelector('.bbonus__icon')!.textContent = ICONS[kind];
  el.querySelector('.bbonus__amount')!.textContent = label;
  for (let i = 0; i < COINS; i++) {
    const coin = document.createElement('span');
    coin.className = 'bbonus__coin';
    coin.textContent = '🪙';
    el.append(coin);
  }
  arrestLayer().append(el);

  const anims = [
    el.querySelector('.bbonus__chip')!.animate(
      [
        { offset: 0, easing: EASE, transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0 },
        { offset: 0.15, easing: EASE, transform: 'translate(-50%, -110%) scale(1.15)', opacity: 1 },
        { offset: 0.25, easing: EASE, transform: 'translate(-50%, -120%) scale(1)' },
        { offset: 0.8, easing: EASE, transform: 'translate(-50%, -190%) scale(1)', opacity: 1 },
        { offset: 1, easing: EASE, transform: 'translate(-50%, -230%) scale(0.95)', opacity: 0 },
      ],
      { duration: BONUS_MS, fill: 'both' },
    ),
    ...[...el.querySelectorAll<HTMLElement>('.bbonus__coin')].map((coin, i) => {
      // Spread the coins on an upward fan; for the IPTU they start out there and fall into the square.
      const angle = (-170 + (160 / (COINS - 1)) * i) * (Math.PI / 180);
      const far = `translate(calc(-50% + ${Math.cos(angle) * 62}px), calc(-50% + ${Math.sin(angle) * 40}px))`;
      const near = 'translate(-50%, -50%)';
      return coin.animate(
        [
          { offset: 0, easing: EASE, transform: `${gain ? near : far} scale(0.5)`, opacity: 0 },
          { offset: 0.1, easing: EASE, opacity: 1 },
          { offset: 0.55, easing: EASE, transform: `${gain ? far : near} scale(1)`, opacity: 1 },
          { offset: 0.75, easing: EASE, transform: `${gain ? far : near} scale(${gain ? 1 : 0.4})`, opacity: 0 },
          { offset: 1, transform: `${gain ? far : near} scale(0.4)`, opacity: 0 },
        ],
        { duration: BONUS_MS, delay: i * 40, fill: 'both' },
      );
    }),
  ];
  const end = () => el.remove();
  anims[0]!.onfinish = end;
  anims[0]!.oncancel = end;
  // A paused timeline (some hidden panes) never finishes the animation; never leave the scene on screen.
  setTimeout(end, BONUS_MS + 500);
}
