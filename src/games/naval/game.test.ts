import { describe, expect, it } from 'vitest';
import { createRng, nextFloat } from '../../engine/rng';
import { applyNaval, CELLS, createNaval, NavalInstance, navalView, randomFleet, shipCells, validFleet, type Placement } from './game';

const seats = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
const rows: Placement[] = [
  { id: 'carrier', at: 0, dir: 'h' },
  { id: 'battleship', at: 20, dir: 'h' },
  { id: 'cruiser', at: 40, dir: 'h' },
  { id: 'submarine', at: 60, dir: 'h' },
  { id: 'destroyer', at: 80, dir: 'h' },
];

function battle(seed = 1) {
  const s = createNaval(seats, seed);
  applyNaval(s, 0, { type: 'place', ships: rows });
  applyNaval(s, 1, { type: 'place', ships: rows });
  return s;
}

describe('batalha naval', () => {
  it('validates fleets', () => {
    expect(validFleet(rows)).toBe(true);
    expect(validFleet(rows.slice(1))).toBe(false);
    expect(validFleet([...rows.slice(0, 4), { id: 'destroyer', at: 9, dir: 'h' }])).toBe(false); // off the edge
    expect(validFleet([...rows.slice(0, 4), { id: 'destroyer', at: 1, dir: 'v' }])).toBe(false); // overlaps the carrier
    expect(validFleet([...rows.slice(0, 4), { id: 'carrier', at: 90, dir: 'h' }])).toBe(false); // duplicate
  });

  it('random fleets are always valid', () => {
    const rng = createRng(5);
    for (let i = 0; i < 300; i++) expect(validFleet(randomFleet(() => nextFloat(rng)))).toBe(true);
  });

  it('the battle starts once both fleets are placed; a player can take theirs back before that', () => {
    const s = createNaval(seats, 1);
    applyNaval(s, 0, { type: 'place', ships: rows });
    expect(s.phase).toBe('placing');
    expect(navalView(s, 1).players[0]!.ready).toBe(true);
    applyNaval(s, 0, { type: 'unready' });
    expect(s.fleets[0]).toBeNull();
    applyNaval(s, 0, { type: 'place', ships: rows });
    applyNaval(s, 1, { type: 'place', ships: rows });
    expect(s.phase).toBe('battle');
    expect(applyNaval(s, 0, { type: 'unready' }).ok).toBe(false);
  });

  it('turns alternate; hits, misses and sinking are reported', () => {
    const s = battle();
    const a = s.current;
    const b = 1 - a;
    expect(applyNaval(s, b, { type: 'fire', cell: 0 })).toEqual({ ok: false, reason: 'Not your turn' });
    applyNaval(s, a, { type: 'fire', cell: 80 });
    expect(s.shots[a]!.at(-1)!.result).toBe('hit');
    expect(s.current).toBe(b);
    applyNaval(s, b, { type: 'fire', cell: 99 });
    expect(s.shots[b]!.at(-1)!.result).toBe('miss');
    expect(applyNaval(s, a, { type: 'fire', cell: 80 })).toEqual({ ok: false, reason: 'You already fired there' });
    applyNaval(s, a, { type: 'fire', cell: 81 });
    expect(s.shots[a]!.at(-1)).toEqual({ cell: 81, result: 'sunk', ship: 'destroyer' });
    expect(navalView(s, a).theirShips.map(p => p.id)).toEqual(['destroyer']);
  });

  it('views hide the opponent fleet until it sinks or the game ends', () => {
    const s = battle();
    expect(navalView(s, 0).theirShips).toEqual([]);
    expect(navalView(s, 0).myFleet).toEqual(rows);
  });

  it('sinking every ship wins', () => {
    const s = battle(3);
    const a = s.current;
    const targets = rows.flatMap(shipCells);
    let miss = 99;
    for (const cell of targets) {
      applyNaval(s, a, { type: 'fire', cell });
      if (s.winner !== null) break;
      applyNaval(s, 1 - a, { type: 'fire', cell: miss-- });
    }
    expect(s.winner).toBe(a);
    expect(navalView(s, 1 - a).theirShips).toHaveLength(5);
  });

  it('timeouts fire at an open cell; placing has no clock', () => {
    const inst = new NavalInstance(createNaval(seats, 2));
    expect(inst.clockInput().over).toBe(true);
    applyNaval(inst.state, 0, { type: 'place', ships: rows });
    applyNaval(inst.state, 1, { type: 'place', ships: rows });
    expect(inst.clockInput().over).toBe(false);
    for (let i = 0; i < 2 * CELLS && !inst.over; i++) inst.expire('turn', i);
    expect(inst.over).toBe(true);
  });
});
