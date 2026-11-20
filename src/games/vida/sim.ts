import { createRng, nextInt } from '../../engine/rng';
import type { SeatInfo } from '../module';
import { applyVida, createVida, defaultIntent, type VidaIntent, type VidaState } from './game';

export interface SimResult {
  /** Spins each player made before retiring. */
  spins: number[];
  totalSpins: number;
  /** Choices answered (path, career, house, lawsuit…), over all players. */
  decisions: number;
}

/** A player who answers every choice at random: enough to measure how long a game runs. */
function randomIntent(s: VidaState, pick: (n: number) => number): VidaIntent {
  const prompt = s.prompt;
  if (!prompt) return { type: 'spin' };
  switch (prompt.kind) {
    case 'path':
      return { type: 'path', college: pick(2) === 0 };
    case 'career':
      return { type: 'career', career: prompt.options[pick(prompt.options.length)]! };
    case 'house': {
      const i = pick(prompt.options.length + 1);
      return { type: 'house', house: prompt.options[i] ?? null };
    }
    case 'marry':
      return { type: 'marry', pick: (['party', 'civil', 'honeymoon'] as const)[pick(3)]! };
    case 'retire': {
      const places = (['country', 'beach', 'business', 'mansion', 'world'] as const).filter(w => w !== 'world' || !s.players.some(o => o.retired === 'world'));
      return { type: 'retire', where: places[pick(places.length)]! };
    }
    default:
      return defaultIntent(s);
  }
}

/** Plays one whole game with random choices and counts its turns. */
export function simulate(players: number, seed: number, options?: Parameters<typeof createVida>[2]): SimResult {
  const seats: SeatInfo[] = Array.from({ length: players }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  const s = createVida(seats, seed, options);
  const rng = createRng(seed ^ 0x5bd1e995);
  const pick = (n: number) => nextInt(rng, n);
  const spins = seats.map(() => 0);
  let decisions = 0;
  for (let guard = 0; guard < 20000 && s.winner === null; guard++) {
    const seat = s.current;
    const intent = randomIntent(s, pick);
    const r = applyVida(s, seat, intent);
    if (!r.ok) throw new Error(`Simulated move refused: ${r.reason}`);
    if (intent.type === 'spin') spins[seat]!++;
    else decisions++;
  }
  if (s.winner === null) throw new Error('Simulated game did not end');
  return { spins, totalSpins: spins.reduce((a, b) => a + b, 0), decisions };
}

/** Average spins per player and per game over `games` seeds. */
export function measure(players: number, games: number, options?: Parameters<typeof createVida>[2]): { perPlayer: number; total: number; min: number; max: number; decisions: number } {
  let total = 0;
  let decisions = 0;
  let min = Infinity;
  let max = 0;
  for (let seed = 1; seed <= games; seed++) {
    const r = simulate(players, seed, options);
    total += r.totalSpins;
    decisions += r.decisions;
    for (const n of r.spins) {
      min = Math.min(min, n);
      max = Math.max(max, n);
    }
  }
  return { perPlayer: total / games / players, total: total / games, min, max, decisions: decisions / games };
}
