import { describe, it, expect } from 'vitest';
import { apply } from './engine';
import { game, give } from './testkit';
import { validateOffer } from './trades';
import { BAIRRO_DICTIONARIES } from './i18n';
import type { BairroState, OfferSide, OfferTerms } from './types';

const side = (o: Partial<OfferSide> = {}): OfferSide => ({ assets: [], cash: 0, lawyerCards: 0, ...o });
const terms = (give_: Partial<OfferSide>, get: Partial<OfferSide>, to = 1): OfferTerms => ({ to, give: side(give_), get: side(get) });
const propose = (s: BairroState, offer: OfferTerms, player = 0) => apply(s, player, { type: 'proposeTrade', offer });
const refused = (reason: string) => ({ ok: false, reason });

describe('trades', () => {
  it('swaps assets, cash and lawyer cards both ways when accepted', () => {
    const s = game(2);
    give(s, 0, 1);
    give(s, 1, 3);
    s.players[0].lawyerCards = 1;
    expect(propose(s, terms({ assets: [1], cash: 100, lawyerCards: 1 }, { assets: [3], cash: 30 }))).toEqual({ ok: true });
    expect(s.offer?.from).toBe(0);
    expect(apply(s, 1, { type: 'answerTrade', accept: true })).toEqual({ ok: true });
    expect(s.offer).toBeNull();
    expect(s.owned[1].owner).toBe(1);
    expect(s.owned[3].owner).toBe(0);
    expect(s.players[0].cash).toBe(1500 - 100 + 30);
    expect(s.players[1].cash).toBe(1500 + 100 - 30);
    expect([s.players[0].lawyerCards, s.players[1].lawyerCards]).toEqual([0, 1]);
    expect(s.log.map(l => l.key)).toEqual(['tradeProposed', 'tradeAccepted']);
  });

  it('declining changes nothing but clears the offer', () => {
    const s = game(2);
    give(s, 0, 1);
    propose(s, terms({ assets: [1] }, { cash: 10 }));
    expect(apply(s, 1, { type: 'answerTrade', accept: false })).toEqual({ ok: true });
    expect(s.offer).toBeNull();
    expect(s.owned[1].owner).toBe(0);
    expect(s.players[0].cash).toBe(1500);
    expect(s.log.at(-1)?.key).toBe('tradeDeclined');
  });

  it('only the proposer cancels', () => {
    const s = game(3);
    propose(s, terms({ cash: 10 }, {}));
    expect(apply(s, 1, { type: 'cancelTrade' })).toEqual(refused('tradePending'));
    expect(apply(s, 0, { type: 'cancelTrade' })).toEqual({ ok: true });
    expect(s.offer).toBeNull();
    expect(apply(s, 0, { type: 'cancelTrade' })).toEqual(refused('notNow'));
  });

  it('only the recipient answers', () => {
    const s = game(3);
    propose(s, terms({ cash: 10 }, {}));
    expect(apply(s, 0, { type: 'answerTrade', accept: true })).toEqual(refused('tradePending'));
    expect(apply(s, 2, { type: 'answerTrade', accept: true })).toEqual(refused('tradePending'));
    expect(s.offer).not.toBeNull();
  });

  it('keeps a mortgaged asset mortgaged', () => {
    const s = game(2);
    give(s, 0, 1, { mortgaged: true });
    propose(s, terms({ assets: [1] }, {}));
    apply(s, 1, { type: 'answerTrade', accept: true });
    expect(s.owned[1]).toEqual({ owner: 1, houses: 0, mortgaged: true });
  });

  it('refuses an asset in a rua with buildings, even a bare one', () => {
    const s = game(2);
    give(s, 0, 1, { houses: 1 });
    give(s, 0, 3);
    expect(propose(s, terms({ assets: [1] }, {}))).toEqual(refused('ruaHasBuildings'));
    expect(propose(s, terms({ assets: [3] }, {}))).toEqual(refused('ruaHasBuildings'));
    expect(s.offer).toBeNull();
  });

  it('refuses cash or lawyer cards beyond holdings, on either side', () => {
    const s = game(2);
    expect(propose(s, terms({ cash: 1501 }, {}))).toEqual(refused('notEnoughCash'));
    expect(propose(s, terms({}, { cash: 1501 }))).toEqual(refused('notEnoughCash'));
    expect(propose(s, terms({ lawyerCards: 1 }, {}))).toEqual(refused('notEnoughLawyerCards'));
  });

  it('refuses assets not owned by the right side, non-assets and repeats', () => {
    const s = game(2);
    give(s, 0, 1);
    give(s, 1, 3);
    expect(propose(s, terms({ assets: [3] }, {}))).toEqual(refused('notOwner'));
    expect(propose(s, terms({}, { assets: [1] }))).toEqual(refused('notOwner'));
    expect(propose(s, terms({ assets: [0] }, {}))).toEqual(refused('notAPonto'));
    expect(propose(s, terms({ assets: [1, 1] }, {}))).toEqual(refused('duplicateAsset'));
  });

  it('refuses empty offers, trading with yourself or a bankrupt player, and malformed shapes without throwing', () => {
    const s = game(3);
    expect(propose(s, terms({}, {}))).toEqual(refused('emptyOffer'));
    expect(propose(s, terms({ cash: 1 }, {}, 0))).toEqual(refused('badRecipient'));
    s.players[2].bankrupt = true;
    expect(propose(s, terms({ cash: 1 }, {}, 2))).toEqual(refused('badRecipient'));
    const bad: unknown[] = [
      undefined, null, 5, {}, terms({}, {}, 9), terms({}, {}, 1.5), terms({ cash: -1 }, {}),
      terms({ cash: 1.5 }, {}), terms({ assets: [99] }, {}), terms({ assets: [0.5] }, {}),
      { to: 1, give: null, get: side() }, { to: 1, give: { assets: 'x', cash: 0, lawyerCards: 0 }, get: side() },
      terms({ lawyerCards: -1 }, {}), terms({ cash: NaN }, {}),
    ];
    for (const offer of bad) {
      const r = apply(s, 0, { type: 'proposeTrade', offer } as never);
      expect(r.ok).toBe(false);
    }
    expect(s.offer).toBeNull();
  });

  it('is refused off turn, in the buy phase, with a debt, or with an offer already open', () => {
    const s = game(2);
    expect(propose(s, terms({ cash: 10 }, {}, 0), 1)).toEqual(refused('notYourTurn'));
    s.phase = { kind: 'buy', square: 1, rollAgain: false };
    expect(propose(s, terms({ cash: 10 }, {}))).toEqual(refused('notNow'));
    s.phase = { kind: 'manage', rollAgain: false };
    s.debts.push({ debtor: 1, creditor: null, amount: 5 });
    expect(propose(s, terms({ cash: 10 }, {}))).toEqual(refused('waitingForDebts'));
    s.debts = [];
    expect(propose(s, terms({ cash: 10 }, {}))).toEqual({ ok: true });
    expect(propose(s, terms({ cash: 20 }, {}))).toEqual(refused('tradePending'));
  });

  it('can be proposed in the manage phase, including while a roll-again is pending', () => {
    const s = game(2);
    s.phase = { kind: 'manage', rollAgain: true };
    expect(propose(s, terms({ cash: 10 }, {}))).toEqual({ ok: true });
  });

  it('voids an acceptance when the state changed, refusing with a reason', () => {
    const s = game(2);
    propose(s, terms({}, { cash: 1400 }));
    s.players[1].cash = 100;
    expect(apply(s, 1, { type: 'answerTrade', accept: true })).toEqual(refused('notEnoughCash'));
    expect(s.offer).toBeNull();
    expect(s.players.map(p => p.cash)).toEqual([1500, 100]);
    expect(s.log.at(-1)?.key).toBe('tradeVoided');
  });

  it('voids an acceptance when a rua gained buildings', () => {
    const s = game(2);
    give(s, 0, 1);
    propose(s, terms({ assets: [1] }, {}));
    s.owned[3] = { owner: 0, houses: 1, mortgaged: false };
    expect(apply(s, 1, { type: 'answerTrade', accept: true })).toEqual(refused('ruaHasBuildings'));
    expect(s.owned[1].owner).toBe(0);
  });

  it('blocks every other intent from everyone while an offer is open', () => {
    const s = game(3);
    give(s, 0, 1);
    propose(s, terms({ cash: 10 }, {}));
    const others = [
      { type: 'roll' }, { type: 'buy' }, { type: 'decline' }, { type: 'endTurn' }, { type: 'payJailFine' },
      { type: 'useLawyer' }, { type: 'build', pos: 1 }, { type: 'sellBuilding', pos: 1 }, { type: 'mortgage', pos: 1 },
      { type: 'unmortgage', pos: 1 }, { type: 'payDebt' }, { type: 'goBankrupt' },
      { type: 'proposeTrade', offer: terms({ cash: 5 }, {}) },
    ] as const;
    const before = JSON.stringify(s);
    for (const player of [0, 1, 2]) {
      for (const intent of others) {
        expect(apply(s, player, intent), `${player} ${intent.type}`).toEqual(refused('tradePending'));
      }
    }
    expect(JSON.stringify(s)).toBe(before);
  });

  it('validateOffer never throws on junk', () => {
    const s = game(2);
    expect(validateOffer(s, null as never)).toBe('badOffer');
    expect(validateOffer(s, { from: 0, to: 1 } as never)).toBe('badOffer');
  });

  it('has text for every trade log key and reason in both languages', () => {
    for (const lang of ['pt', 'en'] as const) {
      const d = BAIRRO_DICTIONARIES[lang];
      for (const k of ['tradeProposed', 'tradeAccepted', 'tradeDeclined', 'tradeCancelled', 'tradeVoided']) expect(d.log[k], k).toBeTruthy();
      for (const k of ['tradePending', 'badOffer', 'badRecipient', 'emptyOffer', 'duplicateAsset', 'notEnoughLawyerCards']) expect(d.reasons[k], k).toBeTruthy();
    }
  });
});
