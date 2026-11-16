import { createRng, nextInt, shuffle, type RngState } from '../../engine/rng';
import type { ClockInput, ClockKind } from '../../net/turnClock';
import type { ApplyResult, GameInstance, GameModule, SeatInfo } from '../module';

/**
 * Zerou!: match the top card by color or symbol, and be the first to empty your hand.
 * Pula skips the next player, Inverte turns the order around (with two players it skips), +2 makes the next player draw 2
 * and lose their turn, Coringa picks the color, Coringa +4 picks the color and makes the next player draw 4 (only when you
 * have nothing of the current color), Troca-Troca picks the color and swaps hands with another player.
 *
 * House rules from the playtest:
 * - Accusing: nothing is automatic. Anyone may accuse any opponent at any time. Holding exactly one card without having
 *   called Última! costs the accused 5 cards; otherwise the accuser draws 2. An uncalled last card stays accusable for as
 *   long as it is held, and can be called late while nobody has accused yet.
 * - Cutting in: a colored card identical to the top card (same color and symbol) can be played out of turn while the
 *   current player has not drawn yet. Its effect applies as usual and play continues after the player who cut in.
 * - The 9 race: a 9 pauses the game until everyone taps the pile. The last one draws 2 (per 9 played); when time runs
 *   out, everyone who has not tapped draws.
 * - Pairs: colored cards of the same number/symbol go down together if the first is legal; the last one stays on top
 *   and the effects add up.
 */

export type Color = 'r' | 'y' | 'g' | 'b';
export const COLORS: readonly Color[] = ['r', 'y', 'g', 'b'];
export type Value = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'skip' | 'rev' | 'draw2' | 'wild' | 'wild4' | 'swap';

export interface Card {
  id: number;
  /** Null for the Coringas and the Troca-Troca. */
  color: Color | null;
  value: Value;
}

export const HAND = 7;
/** Cards drawn by a player rightly accused of holding one card without calling Última!. */
export const ACCUSE_PENALTY = 5;
/** Cards drawn by whoever accuses wrongly. */
export const FALSE_ACCUSE_PENALTY = 2;
/** Cards the slowest player of a 9 race draws, per 9 played. */
export const RACE_PENALTY = 2;
/** How long a 9 race waits for taps. */
export const RACE_MS = 8000;
export const SWAP_COPIES = 4;
/** Entries of the log each view carries: the screen shows a handful, and messages stay small. */
export const VIEW_LOG = 30;

export type ZerouLog =
  | { k: 'play'; seat: number; card: Card; color?: Color; cut?: true }
  | { k: 'draw'; seat: number; n: number; forced: boolean }
  | { k: 'pass'; seat: number }
  | { k: 'last'; seat: number }
  /** `seat` was accused by `by`; `right` says who drew. */
  | { k: 'accuse'; seat: number; by: number; right: boolean; n: number }
  | { k: 'swap'; seat: number; with: number }
  | { k: 'race'; seat: number }
  /** `seat` was the slowest of the 9 race and drew `n`. */
  | { k: 'slow'; seat: number; n: number }
  | { k: 'win'; seat: number };

export interface Race {
  id: number;
  /** Who played the 9. */
  by: number;
  /** How many 9s went down together. */
  nines: number;
  tapped: boolean[];
  deadline: number;
}

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
  /** Players who called Última! with one card. */
  called: boolean[];
  /** A 9 was played: the game waits for everyone to tap the pile. */
  race: Race | null;
  races: number;
  winner: number | null;
  turns: number;
  log: ZerouLog[];
}

export type ZerouIntent =
  /** `cards` plays a pair (or more) in that order; out of turn it is a cut-in with one identical card. */
  | { type: 'play'; card?: number; cards?: number[]; color?: Color; target?: number; last?: boolean }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'last' }
  | { type: 'accuse'; target: number }
  | { type: 'tap' }
  /** Sent by every screen once the race time is up; only does something when it really is. */
  | { type: 'raceEnd' };

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
  for (let i = 0; i < SWAP_COPIES; i++) cards.push({ id: id++, color: null, value: 'swap' });
  return cards;
}

export const DECK_SIZE = fullDeck().length;

export function createZerou(seats: SeatInfo[], seed: number): ZerouState {
  const rng = createRng(seed);
  const deck = shuffle(rng, fullDeck());
  const hands = seats.map(() => deck.splice(0, HAND));
  // The first face-up card is a number other than 9, so the game opens without an effect.
  const firstIdx = deck.findIndex(c => c.color !== null && /^[0-8]$/.test(c.value));
  const first = deck.splice(firstIdx, 1)[0]!;
  return {
    rng, players: seats, hands, draw: deck, discard: [first], color: first.color!, current: nextInt(rng, seats.length), dir: 1,
    drawn: null, called: seats.map(() => false), race: null, races: 0, winner: null, turns: 0, log: [],
  };
}

export function top(s: ZerouState): Card {
  return s.discard.at(-1)!;
}

export function canPlay(s: ZerouState, hand: Card[], card: Card): boolean {
  if (card.value === 'wild' || card.value === 'swap') return true;
  if (card.value === 'wild4') return !hand.some(c => c.color === s.color);
  return card.color === s.color || card.value === top(s).value;
}

/** A colored card identical to the top card can be played out of turn, until the current player draws. */
export function canCutIn(s: ZerouState, seat: number, card: Card): boolean {
  if (s.winner !== null || s.race !== null || seat === s.current || s.drawn !== null) return false;
  const t = top(s);
  return card.color !== null && card.color === t.color && card.value === t.value;
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
  if (s.hands[seat]!.length !== 1) s.called[seat] = false;
  return got;
}

function endTurn(s: ZerouState, to: number): void {
  s.current = to;
  s.drawn = null;
  s.turns++;
}

function forcedDraw(s: ZerouState, seat: number, n: number): void {
  drawCards(s, seat, n);
  s.log.push({ k: 'draw', seat, n, forced: true });
}

interface PlayIntent {
  card?: number;
  cards?: number[];
  color?: Color;
  target?: number;
  last?: boolean;
}

/** Plays one card, or several of the same number/symbol, for `seat`: in turn, or cutting in when it is someone else's. */
export function playCards(s: ZerouState, seat: number, intent: PlayIntent, now: number): ApplyResult {
  const ids = Array.isArray(intent.cards) ? intent.cards : [intent.card];
  if (ids.length === 0 || ids.length > 8 || new Set(ids).size !== ids.length) return fail('Bad move');
  const hand = s.hands[seat]!;
  const cards: Card[] = [];
  for (const id of ids) {
    const found = hand.find(c => c.id === id);
    if (!found) return fail('That card is not in your hand');
    cards.push(found);
  }
  const first = cards[0]!;
  const lastCard = cards.at(-1)!;
  const cut = seat !== s.current;
  if (cut) {
    if (cards.length > 1 || !canCutIn(s, seat, first)) {
      const t = top(s);
      const identical = cards.length === 1 && first.color !== null && first.color === t.color && first.value === t.value;
      return fail(identical && s.drawn !== null ? 'Too late to cut in' : 'Not your turn');
    }
  } else {
    if (s.drawn !== null && (cards.length > 1 || first.id !== s.drawn)) return fail('You can only play the card you drew');
    if (!canPlay(s, hand, first)) return fail(first.value === 'wild4' ? 'Coringa +4 only without the current color' : 'That card does not match');
    if (cards.length > 1 && cards.some(c => c.color === null || c.value !== first.value)) return fail('Only cards of the same number go together');
  }
  const wild = lastCard.color === null;
  const color = intent.color;
  if (wild && (!color || !COLORS.includes(color))) return fail('Pick a color');
  const wins = hand.length === cards.length;
  const target = intent.target;
  if (first.value === 'swap' && !wins) {
    if (typeof target !== 'number' || !Number.isInteger(target) || target < 0 || target >= s.players.length || target === seat) return fail('Pick a player');
  }

  s.hands[seat] = hand.filter(c => !cards.includes(c));
  for (const card of cards) {
    s.discard.push(card);
    s.log.push({ k: 'play', seat, card, ...(card.color === null ? { color: color! } : {}), ...(cut ? { cut: true as const } : {}) });
  }
  s.color = wild ? color! : lastCard.color!;
  if (wins) {
    s.winner = seat;
    s.log.push({ k: 'win', seat });
    s.drawn = null;
    s.turns++;
    return ok();
  }
  if (s.hands[seat]!.length === 1) {
    s.called[seat] = intent.last === true;
    if (s.called[seat]) s.log.push({ k: 'last', seat });
  }

  const n = s.players.length;
  const k = cards.length;
  switch (first.value) {
    case 'skip':
      // Each Pula skips one more player; with two players the turn just comes back.
      endTurn(s, n === 2 ? seat : next(s, seat, k + 1));
      break;
    case 'rev':
      if (k % 2 === 1) s.dir = s.dir === 1 ? -1 : 1;
      endTurn(s, n === 2 ? seat : next(s, seat));
      break;
    case 'draw2':
      forcedDraw(s, next(s, seat), 2 * k);
      endTurn(s, next(s, seat, 2));
      break;
    case 'wild4':
      forcedDraw(s, next(s, seat), 4);
      endTurn(s, next(s, seat, 2));
      break;
    case 'swap': {
      const other = target!;
      [s.hands[seat], s.hands[other]] = [s.hands[other]!, s.hands[seat]!];
      // Nobody chose to end up with a single card here, so a swapped one-card hand counts as called.
      s.called[seat] = s.hands[seat]!.length === 1;
      s.called[other] = s.hands[other]!.length === 1;
      s.log.push({ k: 'swap', seat, with: other });
      endTurn(s, next(s, seat));
      break;
    }
    case '9':
      endTurn(s, next(s, seat));
      s.race = { id: ++s.races, by: seat, nines: k, tapped: s.players.map(() => false), deadline: now + RACE_MS };
      s.log.push({ k: 'race', seat });
      break;
    default:
      endTurn(s, next(s, seat));
  }
  return ok();
}

/** Ends the 9 race: everyone who has not tapped draws. */
function resolveRace(s: ZerouState): void {
  const race = s.race;
  if (!race) return;
  s.race = null;
  const n = RACE_PENALTY * race.nines;
  race.tapped.forEach((tapped, seat) => {
    if (tapped) return;
    drawCards(s, seat, n);
    s.log.push({ k: 'slow', seat, n });
  });
  // A fresh turn for the clock: the race did not eat the next player's time.
  s.turns++;
}

/** Time is up for the race (or the host's clock said so). */
export function expireRace(s: ZerouState): void {
  resolveRace(s);
}

export function applyZerou(s: ZerouState, seat: number, intent: ZerouIntent, now: number = Date.now()): ApplyResult {
  if (seat < 0 || seat >= s.players.length) return fail('Not a player');
  if (s.winner !== null) return fail('The game is over');
  if (!intent || typeof intent !== 'object') return fail('Bad move');
  // A race whose time ran out ends before anything else happens.
  if (s.race && now >= s.race.deadline) {
    resolveRace(s);
    if (intent.type === 'tap' || intent.type === 'raceEnd') return ok();
  }
  switch (intent.type) {
    case 'last':
      // Calling late works for as long as nobody has accused you; pressing it with more cards does nothing.
      if (s.hands[seat]!.length === 1 && !s.called[seat]) {
        s.called[seat] = true;
        s.log.push({ k: 'last', seat });
      }
      return ok();
    case 'accuse': {
      const target = intent.target;
      if (typeof target !== 'number' || !Number.isInteger(target) || target < 0 || target >= s.players.length || target === seat) return fail('Nobody to accuse');
      const right = s.hands[target]!.length === 1 && !s.called[target];
      const n = right ? ACCUSE_PENALTY : FALSE_ACCUSE_PENALTY;
      drawCards(s, right ? target : seat, n);
      s.log.push({ k: 'accuse', seat: target, by: seat, right, n });
      return ok();
    }
    case 'tap': {
      const race = s.race;
      // A tap that arrives after the race is over is not worth a complaint.
      if (!race || race.tapped[seat]) return ok();
      race.tapped[seat] = true;
      if (race.tapped.filter(x => !x).length <= 1) resolveRace(s);
      return ok();
    }
    case 'raceEnd':
      return ok();
    case 'play':
      if (s.race) return fail('Tap the 9 first');
      return playCards(s, seat, intent, now);
    case 'draw': {
      if (s.race) return fail('Tap the 9 first');
      if (seat !== s.current) return fail('Not your turn');
      if (s.drawn !== null) return fail('You already drew');
      const [card] = drawCards(s, seat, 1);
      s.log.push({ k: 'draw', seat, n: 1, forced: false });
      if (card && canPlay(s, s.hands[seat]!, card)) s.drawn = card.id;
      else endTurn(s, next(s, seat));
      return ok();
    }
    case 'pass':
      if (s.race) return fail('Tap the 9 first');
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
  /** Cards in my hand that can be played now, on my turn. */
  playable: number[];
  /** Cards in my hand I can cut in with, out of turn. */
  cut: number[];
  top: Card;
  color: Color;
  current: number;
  dir: 1 | -1;
  drawn: number | null;
  drawPile: number;
  /** The running 9 race: who tapped, and how long is left when this view was made. */
  race: { id: number; by: number; tapped: boolean[]; left: number; total: number } | null;
  winner: number | null;
  log: ZerouLog[];
  logTotal: number;
}

export function zerouView(s: ZerouState, seat: number, now: number = Date.now()): ZerouView {
  const hand = s.hands[seat]!;
  const mine = s.current === seat && s.winner === null && s.race === null;
  return {
    players: s.players.map((p, i) => ({ id: p.id, name: p.name, cards: s.hands[i]!.length, called: s.called[i]! })),
    me: seat,
    hand,
    playable: mine ? hand.filter(c => (s.drawn === null || c.id === s.drawn) && canPlay(s, hand, c)).map(c => c.id) : [],
    cut: hand.filter(c => canCutIn(s, seat, c)).map(c => c.id),
    top: top(s),
    color: s.color,
    current: s.current,
    dir: s.dir,
    drawn: mine ? s.drawn : null,
    drawPile: s.draw.length,
    race: s.race ? { id: s.race.id, by: s.race.by, tapped: s.race.tapped, left: Math.max(0, s.race.deadline - now), total: RACE_MS } : null,
    winner: s.winner,
    log: s.log.slice(-VIEW_LOG),
    logTotal: s.log.length,
  };
}

export class ZerouInstance implements GameInstance {
  private key = -1;
  private obj: object = {};
  private raceKey = -1;
  private raceObj = { player: -1 };
  constructor(readonly state: ZerouState, private readonly now: () => number = Date.now) {}

  private seat(id: string): number {
    return this.state.players.findIndex(p => p.id === id);
  }

  apply(playerId: string, intent: unknown): ApplyResult {
    return applyZerou(this.state, this.seat(playerId), intent as ZerouIntent, this.now());
  }

  viewFor(playerId: string): ZerouView {
    const seat = this.seat(playerId);
    if (seat < 0) throw new Error(`Unknown player: ${playerId}`);
    return zerouView(this.state, seat, this.now());
  }

  clockInput(): ClockInput {
    const s = this.state;
    if (s.turns !== this.key) {
      this.key = s.turns;
      this.obj = {};
    }
    // A 9 race is a prompt for everyone: it pauses the turn clock, and the host's response clock backs up the race's own.
    if (s.race && s.race.id !== this.raceKey) {
      this.raceKey = s.race.id;
      this.raceObj = { player: -1 };
    }
    return { turn: this.obj, currentPlayer: s.current, pending: s.race ? this.raceObj : null, over: s.winner !== null };
  }

  get over(): boolean {
    return this.state.winner !== null;
  }

  /** Time ran out: a 9 race ends with whoever tapped; otherwise draw a card and pass (never plays a card by choice). */
  expire(_kind: ClockKind, _seed: number): void {
    const s = this.state;
    if (s.winner !== null) return;
    if (s.race) return expireRace(s);
    const seat = s.current;
    const now = this.now();
    if (s.drawn === null) applyZerou(s, seat, { type: 'draw' }, now);
    if (s.current === seat && s.drawn !== null) applyZerou(s, seat, { type: 'pass' }, now);
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
