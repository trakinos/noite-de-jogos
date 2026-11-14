import { createRng, nextInt } from '../../engine/rng';
import type { ClockInput, ClockKind } from '../../net/turnClock';
import type { ApplyResult, GameInstance, GameModule, SeatInfo } from '../module';
import {
  initialPosition, inCheck, insufficientMaterial, kingSquare, legalMoves, makeMove, positionKey, PROMOTIONS, san, sameMove,
  type Move, type Piece, type PieceType, type Position, type Side,
} from './rules';

export type ChessEnd = 'checkmate' | 'stalemate' | 'resign' | 'repetition' | 'fifty' | 'material' | 'agreement';

export interface ChessResult {
  /** The winning seat, or null for a draw. */
  winner: number | null;
  reason: ChessEnd;
}

export interface PlayedMove extends Move {
  san: string;
  side: Side;
}

export interface ChessState {
  /** Seat ids in seat order. */
  players: SeatInfo[];
  /** The seat playing white. */
  white: number;
  position: Position;
  history: PlayedMove[];
  /** Position keys after every ply, for threefold repetition. */
  keys: string[];
  /** The seat that offered a draw, until the other answers or moves. */
  drawOffer: number | null;
  result: ChessResult | null;
}

export type ChessIntent =
  | { type: 'move'; from: number; to: number; promo?: PieceType }
  | { type: 'resign' }
  | { type: 'offerDraw' }
  | { type: 'answerDraw'; accept: boolean };

export interface ChessView {
  players: { id: string; name: string; side: Side }[];
  /** This player's seat. */
  me: number;
  mySide: Side;
  /** 64 squares, a1 first: '' or side + piece, like 'wq'. */
  board: string[];
  turn: Side;
  /** Legal moves for this player, only on their turn. */
  moves: Move[];
  history: PlayedMove[];
  lastMove: Move | null;
  /** The king in check, if any. */
  check: number | null;
  drawOffer: number | null;
  result: ChessResult | null;
  /** Pieces each side has taken, as piece letters. */
  captured: { w: PieceType[]; b: PieceType[] };
  log: unknown[];
}

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

export function createChess(seats: SeatInfo[], seed: number): ChessState {
  const rng = createRng(seed);
  const position = initialPosition();
  return { players: seats, white: nextInt(rng, 2), position, history: [], keys: [positionKey(position)], drawOffer: null, result: null };
}

export function sideOf(s: ChessState, seat: number): Side {
  return seat === s.white ? 'w' : 'b';
}

function seatOf(s: ChessState, side: Side): number {
  return side === 'w' ? s.white : 1 - s.white;
}

function isSquare(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < 64;
}

export function playMove(s: ChessState, move: Move): void {
  const before = s.position;
  const side = before.turn;
  const text = san(before, move);
  s.position = makeMove(before, move);
  s.history.push({ from: move.from, to: move.to, ...(move.promo ? { promo: move.promo } : {}), san: text, side });
  const key = positionKey(s.position);
  s.keys.push(key);
  s.drawOffer = null;
  const replies = legalMoves(s.position);
  if (replies.length === 0) {
    s.result = inCheck(s.position) ? { winner: seatOf(s, side), reason: 'checkmate' } : { winner: null, reason: 'stalemate' };
  } else if (insufficientMaterial(s.position.board)) {
    s.result = { winner: null, reason: 'material' };
  } else if (s.keys.filter(k => k === key).length >= 3) {
    s.result = { winner: null, reason: 'repetition' };
  } else if (s.position.halfmove >= 100) {
    s.result = { winner: null, reason: 'fifty' };
  }
}

export function applyChess(s: ChessState, seat: number, intent: ChessIntent): ApplyResult {
  if (seat < 0 || seat > 1) return fail('Not a player');
  if (s.result) return fail('The game is over');
  if (!intent || typeof intent !== 'object') return fail('Bad move');
  switch (intent.type) {
    case 'move': {
      if (sideOf(s, seat) !== s.position.turn) return fail('Not your turn');
      if (!isSquare(intent.from) || !isSquare(intent.to)) return fail('Bad move');
      const promo = intent.promo !== undefined && PROMOTIONS.includes(intent.promo) ? intent.promo : undefined;
      const move: Move = { from: intent.from, to: intent.to, ...(promo ? { promo } : {}) };
      if (!legalMoves(s.position).some(m => sameMove(m, move))) return fail('Illegal move');
      playMove(s, move);
      return ok();
    }
    case 'resign':
      s.result = { winner: 1 - seat, reason: 'resign' };
      return ok();
    case 'offerDraw':
      if (s.drawOffer !== null) return fail('A draw is already offered');
      s.drawOffer = seat;
      return ok();
    case 'answerDraw':
      if (s.drawOffer === null || s.drawOffer === seat) return fail('No draw to answer');
      if (intent.accept) s.result = { winner: null, reason: 'agreement' };
      s.drawOffer = null;
      return ok();
    default:
      return fail('Bad move');
  }
}

const START_COUNT: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

/** What each side has taken: the opponent's starting pieces minus what is left (promotions count as the new piece). */
function captured(board: (Piece | null)[]): { w: PieceType[]; b: PieceType[] } {
  const left = (side: Side, t: PieceType) => board.filter(p => p?.c === side && p.t === t).length;
  const taken = (victim: Side) =>
    (['q', 'r', 'b', 'n', 'p'] as PieceType[]).flatMap(t => Array(Math.max(0, START_COUNT[t] - left(victim, t))).fill(t) as PieceType[]);
  return { w: taken('b'), b: taken('w') };
}

export function chessView(s: ChessState, seat: number): ChessView {
  const mySide = sideOf(s, seat);
  const pos = s.position;
  const last = s.history.at(-1);
  return {
    players: s.players.map((p, i) => ({ id: p.id, name: p.name, side: sideOf(s, i) })),
    me: seat,
    mySide,
    board: pos.board.map(p => (p ? p.c + p.t : '')),
    turn: pos.turn,
    moves: !s.result && pos.turn === mySide ? legalMoves(pos) : [],
    history: s.history,
    lastMove: last ? { from: last.from, to: last.to } : null,
    check: inCheck(pos) ? kingSquare(pos.board, pos.turn) : null,
    drawOffer: s.drawOffer,
    result: s.result,
    captured: captured(pos.board),
    log: [],
  };
}

export class ChessInstance implements GameInstance {
  constructor(readonly state: ChessState) {}

  private seat(playerId: string): number {
    return this.state.players.findIndex(p => p.id === playerId);
  }

  apply(playerId: string, intent: unknown): ApplyResult {
    return applyChess(this.state, this.seat(playerId), intent as ChessIntent);
  }

  viewFor(playerId: string): ChessView {
    const seat = this.seat(playerId);
    if (seat < 0) throw new Error(`Unknown player: ${playerId}`);
    return chessView(this.state, seat);
  }

  /** One turn per ply; the side to move owns the clock. */
  private turnKey = -1;
  private turnObj: object = {};
  clockInput(): ClockInput {
    const s = this.state;
    if (s.history.length !== this.turnKey) {
      this.turnKey = s.history.length;
      this.turnObj = {};
    }
    return { turn: this.turnObj, currentPlayer: seatOf(s, s.position.turn), pending: null, over: s.result !== null };
  }

  get over(): boolean {
    return this.state.result !== null;
  }

  /** Time ran out: a random legal move is played for the side to move. */
  expire(_kind: ClockKind, seed: number): void {
    const s = this.state;
    if (s.result) return;
    const moves = legalMoves(s.position);
    if (moves.length === 0) return;
    playMove(s, moves[nextInt(createRng(seed), moves.length)]!);
  }
}

export type ChessOptions = Record<string, never>;

export const chessModule: GameModule<ChessOptions> = {
  id: 'chess',
  minPlayers: 2,
  maxPlayers: 2,
  defaultOptions: () => ({}),
  parseOptions: () => ({}),
  create: (seats, _options, seed) => new ChessInstance(createChess(seats, seed)),
};

export function asChessView(v: unknown): ChessView {
  return v as ChessView;
}
