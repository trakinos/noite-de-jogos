import { createRng, nextInt, shuffle, type RngState } from '../../engine/rng';
import type { ClockInput, ClockKind } from '../../net/turnClock';
import type { ApplyResult, GameInstance, GameModule, SeatInfo } from '../module';

/**
 * Zerou!: match the top card by color or symbol, and be the first to empty your hand.
 * Pula skips the next player, Inverte turns the order around (with two players it skips), +2 makes the next player draw 2
 * and lose their turn, Coringa picks the color, Coringa +4 picks the color and makes the next player draw 4 (only when you
 * have nothing of the current color). Going down to one card, you must call "Última!" or anyone can catch you for +2.
 */

export type Color = 'r' | 'y' | 'g' | 'b';
export const COLORS: readonly Color[] = ['r', 'y', 'g', 'b'];
export type Value = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'skip' | 'rev' | 'draw2' | 'wild' | 'wild4';

export interface Card {
  id: number;
  /** Null for the Coringas. */
  color: Color | null;
  value: Value;
}

export const HAND = 7;
export const CATCH_PENALTY = 2;

export type ZerouLog =
  | { k: 'play'; seat: number; card: Card; color?: Color }
  | { k: 'draw'; seat: number; n: number; forced: boolean }
  | { k: 'pass'; seat: number }
  | { k: 'last'; seat: number }
  | { k: 'caught'; seat: number; by: number }
  | { k: 'win'; seat: number };

export interface ZerouState {
  rng: RngState;
  players: SeatInfo[];
  hands: Card[][];
  draw: Card[];
  discard: Card[];
  /** The color in play: the top card's, or the one a Coringa picked. */
  color: Color;
  current: number;
  dir: 1 | -1;
  /** The current player drew this turn and may only play that card or pass. */
  drawn: number | null;
  /** A player down to one card who didn't call Última!, catchable until the next player acts. */
  exposed: number | null;
  /** Players who called Última! with one card. */
  called: boolean[];
  winner: number | null;
  turns: number;
  log: ZerouLog[];
}

export type ZerouIntent =
  | { type: 'play'; card: number; color?: Color; last?: boolean }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'last' }
  | { type: 'catch'; target: number };

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

export function fullDeck(): Card[] {
  const cards: Card[] = [];
  let id = 0;
  for (const color of COLORS) {
    cards.push({ id: id++, color, value: '0' });
    for (const value of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'rev', 'draw2'] as Value[]) {
      cards.push({ id: id++, color, value }, { id: id++, color, value });
    }
  }
  for (let i = 0; i < 4; i++) cards.push({ id: id++, color: null, value: 'wild' }, { id: id++, color: null, value: 'wild4' });
  return cards;
}

export function createZerou(seats: SeatInfo[], seed: number): ZerouState {
  const rng = createRng(seed);
  const deck = shuffle(rng, fullDeck());
  const hands = seats.map(() => deck.splice(0, HAND));
  // The first face-up card is a number, so the game opens without an effect.
  const firstIdx = deck.findIndex(c => c.color !== null && /^\d$/.test(c.value));
  const first = deck.splice(firstIdx, 1)[0]!;
  return {
    rng, players: seats, hands, draw: deck, discard: [first], color: first.color!, current: nextInt(rng, seats.length), dir: 1,
    drawn: null, exposed: null, called: seats.map(() => false), winner: null, turns: 0, log: [],
  };
}

export function top(s: ZerouState): Card {
  return s.discard.at(-1)!;
}

export function canPlay(s: ZerouState, hand: Card[], card: Card): boolean {
  if (card.value === 'wild') return true;
  if (card.value === 'wild4') return !hand.some(c => c.color === s.color);
  return card.color === s.color || card.value === top(s).value;
}

function next(s: ZerouState, from = s.current, steps = 1): number {
  const n = s.players.length;
  return (((from + s.dir * steps) % n) + n) % n;
}

function drawCards(s: ZerouState, seat: number, n: number): Card[] {
  const got: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (s.draw.length === 0) {
      // Reshuffle everything under the top card back into the pile.
      const keep = s.discard.pop()!;
      s.draw = shuffle(s.rng, s.discard);
      s.discard = [keep];
      if (s.draw.length === 0) break;
    }
    got.push(s.draw.pop()!);
  }
  s.hands[seat]!.push(...got);
  if (s.hands[seat]!.length > 1) s.called[seat] = false;
  return got;
}

function endTurn(s: ZerouState, to: number): void {
  s.current = to;
  s.drawn = null;
  s.turns++;
}

/** Someone else acted, so a forgotten Última! can no longer be caught. */
function closeCatch(s: ZerouState, actor: number): void {
  if (s.exposed !== null && s.exposed !== actor) s.exposed = null;
}

export function playCard(s: ZerouState, seat: number, cardId: number, color: Color | undefined, last: boolean): ApplyResult {
  const hand = s.hands[seat]!;
  const idx = hand.findIndex(c => c.id === cardId);
  if (idx < 0) return fail('That card is not in your hand');
  const card = hand[idx]!;
  if (s.drawn !== null && card.id !== s.drawn) return fail('You can only play the card you drew');
  if (!canPlay(s, hand, card)) return fail(card.value === 'wild4' ? 'Coringa +4 only without the current color' : 'That card does not match');
  const wild = card.color === null;
  if (wild && (!color || !COLORS.includes(color))) return fail('Pick a color');
  closeCatch(s, seat);
  hand.splice(idx, 1);
  s.discard.push(card);
  s.color = wild ? color! : card.color!;
  s.log.push({ k: 'play', seat, card, ...(wild ? { color: color! } : {}) });
  if (hand.length === 0) {
    s.winner = seat;
    s.log.push({ k: 'win', seat });
    s.turns++;
    return ok();
  }
  if (hand.length === 1) {
    s.called[seat] = last;
    if (last) s.log.push({ k: 'last', seat });
    else s.exposed = seat;
  }
  const n = s.players.length;
  switch (card.value) {
    case 'skip':
      return endTurn(s, next(s, seat, 2)), ok();
    case 'rev':
      s.dir = s.dir === 1 ? -1 : 1;
      return endTurn(s, n === 2 ? seat : next(s, seat)), ok();
    case 'draw2': {
      const victim = next(s, seat);
      drawCards(s, victim, 2);
      s.log.push({ k: 'draw', seat: victim, n: 2, forced: true });
      return endTurn(s, next(s, seat, 2)), ok();
    }
    case 'wild4': {
      const victim = next(s, seat);
      drawCards(s, victim, 4);
      s.log.push({ k: 'draw', seat: victim, n: 4, forced: true });
      return endTurn(s, next(s, seat, 2)), ok();
    }
    default:
      return endTurn(s, next(s, seat)), ok();
  }
}

export function applyZerou(s: ZerouState, seat: number, intent: ZerouIntent): ApplyResult {
  if (seat < 0 || seat >= s.players.length) return fail('Not a player');
  if (s.winner !== null) return fail('The game is over');
  if (!intent || typeof intent !== 'object') return fail('Bad move');
  switch (intent.type) {
    case 'last':
      // Calling ahead of time (with two cards, on your turn) or after the fact while nobody has caught you yet.
      if (s.hands[seat]!.length > 2) return fail('Only with one or two cards');
      if (s.hands[seat]!.length === 1 && s.exposed === seat) {
        s.exposed = null;
        s.called[seat] = true;
        s.log.push({ k: 'last', seat });
      }
      return ok();
    case 'catch': {
      const target = intent.target;
      if (target !== s.exposed || target === seat) return fail('Nobody to catch');
      drawCards(s, target, CATCH_PENALTY);
      s.exposed = null;
      s.log.push({ k: 'caught', seat: target, by: seat });
      return ok();
    }
    case 'play':
      if (seat !== s.current) return fail('Not your turn');
      return playCard(s, seat, intent.card, intent.color, intent.last === true);
    case 'draw': {
      if (seat !== s.current) return fail('Not your turn');
      if (s.drawn !== null) return fail('You already drew');
      closeCatch(s, seat);
      const [card] = drawCards(s, seat, 1);
      s.log.push({ k: 'draw', seat, n: 1, forced: false });
      if (card && canPlay(s, s.hands[seat]!, card)) s.drawn = card.id;
      else endTurn(s, next(s, seat));
      return ok();
    }
    case 'pass':
      if (seat !== s.current) return fail('Not your turn');
      if (s.drawn === null) return fail('Draw a card first');
      s.log.push({ k: 'pass', seat });
      endTurn(s, next(s, seat));
      return ok();
    default:
      return fail('Bad move');
  }
}

export interface ZerouView {
  players: { id: string; name: string; cards: number; called: boolean }[];
  me: number;
  hand: Card[];
  /** Cards in my hand that can be played now. */
  playable: number[];
  top: Card;
  color: Color;
  current: number;
  dir: 1 | -1;
  drawn: number | null;
  drawPile: number;
  exposed: number | null;
  winner: number | null;
  log: ZerouLog[];
  logTotal: number;
}

export function zerouView(s: ZerouState, seat: number): ZerouView {
  const hand = s.hands[seat]!;
  const mine = s.current === seat && s.winner === null;
  return {
    players: s.players.map((p, i) => ({ id: p.id, name: p.name, cards: s.hands[i]!.length, called: s.called[i]! })),
    me: seat,
    hand,
    playable: mine ? hand.filter(c => (s.drawn === null || c.id === s.drawn) && canPlay(s, hand, c)).map(c => c.id) : [],
    top: top(s),
    color: s.color,
    current: s.current,
    dir: s.dir,
    drawn: mine ? s.drawn : null,
    drawPile: s.draw.length,
    exposed: s.exposed,
    winner: s.winner,
    log: s.log,
    logTotal: s.log.length,
  };
}

export class ZerouInstance implements GameInstance {
  private key = -1;
  private obj: object = {};
  constructor(readonly state: ZerouState) {}

  private seat(id: string): number {
    return this.state.players.findIndex(p => p.id === id);
  }

  apply(playerId: string, intent: unknown): ApplyResult {
    return applyZerou(this.state, this.seat(playerId), intent as ZerouIntent);
  }

  viewFor(playerId: string): ZerouView {
    const seat = this.seat(playerId);
    if (seat < 0) throw new Error(`Unknown player: ${playerId}`);
    return zerouView(this.state, seat);
  }

  clockInput(): ClockInput {
    const s = this.state;
    if (s.turns !== this.key) {
      this.key = s.turns;
      this.obj = {};
    }
    return { turn: this.obj, currentPlayer: s.current, pending: null, over: s.winner !== null };
  }

  get over(): boolean {
    return this.state.winner !== null;
  }

  /** Time ran out: draw a card and pass (never plays a card by choice). */
  expire(_kind: ClockKind, _seed: number): void {
    const s = this.state;
    if (s.winner !== null) return;
    const seat = s.current;
    if (s.drawn === null) applyZerou(s, seat, { type: 'draw' });
    if (s.current === seat && s.drawn !== null) applyZerou(s, seat, { type: 'pass' });
  }
}

export const zerouModule: GameModule<Record<string, never>> = {
  id: 'zerou',
  minPlayers: 2,
  maxPlayers: 8,
  defaultOptions: () => ({}),
  parseOptions: () => ({}),
  create: (seats, _o, seed) => new ZerouInstance(createZerou(seats, seed)),
};

export function asZerouView(v: unknown): ZerouView {
  return v as ZerouView;
}
