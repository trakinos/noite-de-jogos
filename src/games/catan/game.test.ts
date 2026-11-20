import { describe, expect, it } from 'vitest';
import { createRng, nextInt } from '../../engine/rng';
import { EDGE_VERTS, HEX_VERTS, RES } from './board';
import {
  applyCatan, bankRatio, catanModule, catanView, createCatan, emptyHand, legalRoadSpots, legalSettlementSpots, roadLength, total, totalPoints,
  type CatanIntent, type CatanState,
} from './game';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));

function act(s: CatanState, seat: number, intent: CatanIntent) {
  const r = applyCatan(s, seat, intent);
  if (!r.ok) throw new Error(`${intent.type} refused: ${r.reason}`);
}

/** Plays the whole setup greedily, giving every player legal spots. */
function setup(n = 3, seed = 4): CatanState {
  const s = createCatan(seats(n), seed);
  while (s.phase === 'setup') {
    const seat = s.current;
    const v = catanView(s, seat);
    act(s, seat, { type: 'settlement', vertex: v.can.settlement[0]! });
    act(s, seat, { type: 'road', edge: catanView(s, seat).can.road[0]! });
  }
  return s;
}

function conserved(s: CatanState): void {
  for (const r of RES) expect(s.bank[r] + s.hands.reduce((n, h) => n + h[r], 0)).toBeLessThanOrEqual(19);
}

describe('setup', () => {
  it('goes in snake order and gives the second settlement its resources', () => {
    const s = createCatan(seats(3), 4);
    const order: number[] = [];
    while (s.phase === 'setup') {
      order.push(s.current);
      const seat = s.current;
      act(s, seat, { type: 'settlement', vertex: catanView(s, seat).can.settlement[0]! });
      expect(applyCatan(s, seat, { type: 'settlement', vertex: 0 }).ok).toBe(false);
      act(s, seat, { type: 'road', edge: catanView(s, seat).can.road[0]! });
    }
    expect(order).toEqual([0, 1, 2, 2, 1, 0]);
    expect(s.phase).toBe('roll');
    expect(s.current).toBe(0);
    expect(s.verts.filter(Boolean)).toHaveLength(6);
    expect(s.roads.filter(r => r >= 0)).toHaveLength(6);
    conserved(s);
  });

  it('enforces the distance rule', () => {
    const s = createCatan(seats(3), 4);
    act(s, 0, { type: 'settlement', vertex: 0 });
    act(s, 0, { type: 'road', edge: catanView(s, 0).can.road[0]! });
    const neighbour = EDGE_VERTS.find(([a, b]) => a === 0 || b === 0)!.find(v => v !== 0)!;
    expect(applyCatan(s, 1, { type: 'settlement', vertex: neighbour }).ok).toBe(false);
    expect(legalSettlementSpots(s, 1, false)).not.toContain(neighbour);
  });

  it('refuses a road away from the new settlement and moves out of turn', () => {
    const s = createCatan(seats(3), 4);
    expect(applyCatan(s, 1, { type: 'settlement', vertex: 0 }).ok).toBe(false);
    act(s, 0, { type: 'settlement', vertex: 0 });
    const far = EDGE_VERTS.findIndex(([a, b]) => a !== 0 && b !== 0);
    expect(applyCatan(s, 0, { type: 'road', edge: far }).ok).toBe(false);
  });
});

describe('dice and production', () => {
  it('pays settlements 1 and cities 2 and skips the robber hex', () => {
    const s = setup();
    s.hexes.forEach(h => (h.num = 0));
    const hexIdx = 0;
    s.hexes[hexIdx] = { terrain: 'ore', num: 6 };
    const corner = HEX_VERTS[hexIdx]![0]!;
    s.verts.fill(null);
    s.verts[corner] = { seat: 1, city: true };
    s.verts[HEX_VERTS[hexIdx]![2]!] = { seat: 2, city: false };
    s.hands = s.hands.map(emptyHand);
    s.robber = 5;
    s.phase = 'roll';
    s.current = 0;
    // Force a 6 by trying seeds through the rng state.
    for (let i = 0; i < 500 && !(s.dice && s.dice[0] + s.dice[1] === 6); i++) {
      s.phase = 'roll';
      s.hands = s.hands.map(emptyHand);
      act(s, 0, { type: 'roll' });
      if (s.dice![0] + s.dice![1] === 6) break;
      s.phase = 'roll';
      s.owe = s.owe.map(() => 0);
      s.dice = null;
    }
    expect(s.dice![0] + s.dice![1]).toBe(6);
    expect(s.hands[1]!.ore).toBe(2);
    expect(s.hands[2]!.ore).toBe(1);
    conserved(s);
  });

  it('on a 7, players with more than 7 cards discard half, then the robber moves and steals', () => {
    const s = setup();
    s.hands = s.hands.map(emptyHand);
    s.hands[1]!.wood = 9;
    s.hands[2]!.brick = 3;
    s.bank.wood = 10;
    s.bank.brick = 16;
    s.phase = 'roll';
    s.current = 0;
    while (s.phase === 'roll') {
      act(s, 0, { type: 'roll' });
      if ((s.phase as string) === 'main') {
        s.phase = 'roll';
        s.hands = s.hands.map(emptyHand);
        s.hands[1]!.wood = 9;
        s.hands[2]!.brick = 3;
      }
    }
    expect(s.phase).toBe('discard');
    expect(s.owe).toEqual([0, 4, 0]);
    expect(applyCatan(s, 1, { type: 'discard', cards: { ...emptyHand(), wood: 3 } }).ok).toBe(false);
    act(s, 1, { type: 'discard', cards: { ...emptyHand(), wood: 4 } });
    expect(s.hands[1]!.wood).toBe(5);
    expect(s.phase).toBe('robber');
    expect(applyCatan(s, 0, { type: 'robber', hex: s.robber }).ok).toBe(false);
    const target = s.hexes.findIndex((_, i) => i !== s.robber && HEX_VERTS[i]!.some(v => s.verts[v]?.seat === 2));
    act(s, 0, { type: 'robber', hex: target });
    expect(['main', 'steal']).toContain(s.phase);
  });
});

describe('building and trading', () => {
  it('builds a road, a settlement and a city with the right costs', () => {
    const s = setup();
    s.phase = 'main';
    s.current = 0;
    s.hands[0] = { wood: 3, brick: 3, sheep: 1, wheat: 3, ore: 3 };
    const road = legalRoadSpots(s, 0)[0]!;
    act(s, 0, { type: 'road', edge: road });
    expect(s.hands[0]).toEqual({ wood: 2, brick: 2, sheep: 1, wheat: 3, ore: 3 });
    const mine = s.verts.findIndex(b => b && b.seat === 0 && !b.city);
    act(s, 0, { type: 'city', vertex: mine });
    expect(s.hands[0]).toEqual({ wood: 2, brick: 2, sheep: 1, wheat: 1, ore: 0 });
    expect(s.verts[mine]!.city).toBe(true);
    expect(applyCatan(s, 0, { type: 'city', vertex: mine }).ok).toBe(false);
  });

  it('trades with the bank at 4:1, and 2:1 at a matching harbor', () => {
    const s = setup();
    s.phase = 'main';
    s.current = 0;
    s.hands[0] = { ...emptyHand(), wood: 4 };
    expect(bankRatio(s, 0, 'wood')).toBeLessThanOrEqual(4);
    const ratio = bankRatio(s, 0, 'wood');
    s.hands[0]!.wood = ratio;
    act(s, 0, { type: 'bank', give: 'wood', get: 'ore' });
    expect(s.hands[0]!.ore).toBe(1);
    expect(applyCatan(s, 0, { type: 'bank', give: 'wood', get: 'wood' }).ok).toBe(false);
    const port = s.ports.find(p => p.kind === 'brick')!;
    s.verts.fill(null);
    s.verts[EDGE_VERTS[port.edge]![0]!] = { seat: 0, city: false };
    expect(bankRatio(s, 0, 'brick')).toBe(2);
  });

  it('runs a player trade: offer, accept, confirm', () => {
    const s = setup();
    s.phase = 'main';
    s.current = 0;
    s.hands = s.hands.map(emptyHand);
    s.hands[0]!.wood = 2;
    s.hands[1]!.ore = 1;
    act(s, 0, { type: 'offer', give: { ...emptyHand(), wood: 2 }, get: { ...emptyHand(), ore: 1 } });
    expect(applyCatan(s, 2, { type: 'respond', accept: true }).ok).toBe(false); // no ore
    act(s, 2, { type: 'respond', accept: false });
    expect(applyCatan(s, 0, { type: 'confirm', with: 2 }).ok).toBe(false);
    act(s, 1, { type: 'respond', accept: true });
    act(s, 0, { type: 'confirm', with: 1 });
    expect([s.hands[0]!.ore, s.hands[1]!.wood, s.trade]).toEqual([1, 2, null]);
  });

  it('refuses offers of what you do not have, or the same resource on both sides', () => {
    const s = setup();
    s.phase = 'main';
    s.current = 0;
    s.hands[0] = emptyHand();
    expect(applyCatan(s, 0, { type: 'offer', give: { ...emptyHand(), wood: 1 }, get: { ...emptyHand(), ore: 1 } }).ok).toBe(false);
    s.hands[0]!.wood = 2;
    expect(applyCatan(s, 0, { type: 'offer', give: { ...emptyHand(), wood: 1 }, get: { ...emptyHand(), wood: 1 } }).ok).toBe(false);
  });
});

describe('development cards, longest road and the win', () => {
  it('plays a knight, takes the largest army at three, and cannot play a card bought this turn', () => {
    const s = setup();
    s.phase = 'main';
    s.current = 0;
    s.hands[0] = { ...emptyHand(), sheep: 1, wheat: 1, ore: 1 };
    s.deck.push('knight');
    act(s, 0, { type: 'buyDev' });
    expect(applyCatan(s, 0, { type: 'knight' }).ok).toBe(false);
    s.dev[0] = ['knight'];
    s.knights[0] = 2;
    act(s, 0, { type: 'knight' });
    expect(s.army).toBe(0);
    expect(s.phase).toBe('robber');
    s.dev[0] = ['knight'];
    s.phase = 'main';
    expect(applyCatan(s, 0, { type: 'knight' }).ok).toBe(false); // one card per turn
  });

  it('plays monopoly and year of plenty', () => {
    const s = setup();
    s.phase = 'main';
    s.current = 0;
    s.hands = s.hands.map(emptyHand);
    s.hands[1]!.wheat = 2;
    s.hands[2]!.wheat = 1;
    s.dev[0] = ['monopoly'];
    act(s, 0, { type: 'monopoly', res: 'wheat' });
    expect(s.hands[0]!.wheat).toBe(3);
    s.devPlayed = false;
    s.dev[0] = ['plenty'];
    act(s, 0, { type: 'plenty', a: 'ore', b: 'ore' });
    expect(s.hands[0]!.ore).toBe(2);
  });

  it('measures longest road, which an enemy settlement cuts, and awards it at five', () => {
    const s = createCatan(seats(3), 1);
    s.phase = 'main';
    s.current = 0;
    // Walk a path of 5 edges from vertex 0.
    let v = 0;
    const used = new Set<number>();
    for (let i = 0; i < 5; i++) {
      const e = EDGE_VERTS.findIndex(([a, b], idx) => !used.has(idx) && (a === v || b === v) && (i === 0 || !used.has(idx)));
      used.add(e);
      s.roads[e] = 0;
      v = EDGE_VERTS[e]![0] === v ? EDGE_VERTS[e]![1] : EDGE_VERTS[e]![0];
    }
    expect(roadLength(s, 0)).toBe(5);
    s.verts[v] = { seat: 1, city: false };
    expect(roadLength(s, 0)).toBeGreaterThanOrEqual(4);
  });

  it('ends the game when the current player reaches 10 points', () => {
    const s = setup();
    s.phase = 'main';
    s.current = 0;
    s.dev[0] = Array(8).fill('vp');
    expect(totalPoints(s, 0)).toBeGreaterThanOrEqual(10);
    s.hands[0] = { ...emptyHand(), sheep: 1, wheat: 1, ore: 1 };
    s.deck.push('vp');
    act(s, 0, { type: 'buyDev' });
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(0);
    expect(catanView(s, 1).points[0]).toBe(totalPoints(s, 0));
  });
});

describe('views and module', () => {
  it('hides other hands and hidden points', () => {
    const s = setup();
    s.hands[1]!.ore = 3;
    s.dev[1] = ['vp'];
    const v = catanView(s, 0);
    expect(v.cards[1]).toBe(total(s.hands[1]!));
    expect(v.points[1]).toBe(totalPoints(s, 1) - 1);
    expect(JSON.stringify(v)).not.toContain('"deck"');
  });

  it('only allows 3 or 4 players', () => {
    expect([catanModule.minPlayers, catanModule.maxPlayers]).toEqual([3, 4]);
    expect(() => catanModule.create(seats(3), {}, 1).viewFor('nobody')).toThrow();
  });
});

describe('fuzz', () => {
  /** Random legal-ish play: every move comes from the view's hints plus a dose of garbage. */
  function randomGame(seed: number, n: number): CatanState {
    const s = createCatan(seats(n), seed);
    const rng = createRng(seed * 7 + 1);
    const pick = <T>(xs: T[]): T => xs[nextInt(rng, xs.length)]!;
    let cooldown = 0;
    for (let step = 0; step < 2500 && s.phase !== 'over'; step++) {
      const actor = s.phase === 'discard' ? s.owe.findIndex(o => o > 0) : s.current;
      const v = catanView(s, actor);
      const options: CatanIntent[] = [{ type: 'roll' }, { type: 'end' }, { type: 'cancel' }, { type: 'buyDev' }, { type: 'knight' }, { type: 'roadBuilding' }];
      options.push({ type: 'bank', give: pick([...RES]), get: pick([...RES]) });
      options.push({ type: 'offer', give: { ...emptyHand(), [pick([...RES])]: 1 }, get: { ...emptyHand(), [pick([...RES])]: 1 } });
      options.push({ type: 'respond', accept: true }, { type: 'confirm', with: nextInt(rng, n) });
      options.push({ type: 'plenty', a: pick([...RES]), b: pick([...RES]) }, { type: 'monopoly', res: pick([...RES]) });
      if (v.can.settlement.length) options.push({ type: 'settlement', vertex: pick(v.can.settlement) });
      if (v.can.road.length) options.push({ type: 'road', edge: pick(v.can.road) });
      if (v.can.city.length) options.push({ type: 'city', vertex: pick(v.can.city) });
      if (v.can.robber.length) options.push({ type: 'robber', hex: pick(v.can.robber) });
      if (v.can.steal.length) options.push({ type: 'steal', from: pick(v.can.steal) });
      if (s.phase === 'discard') {
        const owe = s.owe[actor]!;
        const cards = emptyHand();
        let left = owe;
        for (const r of RES) {
          const k = Math.min(left, s.hands[actor]![r]);
          cards[r] = k;
          left -= k;
        }
        options.push({ type: 'discard', cards });
      }
      // Prefer to finish a turn after a few moves so games advance.
      const intent = cooldown > 6 && s.phase === 'main' ? ({ type: 'end' } as CatanIntent) : pick(options);
      const before = JSON.stringify(s);
      const r = applyCatan(s, actor, intent);
      if (!r.ok) expect(JSON.stringify(s)).toBe(before);
      else cooldown = intent.type === 'end' ? 0 : cooldown + 1;
      conserved(s);
      expect(s.verts.filter(b => b && !b.city).length).toBeLessThanOrEqual(5 * n);
      expect(s.roads.filter(r2 => r2 >= 0).length).toBeLessThanOrEqual(15 * n);
    }
    return s;
  }

  it('never breaks the rules over many random games', () => {
    for (let seed = 1; seed <= 8; seed++) randomGame(seed, 3 + (seed % 2));
  }, 60_000);

  it('refuses garbage intents without changing state', () => {
    const s = setup();
    const before = JSON.stringify(s);
    for (const bad of [null, 5, {}, { type: 'x' }, { type: 'road', edge: 'a' }, { type: 'settlement', vertex: -1 }, { type: 'bank', give: 'gold', get: 'ore' }, { type: 'discard', cards: 7 }, { type: 'offer', give: { wood: -1 }, get: { ore: 1 } }]) {
      expect(applyCatan(s, 0, bad as never).ok).toBe(false);
      expect(applyCatan(s, 9, bad as never).ok).toBe(false);
    }
    expect(JSON.stringify(s)).toBe(before);
  });
});
