import { emoji } from '../ui/emoji';

export type PlayerPieceId = 'vira-lata' | 'chinelo' | 'bola' | 'moto' | 'coco' | 'papagaio' | 'cafezinho' | 'violao' | 'pipa' | 'abacaxi';

/** The pieces a player can be on the board, drawn on a disc of the player's color. Two players may pick the same one. */
/** `fallback` stands in on devices without the newer emoji. */
export const PLAYER_PIECES: readonly { id: PlayerPieceId; emoji: string; fallback?: string }[] = [
  { id: 'vira-lata', emoji: '🐕' },
  { id: 'chinelo', emoji: '🩴', fallback: '👡' },
  { id: 'bola', emoji: '⚽' },
  { id: 'moto', emoji: '🛵' },
  { id: 'coco', emoji: '🥥' },
  { id: 'papagaio', emoji: '🦜', fallback: '🐦' },
  { id: 'cafezinho', emoji: '☕' },
  { id: 'violao', emoji: '🎸' },
  { id: 'pipa', emoji: '🪁', fallback: '🎏' },
  { id: 'abacaxi', emoji: '🍍' },
];

export function isPlayerPiece(x: unknown): x is PlayerPieceId {
  return typeof x === 'string' && PLAYER_PIECES.some((p) => p.id === x);
}

/** The piece's emoji; undefined for no piece (a room from before pieces), so callers can fall back to an initial. */
export function pieceEmoji(id: PlayerPieceId | undefined): string | undefined {
  const p = PLAYER_PIECES.find((p) => p.id === id);
  return p && (p.fallback ? emoji(p.emoji, p.fallback) : p.emoji);
}
