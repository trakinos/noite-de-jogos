import { getCard, isType } from '../cards/registry';
import type { EffectContext, Gen } from '../cards/types';
import type { CardId, GameState, PlayerState, Prompt, PromptAnswer } from './types';
import { drawCards, emptyPileCount, takeTop } from './zones';

type AnswerOf<K extends PromptAnswer['kind']> = Extract<PromptAnswer, { kind: K }>;

function removeFromHand(p: PlayerState, indices: number[]): CardId[] {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const cards = sorted.map((i) => p.hand[i]);
  for (const i of [...sorted].reverse()) p.hand.splice(i, 1);
  return cards;
}

export function createContext(state: GameState, me: number): EffectContext {
  /** Cards whose effects are resolving, innermost last (Throne Room nests). */
  const playing: CardId[] = [];
  const ctx: EffectContext = {
    me,
    state,

    opponents() {
      const n = state.players.length;
      return Array.from({ length: n - 1 }, (_, k) => (me + 1 + k) % n);
    },
    cost: (card) => getCard(card).cost,
    isType: (card, type) => isType(card, type),

    draw: (player, n) => drawCards(state, player, n),
    addActions(n) { state.turn.actions += n; },
    addBuys(n) { state.turn.buys += n; },
    addCoins(n) { state.turn.coins += n; },

    gain(player, card, to = 'discard') {
      if (!Object.hasOwn(state.supply, card) || state.supply[card] <= 0) return false;
      state.supply[card]--;
      const p = state.players[player];
      if (to === 'hand') p.hand.push(card);
      else if (to === 'deck') p.deck.unshift(card);
      else p.discard.push(card);
      ctx.log(player, 'gains', [card]);
      return true;
    },
    trashFromHand(player, handIndices) {
      const cards = removeFromHand(state.players[player], handIndices);
      ctx.trashCards(player, cards);
      return cards;
    },
    discardFromHand(player, handIndices) {
      const cards = removeFromHand(state.players[player], handIndices);
      ctx.discardCards(player, cards);
      return cards;
    },
    topdeckFromHand(player, handIndex) {
      const [card] = removeFromHand(state.players[player], [handIndex]);
      state.players[player].deck.unshift(card);
      ctx.log(player, 'puts a card onto their deck');
      return card;
    },
    takeFromDeck(player, n) {
      const out: CardId[] = [];
      for (let i = 0; i < n; i++) {
        const card = takeTop(state, player);
        if (card === undefined) break;
        out.push(card);
      }
      return out;
    },
    putOnDeck(player, cards) {
      state.players[player].deck.unshift(...cards);
    },
    discardCards(player, cards) {
      if (cards.length === 0) return;
      state.players[player].discard.push(...cards);
      ctx.log(player, 'discards', cards);
    },
    trashCards(player, cards) {
      if (cards.length === 0) return;
      state.trash.push(...cards);
      ctx.log(player, 'trashes', cards);
    },
    emptySupplyPiles: () => emptyPileCount(state),
    log(player, text, cards) {
      state.log.push(cards ? { player, text, cards: [...cards] } : { player, text });
    },

    *chooseFromHand(player, opts): Gen<number[]> {
      const hand = state.players[player].hand;
      const selectable = hand.map((_, i) => i).filter((i) => !opts.filter || opts.filter(hand[i]));
      return yield* ctx.chooseCards(player, hand, {
        id: opts.id, ...(opts.params && { params: opts.params }), min: opts.min, max: opts.max, message: opts.message, selectable,
      });
    },
    *chooseCards(player, cards, opts): Gen<number[]> {
      const selectable = opts.selectable ?? cards.map((_, i) => i);
      const max = Math.min(opts.max, selectable.length);
      const min = Math.min(opts.min, max);
      if (max === 0) return [];
      if (selectable.length === min) return [...selectable];
      const answer = yield {
        kind: 'chooseCards', id: opts.id, ...(opts.params && { params: opts.params }),
        player, message: opts.message, cards: [...cards], selectable, min, max,
      };
      return (answer as AnswerOf<'cards'>).indices;
    },
    *chooseSupply(player, opts): Gen<CardId | null> {
      const piles = Object.keys(state.supply).filter(
        (id) => state.supply[id] > 0 && getCard(id).cost <= opts.maxCost && (!opts.type || isType(id, opts.type)),
      );
      if (piles.length === 0) return null;
      const answer = yield {
        kind: 'chooseSupply', id: opts.id, ...(opts.params && { params: opts.params }),
        player, message: opts.message, piles, optional: opts.optional ?? false,
      };
      return (answer as AnswerOf<'supply'>).card;
    },
    *chooseOption(player, spec): Gen<number> {
      const { id, message, options, optionIds, cards } = spec;
      const answer = yield cards
        ? { kind: 'chooseOption', id, player, message, options, optionIds, cards: [...cards] }
        : { kind: 'chooseOption', id, player, message, options, optionIds };
      return (answer as AnswerOf<'option'>).index;
    },
    *orderCards(player, cards, spec): Gen<CardId[]> {
      if (cards.length <= 1) return [...cards];
      const answer = yield { kind: 'orderCards', id: spec.id, player, message: spec.message, cards: [...cards] };
      return (answer as AnswerOf<'order'>).order.map((i) => cards[i]);
    },
    *simultaneously<T>(players: number[], each: (player: number) => Gen<T>): Gen<T[]> {
      const runs = players.map(each);
      const steps = runs.map((run) => run.next());
      for (;;) {
        const open = steps.map((step, i) => (step.done ? -1 : i)).filter((i) => i >= 0);
        if (open.length === 0) return steps.map((step) => step.value as T);
        const prompts = open.map((i) => {
          const asked = steps[i].value as Prompt | Prompt[];
          if (Array.isArray(asked)) throw new Error('simultaneously: a run may only ask single prompts');
          return asked;
        });
        const answers = (yield prompts) as PromptAnswer[];
        open.forEach((i, k) => (steps[i] = runs[i].next(answers[k])));
      }
    },
    *attackedOpponents(): Gen<number[]> {
      const blocked = yield* ctx.simultaneously(ctx.opponents(), function* (opp) {
        const reaction = state.players[opp].hand.find((c) => isType(c, 'reaction'));
        if (!reaction) return false;
        const choice = yield* ctx.chooseOption(opp, {
          id: 'revealReaction',
          message: 'An attack is coming. Reveal your Reaction to block it?',
          options: ['Reveal', "Don't reveal"],
          optionIds: ['reveal', 'dontReveal'],
        });
        if (choice !== 0) return false;
        ctx.log(opp, 'reveals', [reaction]);
        return true;
      });
      return ctx.opponents().filter((_, i) => !blocked[i]);
    },
    get resolving() {
      return playing.length > 0 ? playing[playing.length - 1] : null;
    },
    *playCard(card): Gen {
      const effect = getCard(card).play;
      playing.push(card);
      try {
        if (effect) yield* effect(ctx);
      } finally {
        playing.pop();
      }
    },
  };
  return ctx;
}
