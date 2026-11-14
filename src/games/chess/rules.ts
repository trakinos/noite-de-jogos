/** Chess rules on a plain 64-square array: square = rank * 8 + file, a1 = 0, h8 = 63. */

export type Side = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export interface Piece {
  c: Side;
  t: PieceType;
}

export interface Castling {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}

export interface Position {
  board: (Piece | null)[];
  turn: Side;
  castling: Castling;
  /** The square a pawn may capture onto en passant, or null. */
  ep: number | null;
  /** Plies since the last capture or pawn move, for the 50-move rule. */
  halfmove: number;
  fullmove: number;
}

export interface Move {
  from: number;
  to: number;
  promo?: PieceType;
}

export const PROMOTIONS: readonly PieceType[] = ['q', 'r', 'b', 'n'];

export const fileOf = (sq: number) => sq & 7;
export const rankOf = (sq: number) => sq >> 3;
export const other = (s: Side): Side => (s === 'w' ? 'b' : 'w');
export const squareName = (sq: number) => 'abcdefgh'[fileOf(sq)]! + String(rankOf(sq) + 1);

export function initialPosition(): Position {
  const board: (Piece | null)[] = Array(64).fill(null);
  const back: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let f = 0; f < 8; f++) {
    board[f] = { c: 'w', t: back[f]! };
    board[8 + f] = { c: 'w', t: 'p' };
    board[48 + f] = { c: 'b', t: 'p' };
    board[56 + f] = { c: 'b', t: back[f]! };
  }
  return { board, turn: 'w', castling: { wK: true, wQ: true, bK: true, bQ: true }, ep: null, halfmove: 0, fullmove: 1 };
}

const KNIGHT = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
] as const;
const KING = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
] as const;
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

function step(sq: number, df: number, dr: number): number | null {
  const f = fileOf(sq) + df;
  const r = rankOf(sq) + dr;
  return f < 0 || f > 7 || r < 0 || r > 7 ? null : r * 8 + f;
}

/** Whether `by` attacks `sq` (pins and checks ignored). */
export function attacked(board: (Piece | null)[], sq: number, by: Side): boolean {
  const is = (s: number | null, types: string) => {
    if (s === null) return false;
    const p = board[s];
    return !!p && p.c === by && types.includes(p.t);
  };
  // Pawns attack diagonally forward from their own side.
  const pawnRank = by === 'w' ? -1 : 1;
  if (is(step(sq, -1, pawnRank), 'p') || is(step(sq, 1, pawnRank), 'p')) return true;
  for (const [df, dr] of KNIGHT) if (is(step(sq, df, dr), 'n')) return true;
  for (const [df, dr] of KING) if (is(step(sq, df, dr), 'k')) return true;
  const slide = (dirs: readonly (readonly [number, number])[], types: string) => {
    for (const [df, dr] of dirs) {
      let s = step(sq, df, dr);
      while (s !== null) {
        const p = board[s];
        if (p) {
          if (p.c === by && types.includes(p.t)) return true;
          break;
        }
        s = step(s, df, dr);
      }
    }
    return false;
  };
  return slide(ROOK_DIRS, 'rq') || slide(BISHOP_DIRS, 'bq');
}

export function kingSquare(board: (Piece | null)[], side: Side): number {
  return board.findIndex(p => p?.c === side && p.t === 'k');
}

export function inCheck(pos: Position, side: Side = pos.turn): boolean {
  const k = kingSquare(pos.board, side);
  return k >= 0 && attacked(pos.board, k, other(side));
}

/** Moves that follow the pieces' movement, before checking whether they leave the king in check. */
function pseudoMoves(pos: Position): Move[] {
  const moves: Move[] = [];
  const { board, turn } = pos;
  const add = (from: number, to: number) => {
    const p = board[from]!;
    if (p.t === 'p' && (rankOf(to) === 7 || rankOf(to) === 0)) for (const promo of PROMOTIONS) moves.push({ from, to, promo });
    else moves.push({ from, to });
  };
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (!p || p.c !== turn) continue;
    if (p.t === 'p') {
      const dir = turn === 'w' ? 1 : -1;
      const startRank = turn === 'w' ? 1 : 6;
      const one = step(from, 0, dir);
      if (one !== null && !board[one]) {
        add(from, one);
        const two = step(from, 0, 2 * dir);
        if (rankOf(from) === startRank && two !== null && !board[two]) add(from, two);
      }
      for (const df of [-1, 1]) {
        const to = step(from, df, dir);
        if (to === null) continue;
        const target = board[to];
        if ((target && target.c !== turn) || to === pos.ep) add(from, to);
      }
      continue;
    }
    if (p.t === 'n' || p.t === 'k') {
      for (const [df, dr] of p.t === 'n' ? KNIGHT : KING) {
        const to = step(from, df, dr);
        if (to !== null && board[to]?.c !== turn) add(from, to);
      }
      if (p.t === 'k') castles(pos, from, moves);
      continue;
    }
    const dirs = p.t === 'r' ? ROOK_DIRS : p.t === 'b' ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
    for (const [df, dr] of dirs) {
      let to = step(from, df, dr);
      while (to !== null) {
        const target = board[to];
        if (target) {
          if (target.c !== turn) add(from, to);
          break;
        }
        add(from, to);
        to = step(to, df, dr);
      }
    }
  }
  return moves;
}

function castles(pos: Position, from: number, moves: Move[]): void {
  const { board, turn, castling } = pos;
  const home = turn === 'w' ? 4 : 60;
  if (from !== home) return;
  const enemy = other(turn);
  if (attacked(board, home, enemy)) return;
  const kSide = turn === 'w' ? castling.wK : castling.bK;
  const qSide = turn === 'w' ? castling.wQ : castling.bQ;
  const rook = (sq: number) => board[sq]?.c === turn && board[sq]?.t === 'r';
  if (kSide && rook(home + 3) && !board[home + 1] && !board[home + 2] && !attacked(board, home + 1, enemy) && !attacked(board, home + 2, enemy)) {
    moves.push({ from, to: home + 2 });
  }
  if (qSide && rook(home - 4) && !board[home - 1] && !board[home - 2] && !board[home - 3] && !attacked(board, home - 1, enemy) && !attacked(board, home - 2, enemy)) {
    moves.push({ from, to: home - 2 });
  }
}

/** Plays a move on a copy of the position; the move is assumed legal. */
export function makeMove(pos: Position, move: Move): Position {
  const board = pos.board.slice();
  const p = board[move.from]!;
  const captured = board[move.to];
  const castling = { ...pos.castling };
  let ep: number | null = null;
  board[move.to] = move.promo ? { c: p.c, t: move.promo } : p;
  board[move.from] = null;
  if (p.t === 'p') {
    if (move.to === pos.ep) board[move.to + (p.c === 'w' ? -8 : 8)] = null;
    if (Math.abs(move.to - move.from) === 16) ep = (move.to + move.from) / 2;
  }
  if (p.t === 'k') {
    if (move.to - move.from === 2) {
      board[move.from + 1] = board[move.from + 3]!;
      board[move.from + 3] = null;
    } else if (move.from - move.to === 2) {
      board[move.from - 1] = board[move.from - 4]!;
      board[move.from - 4] = null;
    }
    if (p.c === 'w') castling.wK = castling.wQ = false;
    else castling.bK = castling.bQ = false;
  }
  // A rook moving from, or captured on, its corner loses that castle.
  for (const sq of [move.from, move.to]) {
    if (sq === 0) castling.wQ = false;
    if (sq === 7) castling.wK = false;
    if (sq === 56) castling.bQ = false;
    if (sq === 63) castling.bK = false;
  }
  const reset = p.t === 'p' || captured !== null;
  return {
    board,
    turn: other(pos.turn),
    castling,
    ep,
    halfmove: reset ? 0 : pos.halfmove + 1,
    fullmove: pos.turn === 'b' ? pos.fullmove + 1 : pos.fullmove,
  };
}

export function legalMoves(pos: Position): Move[] {
  return pseudoMoves(pos).filter(m => !inCheck(makeMove(pos, m), pos.turn));
}

export function sameMove(a: Move, b: Move): boolean {
  return a.from === b.from && a.to === b.to && (a.promo ?? null) === (b.promo ?? null);
}

/** Identifies a position for threefold repetition: pieces, side to move, castling rights and a usable en passant square. */
export function positionKey(pos: Position): string {
  const pieces = pos.board.map(p => (p ? (p.c === 'w' ? p.t.toUpperCase() : p.t) : '.')).join('');
  const c = pos.castling;
  const rights = `${c.wK ? 'K' : ''}${c.wQ ? 'Q' : ''}${c.bK ? 'k' : ''}${c.bQ ? 'q' : ''}`;
  // The en passant square only matters when a capture onto it is actually possible.
  const ep = pos.ep !== null && legalMoves(pos).some(m => m.to === pos.ep && pos.board[m.from]?.t === 'p') ? pos.ep : '-';
  return `${pieces} ${pos.turn} ${rights} ${ep}`;
}

/** Neither side can ever mate: K v K, K+minor v K, or bishops all on one color. */
export function insufficientMaterial(board: (Piece | null)[]): boolean {
  const rest: { t: PieceType; sq: number }[] = [];
  board.forEach((p, sq) => {
    if (p && p.t !== 'k') rest.push({ t: p.t, sq });
  });
  if (rest.length === 0) return true;
  if (rest.length === 1 && (rest[0]!.t === 'n' || rest[0]!.t === 'b')) return true;
  if (rest.every(r => r.t === 'b')) {
    const shade = (sq: number) => (fileOf(sq) + rankOf(sq)) % 2;
    return rest.every(r => shade(r.sq) === shade(rest[0]!.sq));
  }
  return false;
}

const LETTER: Record<PieceType, string> = { p: '', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };

/** Standard algebraic notation for a legal move in `pos`. */
export function san(pos: Position, move: Move): string {
  const p = pos.board[move.from]!;
  let text: string;
  if (p.t === 'k' && Math.abs(move.to - move.from) === 2) {
    text = move.to > move.from ? 'O-O' : 'O-O-O';
  } else {
    const capture = pos.board[move.to] !== null || (p.t === 'p' && move.to === pos.ep);
    let prefix = LETTER[p.t];
    if (p.t === 'p') {
      if (capture) prefix = 'abcdefgh'[fileOf(move.from)]!;
    } else {
      const rivals = legalMoves(pos).filter(m => m.to === move.to && m.from !== move.from && pos.board[m.from]?.t === p.t);
      if (rivals.length > 0) {
        const sameFile = rivals.some(m => fileOf(m.from) === fileOf(move.from));
        const sameRank = rivals.some(m => rankOf(m.from) === rankOf(move.from));
        if (!sameFile) prefix += 'abcdefgh'[fileOf(move.from)];
        else if (!sameRank) prefix += String(rankOf(move.from) + 1);
        else prefix += squareName(move.from);
      }
    }
    text = `${prefix}${capture ? 'x' : ''}${squareName(move.to)}${move.promo ? `=${LETTER[move.promo]}` : ''}`;
  }
  const after = makeMove(pos, move);
  if (inCheck(after)) text += legalMoves(after).length === 0 ? '#' : '+';
  return text;
}
