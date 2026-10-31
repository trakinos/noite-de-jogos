import { describe, it, expect } from 'vitest';
import { apply, caronaTargets } from './engine';
import { deckIds } from './deck';
import { invariantViolations } from './simkit';
import { createBairro } from './setup';
import { SKILLS } from './skills';
import { game, give, rig } from './testkit';
import type { BairroState, SkillId } from './types';

/** A game with every table rule on and nobody's skill dealt yet. */
function table(n = 2): BairroState {
  const s = game(n);
  s.auctionDeclined = true;
  s.pocketCards = true;
  s.deck = deckIds(true);
  return s;
}

/** Moves card `id` from the deck into `player`'s hand. */
function hold(s: BairroState, player: number, id: string): void {
  s.deck = s.deck.filter(c => c !== id);
  s.players[player].hand.push(id);
}

const skill = (s: BairroState, player: number, id: SkillId) => (s.players[player].skill = id);
const keys = (s: BairroState) => s.log.map(e => e.key);

describe('setup', () => {
  it('deals every player a different skill, logged for all to see, only with the setting', () => {
    const seats = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
    const s = createBairro(seats, 3, { skills: true, pocketCards: true });
    expect(new Set(s.players.map(p => p.skill))).toEqual(new Set(SKILLS));
    expect(s.log.filter(e => e.key === 'skillDealt')).toHaveLength(6);
    expect(s.deck).toHaveLength(42);
    const plain = createBairro(seats, 3);
    expect(plain.players.every(p => p.skill === null)).toBe(true);
    expect(plain.deck).toHaveLength(30);
  });
});

describe('auction for declined escrituras', () => {
  it('auctions the escritura the player declined, to everyone, and keeps their roll again', () => {
    const s = table(3);
    rig(s, [[1, 2]]); // 0 → 3, the lava-jato
    apply(s, 0, { type: 'roll' });
    expect(apply(s, 0, { type: 'decline' })).toEqual({ ok: true });
    expect(s.auction).toMatchObject({ from: 0, lots: [3], declined: true });
    expect(keys(s).slice(-2)).toEqual(['declined', 'auctionDeclined']);
    apply(s, 0, { type: 'bid', amount: 30 });
    apply(s, 1, { type: 'bid', amount: 40 });
    apply(s, 2, { type: 'bid', amount: 0 });
    expect(s.auction).toBeNull();
    expect(s.owned[3]).toEqual({ owner: 1, houses: 0, mortgaged: false });
    expect(s.phase).toEqual({ kind: 'manage', rollAgain: false });
  });

  it('leaves it unsold for later without the setting', () => {
    const s = game(2);
    rig(s, [[1, 2]]);
    apply(s, 0, { type: 'roll' });
    apply(s, 0, { type: 'decline' });
    expect(s.auction).toBeNull();
  });
});

describe('skills', () => {
  it('Corretor buys for 10% less and Empreiteiro builds for 25% less', () => {
    const s = table();
    skill(s, 0, 'corretor');
    rig(s, [[1, 2]]);
    apply(s, 0, { type: 'roll' });
    apply(s, 0, { type: 'buy' });
    expect(s.players[0].cash).toBe(1500 - 54);
    skill(s, 0, 'empreiteiro');
    give(s, 0, 1);
    expect(apply(s, 0, { type: 'build', pos: 1 })).toEqual({ ok: true });
    expect(s.players[0].cash).toBe(1500 - 54 - 38);
    expect(s.log.at(-1)).toMatchObject({ key: 'builtPuxadinho', params: { cost: 38 } });
  });

  it('Dono da Casa gets half the rent from the Prefeitura on their own escritura', () => {
    const s = table();
    skill(s, 0, 'donoDaCasa');
    give(s, 0, 3, { houses: 2 }); // rent 60
    rig(s, [[1, 2]]);
    apply(s, 0, { type: 'roll' });
    expect(s.players[0].cash).toBe(1530);
    expect(s.log.at(-1)).toEqual({ player: 0, key: 'skillHome', params: { pos: 3, amount: 30 } });
  });

  it('Rei da Pracinha is paid passing or stopping at the Pracinha, not leaving it', () => {
    const s = table();
    skill(s, 0, 'reiDaPracinha');
    s.players[0].pos = 15;
    rig(s, [[2, 3]]); // stops at 20
    apply(s, 0, { type: 'roll' });
    expect(s.players[0].cash).toBe(1600);
    s.phase = { kind: 'manage', rollAgain: true };
    rig(s, [[1, 2]]); // leaves 20 for 23
    const before = s.players[0].cash;
    apply(s, 0, { type: 'roll' });
    expect(s.players[0].cash).toBe(before);
    expect(keys(s).filter(k => k === 'skillPracinha')).toHaveLength(1);
  });

  it('Bicheiro gets 100 whenever anyone stops at the IPTU, the Bolão or the Pé de Meia, not when passing', () => {
    const s = table();
    skill(s, 1, 'bicheiro');
    rig(s, [[1, 3]]); // 0 → 4, the IPTU
    apply(s, 0, { type: 'roll' });
    expect(s.players[1].cash).toBe(1600);
    expect(s.log.at(-1)).toEqual({ player: 1, key: 'skillBicheiro', params: { who: 0, pos: 4, amount: 100 } });
    s.players[0].pos = 36;
    s.phase = { kind: 'manage', rollAgain: true };
    rig(s, [[3, 3]]); // 36 → 2: passes the Pé de Meia
    apply(s, 0, { type: 'roll' });
    expect(s.players[1].cash).toBe(1600);
  });

  it('Malandro rolls again once per lap, and gets it back passing the Pé de Meia', () => {
    const s = table();
    skill(s, 0, 'malandro');
    rig(s, [[1, 3], [2, 3]]);
    apply(s, 0, { type: 'roll' });
    expect(apply(s, 0, { type: 'useSkill' })).toEqual({ ok: true });
    expect(s.players[0].pos).toBe(9);
    expect(keys(s)).toContain('skillMalandro');
    expect(apply(s, 0, { type: 'useSkill' })).toEqual({ ok: false, reason: 'skillUsed' });
    expect(apply(s, 1, { type: 'useSkill' })).toEqual({ ok: false, reason: 'notYourTurn' });
    s.players[0].pos = 38;
    s.phase = { kind: 'manage', rollAgain: true };
    rig(s, [[1, 2]]);
    apply(s, 0, { type: 'roll' });
    expect(s.players[0].skillUsed).toBe(false);
  });

  it('refuses the Malandro move to anyone else and before rolling', () => {
    const s = table();
    expect(apply(s, 0, { type: 'useSkill' })).toEqual({ ok: false, reason: 'noSkillToUse' });
    skill(s, 0, 'malandro');
    expect(apply(s, 0, { type: 'useSkill' })).toEqual({ ok: false, reason: 'notNow' });
  });
});

describe('cards to keep', () => {
  /** Player 0 rolls [1,1] onto the Tigrinho at 2 with `id` on top. */
  function draw(s: BairroState, id: string) {
    s.deck = [id, ...s.deck.filter(c => c !== id)];
    rig(s, [[1, 1]]);
    apply(s, 0, { type: 'roll' });
  }

  it('keeps a drawn card in hand, up to three; one more goes back under the deck', () => {
    const s = table();
    draw(s, 'c31');
    expect(s.players[0].hand).toEqual(['c31']);
    expect(s.deck).not.toContain('c31');
    hold(s, 0, 'c33');
    hold(s, 0, 'c35');
    s.players[0].pos = 0;
    s.phase = { kind: 'manage', rollAgain: true };
    draw(s, 'c41');
    expect(s.players[0].hand).toHaveLength(3);
    expect(s.deck.at(-1)).toBe('c41');
    expect(s.log.at(-1)).toEqual({ player: 0, key: 'handFull', params: { max: 3 } });
    expect(invariantViolations(s)).toEqual([]);
  });

  it('Dado Viciado sets one die', () => {
    const s = table();
    hold(s, 0, 'c31');
    rig(s, [[2, 5]]);
    expect(apply(s, 0, { type: 'playCard', card: 'c31', die: 6 })).toEqual({ ok: true });
    expect(s.lastRoll).toEqual([6, 5]);
    expect(s.players[0].pos).toBe(11);
    expect(s.players[0].hand).toEqual([]);
    expect(s.deck.at(-1)).toBe('c31');
  });

  it('Marcha à Ré backs up instead of rolling, without the Pé de Meia, and lands', () => {
    const s = table();
    hold(s, 0, 'c33');
    give(s, 1, 39);
    s.players[0].pos = 1;
    expect(apply(s, 0, { type: 'playCard', card: 'c33', steps: 2 })).toEqual({ ok: true });
    expect(s.players[0].pos).toBe(39);
    expect(s.players[0].cash).toBe(1500 - 50);
    expect(s.phase).toEqual({ kind: 'manage', rollAgain: false });
  });

  it('Carona goes anywhere on your side, paying the Pé de Meia on reaching it', () => {
    expect(caronaTargets(33)).toEqual([30, 31, 32, 34, 35, 36, 37, 38, 39, 0]);
    expect(caronaTargets(10)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    const s = table();
    hold(s, 0, 'c39');
    s.players[0].pos = 33;
    expect(apply(s, 0, { type: 'playCard', card: 'c39', pos: 5 })).toEqual({ ok: false, reason: 'badCardChoice' });
    expect(apply(s, 0, { type: 'playCard', card: 'c39', pos: 0 })).toEqual({ ok: true });
    expect(s.players[0].cash).toBe(1700);
  });

  it('Calote lets you skip the rent you landed on, or pay it', () => {
    const s = table();
    hold(s, 0, 'c35');
    give(s, 1, 3);
    rig(s, [[1, 2]]);
    apply(s, 0, { type: 'roll' });
    expect(s.phase).toEqual({ kind: 'rent', square: 3, amount: 4, rollAgain: false });
    expect(apply(s, 0, { type: 'endTurn' })).toEqual({ ok: false, reason: 'notNow' });
    expect(apply(s, 0, { type: 'playCard', card: 'c35' })).toEqual({ ok: true });
    expect(s.players[0].cash).toBe(1500);
    expect(s.log.at(-1)).toMatchObject({ key: 'cardCalote', params: { to: 1, pos: 3, amount: 4 } });
  });

  it('pays the rent when asked, holding a Calote', () => {
    const s = table();
    hold(s, 0, 'c35');
    give(s, 1, 3);
    rig(s, [[1, 2]]);
    apply(s, 0, { type: 'roll' });
    expect(apply(s, 0, { type: 'payRent' })).toEqual({ ok: true });
    expect(s.players[0].cash).toBe(1496);
    expect(s.players[0].hand).toEqual(['c35']);
  });

  it('Fiscal na Porta: no buying, bidding or building until the end of the target\'s next turn', () => {
    const s = table(3);
    hold(s, 0, 'c37');
    expect(apply(s, 0, { type: 'playCard', card: 'c37', target: 0 })).toEqual({ ok: false, reason: 'badCardChoice' });
    expect(apply(s, 0, { type: 'playCard', card: 'c37', target: 1 })).toEqual({ ok: true });
    expect(s.players[1].fiscal).toBe(true);
    rig(s, [[1, 3], [1, 2]]);
    apply(s, 0, { type: 'roll' }); // 0 → 4: the IPTU
    apply(s, 0, { type: 'endTurn' });
    expect(s.players[1].fiscal).toBe(true);
    apply(s, 1, { type: 'roll' }); // 1 → 3
    expect(apply(s, 1, { type: 'buy' })).toEqual({ ok: false, reason: 'fiscalBlocked' });
    apply(s, 1, { type: 'decline' });
    expect(apply(s, 1, { type: 'bid', amount: 10 })).toEqual({ ok: false, reason: 'fiscalBlocked' });
    apply(s, 1, { type: 'bid', amount: 0 });
    give(s, 1, 6);
    give(s, 1, 8);
    give(s, 1, 9);
    apply(s, 0, { type: 'bid', amount: 0 });
    apply(s, 2, { type: 'bid', amount: 0 });
    expect(apply(s, 1, { type: 'build', pos: 6 })).toEqual({ ok: false, reason: 'fiscalBlocked' });
    apply(s, 1, { type: 'endTurn' });
    expect(s.players[1].fiscal).toBe(false);
  });

  it('Seguro blocks a Fiscal na Porta on its own and is used up', () => {
    const s = table();
    hold(s, 0, 'c37');
    hold(s, 1, 'c41');
    expect(apply(s, 1, { type: 'playCard', card: 'c41' })).toEqual({ ok: false, reason: 'notYourTurn' });
    apply(s, 0, { type: 'playCard', card: 'c37', target: 1 });
    expect(s.players[1].fiscal).toBe(false);
    expect(s.players[1].hand).toEqual([]);
    expect(s.log.at(-1)).toEqual({ player: 0, key: 'cardSeguro', params: { name: 'fiscal', to: 1, guard: 'seguro' } });
    expect(invariantViolations(s)).toEqual([]);
  });

  it('refuses cards you do not hold and cards played at the wrong time', () => {
    const s = table();
    hold(s, 0, 'c35');
    hold(s, 0, 'c41');
    expect(apply(s, 0, { type: 'playCard', card: 'c31', die: 3 })).toEqual({ ok: false, reason: 'notInHand' });
    expect(apply(s, 0, { type: 'playCard', card: 'c35' })).toEqual({ ok: false, reason: 'notNow' });
    expect(apply(s, 0, { type: 'playCard', card: 'c41' })).toEqual({ ok: false, reason: 'playsItself' });
  });

  it('a bankrupt player\'s cards go back under the deck', () => {
    const s = table();
    hold(s, 1, 'c31');
    s.players[1].cash = 0;
    s.debts.push({ debtor: 1, creditor: 0, amount: 500 });
    apply(s, 1, { type: 'goBankrupt' });
    expect(s.players[1].hand).toEqual([]);
    expect(s.deck).toContain('c31');
  });
});
