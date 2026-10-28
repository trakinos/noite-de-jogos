import { describe, expect, it } from 'vitest';
import { apply } from '../engine';
import { game, rig } from '../testkit';
import { viewFor } from '../view';
import { DECK } from '../deck';
import { BOARD } from '../board';
import { doublesBetween, releasesBetween, movesBetween, newEntries, rolledBetween, withPositions } from './motion';

describe('movesBetween', () => {
  it('walks a normal move square by square', () => {
    const s = game(2);
    const before = viewFor(s, 0);
    s.players[0].pos = 4;
    expect(movesBetween(before, viewFor(s, 0))).toEqual([{ player: 0, from: 0, to: 4, steps: [1, 2, 3, 4] }]);
  });

  it('wraps past square 0', () => {
    const s = game(2);
    s.players[1].pos = 38;
    const before = viewFor(s, 0);
    s.players[1].pos = 3;
    expect(movesBetween(before, viewFor(s, 0))).toEqual([{ player: 1, from: 38, to: 3, steps: [39, 0, 1, 2, 3] }]);
  });

  it('walks onto "Vá pra Papuda" and is arrested there', () => {
    const s = game(2);
    s.players[0].pos = 28;
    rig(s, [[1, 1]]);
    const before = viewFor(s, 0);
    apply(s, 0, { type: 'roll' });
    expect(s.players[0].pos).toBe(10);
    expect(movesBetween(before, viewFor(s, 0))).toEqual([{ player: 0, from: 28, to: 10, steps: [29, 30, 10], arrestAt: 30 }]);
  });

  it('is arrested on the spot on the third doubles', () => {
    const s = game(2);
    s.players[0].pos = 5;
    s.doublesInRow = 2;
    rig(s, [[3, 3]]);
    const before = viewFor(s, 0);
    apply(s, 0, { type: 'roll' });
    expect(movesBetween(before, viewFor(s, 0))).toEqual([{ player: 0, from: 5, to: 10, steps: [10], arrestAt: 5 }]);
  });

  it('just jumps to the Papuda when no roll explains the arrest', () => {
    const s = game(2);
    s.players[0].pos = 22;
    const before = viewFor(s, 0);
    s.players[0].pos = 10;
    s.log.push({ player: 0, key: 'wentToJail' });
    expect(movesBetween(before, viewFor(s, 0))).toEqual([{ player: 0, from: 22, to: 10, steps: [10] }]);
  });

  it('jumps when a move is longer than any roll', () => {
    const s = game(2);
    s.players[0].pos = 25;
    const before = viewFor(s, 0);
    s.players[0].pos = 0;
    expect(movesBetween(before, viewFor(s, 0))).toEqual([{ player: 0, from: 25, to: 0, steps: [0] }]);
  });

  it('is empty when nobody moved', () => {
    const s = game(2);
    expect(movesBetween(viewFor(s, 0), viewFor(s, 0))).toEqual([]);
  });

  it('is empty for a different game size', () => {
    expect(movesBetween(viewFor(game(2), 0), viewFor(game(3), 0))).toEqual([]);
  });
});

describe('rolledBetween', () => {
  it('is true only when a new roll was logged', () => {
    const s = game(2);
    rig(s, [[1, 2]]);
    const before = viewFor(s, 0);
    expect(rolledBetween(before, viewFor(s, 0))).toBe(false);
    apply(s, 0, { type: 'roll' });
    expect(rolledBetween(before, viewFor(s, 0))).toBe(true);
    expect(rolledBetween(viewFor(s, 0), viewFor(s, 0))).toBe(false);
  });
});

describe('withPositions', () => {
  it('replaces only the positions', () => {
    const v = viewFor(game(2), 0);
    const shown = withPositions(v, [7, 9]);
    expect(shown.players.map(p => p.pos)).toEqual([7, 9]);
    expect(v.players.map(p => p.pos)).toEqual([0, 0]);
    expect(shown.players[0].cash).toBe(v.players[0].cash);
  });
});

describe('capped wire logs', () => {
  /** A view as the host sends it: only the latest 150 entries, `logTotal` the real length. */
  const capped = (s: ReturnType<typeof game>) => {
    const v = viewFor(s, 0);
    return { ...v, log: v.log.slice(-150) };
  };
  const fill = (s: ReturnType<typeof game>, n: number) => {
    for (let i = 0; i < n; i++) s.log.push({ player: 1, key: 'declined', params: { pos: 3 } });
  };

  it('still sees a roll once both logs are at the cap', () => {
    const s = game(2);
    fill(s, 200);
    rig(s, [[1, 2]]);
    const before = capped(s);
    apply(s, 0, { type: 'roll' });
    expect(before.log).toHaveLength(150);
    expect(rolledBetween(before, capped(s))).toBe(true);
    expect(rolledBetween(before, before)).toBe(false);
  });

  it('still walks to the arrest at the cap', () => {
    const s = game(2);
    fill(s, 200);
    s.players[0].pos = 28;
    rig(s, [[1, 1]]);
    const before = capped(s);
    apply(s, 0, { type: 'roll' });
    expect(movesBetween(before, capped(s))).toEqual([{ player: 0, from: 28, to: 10, steps: [29, 30, 10], arrestAt: 30 }]);
  });

  it('copes with a delta larger than the cap', () => {
    const s = game(2);
    const before = capped(s);
    fill(s, 300);
    expect(newEntries(before, capped(s))).toHaveLength(150);
  });
});

describe('advance to start', () => {
  it('jumps even when the start is within walking distance', () => {
    const s = game(2);
    s.players[0].pos = 36;
    const before = viewFor(s, 0);
    const card = DECK.find(c => c.effect.kind === 'advanceToStart')!.id;
    s.log.push({ player: 0, key: 'luck', params: { card } });
    s.players[0].pos = 0;
    expect(movesBetween(before, viewFor(s, 0))).toEqual([{ player: 0, from: 36, to: 0, steps: [0] }]);
  });
});

describe('doublesBetween', () => {
  const rollWith = (dice: [number, number][], setup?: (s: ReturnType<typeof game>) => void) => {
    const s = game(2);
    setup?.(s);
    rig(s, dice);
    const before = viewFor(s, 0);
    apply(s, 0, { type: 'roll' });
    return doublesBetween(before, viewFor(s, 0));
  };

  it('is nothing for a plain roll', () => {
    expect(rollWith([[2, 5]])).toBeNull();
  });

  it('says roll again for doubles', () => {
    expect(rollWith([[3, 3]])).toBe('again');
  });

  it('says free when doubles get you out of the Papuda', () => {
    expect(rollWith([[4, 4]], s => { s.players[0].pos = 10; s.players[0].jailTurns = 0; })).toBe('free');
  });

  it('says third on the third doubles in a row', () => {
    expect(rollWith([[5, 5]], s => { s.doublesInRow = 2; })).toBe('third');
  });

  it('is nothing when nobody rolled', () => {
    const s = game(2);
    const v = viewFor(s, 0);
    expect(doublesBetween(v, v)).toBeNull();
  });
});

describe('releasesBetween', () => {
  const jailed = () => {
    const s = game(2);
    s.players[0].pos = 10;
    s.players[0].jailTurns = 0;
    return s;
  };

  it('sees the fine paid', () => {
    const s = jailed();
    const before = viewFor(s, 0);
    apply(s, 0, { type: 'payJailFine' });
    expect(releasesBetween(before, viewFor(s, 0))).toEqual([{ player: 0, kind: 'fine', rolled: false }]);
  });

  it('sees a lawyer card used', () => {
    const s = jailed();
    s.players[0].lawyerCards = 1;
    const before = viewFor(s, 0);
    apply(s, 0, { type: 'useLawyer' });
    expect(releasesBetween(before, viewFor(s, 0))).toEqual([{ player: 0, kind: 'lawyer', rolled: false }]);
  });

  it('sees doubles, which wait for the dice', () => {
    const s = jailed();
    rig(s, [[2, 2]]);
    const before = viewFor(s, 0);
    apply(s, 0, { type: 'roll' });
    expect(releasesBetween(before, viewFor(s, 0))).toEqual([{ player: 0, kind: 'doubles', rolled: true }]);
  });

  it('sees the forced fine on the third try', () => {
    const s = jailed();
    s.players[0].jailTurns = 2;
    rig(s, [[1, 2]]);
    const before = viewFor(s, 0);
    apply(s, 0, { type: 'roll' });
    expect(releasesBetween(before, viewFor(s, 0))).toEqual([{ player: 0, kind: 'fine', rolled: true }]);
  });

  it('is nothing for a failed try', () => {
    const s = jailed();
    rig(s, [[1, 2]]);
    const before = viewFor(s, 0);
    apply(s, 0, { type: 'roll' });
    expect(releasesBetween(before, viewFor(s, 0))).toEqual([]);
  });
});

describe('Tigrinho cards on the way', () => {
  const luckPos = BOARD.findIndex(sq => sq.kind === 'luck');
  const drawOn = (kind: string, extra: (c: (typeof DECK)[number]) => boolean = () => true) => {
    const s = game(2);
    s.players[0].pos = luckPos - 3;
    const card = DECK.find(c => c.effect.kind === kind && extra(c))!;
    s.deck = [card.id, ...s.deck.filter(id => id !== card.id)];
    rig(s, [[1, 2]]);
    const before = viewFor(s, 0);
    apply(s, 0, { type: 'roll' });
    return { moves: movesBetween(before, viewFor(s, 0)), card: card.id, s };
  };
  const walkTo = [luckPos - 2, luckPos - 1, luckPos];

  it('shows a money card once the walk ends', () => {
    const { moves, card } = drawOn('money');
    expect(moves).toEqual([{ player: 0, from: luckPos - 3, to: luckPos, steps: walkTo, card: { id: card, pos: luckPos, after: 3 } }]);
  });

  it('shows the card, then the cop, for a card that sends you to the Papuda', () => {
    const { moves, card } = drawOn('goToJail');
    expect(moves).toEqual([
      { player: 0, from: luckPos - 3, to: 10, steps: [...walkTo, 10], card: { id: card, pos: luckPos, after: 3 }, arrestAt: luckPos },
    ]);
  });

  it('shows the card, then jumps to the Pé de Meia', () => {
    const { moves, card } = drawOn('advanceToStart');
    expect(moves).toEqual([{ player: 0, from: luckPos - 3, to: 0, steps: [...walkTo, 0], card: { id: card, pos: luckPos, after: 3 } }]);
  });
});
