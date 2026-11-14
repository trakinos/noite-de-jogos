import { describe, expect, it } from 'vitest';
import { applyChess, createChess, playMove } from './game';
import { initialPosition, legalMoves, makeMove, san, type Move, type Piece, type PieceType, type Position } from './rules';

function fen(text: string): Position {
  const [placement, turn, rights, ep, half, full] = text.split(' ');
  const board: (Piece | null)[] = Array(64).fill(null);
  placement!.split('/').forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        board[(7 - i) * 8 + f] = { c: ch === ch.toUpperCase() ? 'w' : 'b', t: ch.toLowerCase() as PieceType };
        f++;
      }
    }
  });
  const sq = (n: string) => (n.charCodeAt(0) - 97) + (Number(n[1]) - 1) * 8;
  return {
    board,
    turn: turn as 'w' | 'b',
    castling: { wK: rights!.includes('K'), wQ: rights!.includes('Q'), bK: rights!.includes('k'), bQ: rights!.includes('q') },
    ep: ep === '-' ? null : sq(ep!),
    halfmove: Number(half ?? 0),
    fullmove: Number(full ?? 1),
  };
}

function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of legalMoves(pos)) n += depth === 1 ? 1 : perft(makeMove(pos, m), depth - 1);
  return n;
}

const sq = (n: string) => (n.charCodeAt(0) - 97) + (Number(n[1]) - 1) * 8;
const mv = (from: string, to: string, promo?: PieceType): Move => ({ from: sq(from), to: sq(to), ...(promo ? { promo } : {}) });

describe('chess move generation (perft)', () => {
  it('start position', () => {
    const p = initialPosition();
    expect([1, 2, 3].map(d => perft(p, d))).toEqual([20, 400, 8902]);
  });

  it('kiwipete: castling, en passant, promotions and pins', () => {
    const p = fen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    expect([1, 2, 3].map(d => perft(p, d))).toEqual([48, 2039, 97862]);
  });

  it('position 3: en passant discovered checks', () => {
    const p = fen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
    expect([1, 2, 3, 4].map(d => perft(p, d))).toEqual([14, 191, 2812, 43238]);
  });

  it('position 4: promotions and castling under attack', () => {
    const p = fen('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1');
    expect([1, 2, 3].map(d => perft(p, d))).toEqual([6, 264, 9467]);
  });
});

describe('notation', () => {
  it('writes captures, checks, castling and disambiguation', () => {
    const p = fen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(san(p, mv('e1', 'g1'))).toBe('O-O');
    expect(san(p, mv('e1', 'c1'))).toBe('O-O-O');
    expect(san(p, mv('a1', 'a8'))).toBe('Rxa8+');
    const twoKnights = fen('4k3/8/8/8/8/4N3/8/N3K3 w - - 0 1');
    expect(san(twoKnights, mv('a1', 'c2'))).toBe('Nac2');
    const promo = fen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(san(promo, mv('a7', 'a8', 'q'))).toBe('a8=Q+');
  });
});

describe('chess game', () => {
  const seats = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];

  it("fool's mate ends in checkmate for black", () => {
    const s = createChess(seats, 1);
    const white = s.white;
    const black = 1 - white;
    expect(applyChess(s, black, { type: 'move', ...mv('e7', 'e5') })).toEqual({ ok: false, reason: 'Not your turn' });
    for (const [seat, m] of [[white, mv('f2', 'f3')], [black, mv('e7', 'e5')], [white, mv('g2', 'g4')], [black, mv('d8', 'h4')]] as const) {
      expect(applyChess(s, seat, { type: 'move', ...m })).toEqual({ ok: true });
    }
    expect(s.result).toEqual({ winner: black, reason: 'checkmate' });
    expect(s.history.at(-1)!.san).toBe('Qh4#');
  });

  it('refuses illegal moves and needs a promotion piece', () => {
    const s = createChess(seats, 1);
    expect(applyChess(s, s.white, { type: 'move', ...mv('e2', 'e5') }).ok).toBe(false);
    s.position = fen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(applyChess(s, s.white, { type: 'move', ...mv('a7', 'a8') }).ok).toBe(false);
    expect(applyChess(s, s.white, { type: 'move', ...mv('a7', 'a8', 'n') }).ok).toBe(true);
    expect(s.position.board[sq('a8')]).toEqual({ c: 'w', t: 'n' });
  });

  it('draws by threefold repetition', () => {
    const s = createChess(seats, 1);
    const shuffle = [mv('g1', 'f3'), mv('g8', 'f6'), mv('f3', 'g1'), mv('f6', 'g8')];
    for (let i = 0; i < 2; i++) for (const m of shuffle) playMove(s, m);
    expect(s.result).toEqual({ winner: null, reason: 'repetition' });
  });

  it('draws by agreement and ends by resignation', () => {
    const s = createChess(seats, 1);
    expect(applyChess(s, 0, { type: 'offerDraw' }).ok).toBe(true);
    expect(applyChess(s, 0, { type: 'answerDraw', accept: true }).ok).toBe(false);
    expect(applyChess(s, 1, { type: 'answerDraw', accept: true }).ok).toBe(true);
    expect(s.result).toEqual({ winner: null, reason: 'agreement' });
    const t = createChess(seats, 1);
    applyChess(t, 1, { type: 'resign' });
    expect(t.result).toEqual({ winner: 0, reason: 'resign' });
  });

  it('stalemate and bare kings are draws', () => {
    const s = createChess(seats, 1);
    s.position = fen('7k/8/6Q1/8/8/8/8/K7 w - - 0 1');
    playMove(s, mv('g6', 'f7'));
    expect(s.result).toEqual({ winner: null, reason: 'stalemate' });
    const t = createChess(seats, 1);
    t.position = fen('7k/8/8/8/8/8/1q6/K7 w - - 0 1');
    playMove(t, mv('a1', 'b2'));
    expect(t.result).toEqual({ winner: null, reason: 'material' });
  });
});
