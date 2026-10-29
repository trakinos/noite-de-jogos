import { describe, expect, it } from 'vitest';
import { PLAYER_PIECES, isPlayerPiece, pieceEmoji } from './playerPieces';

describe('player pieces', () => {
  it('has distinct ids and emoji', () => {
    expect(new Set(PLAYER_PIECES.map((p) => p.id)).size).toBe(PLAYER_PIECES.length);
    expect(new Set(PLAYER_PIECES.map((p) => p.emoji)).size).toBe(PLAYER_PIECES.length);
  });

  it('knows its own pieces and nothing else', () => {
    expect(isPlayerPiece('vira-lata')).toBe(true);
    expect(isPlayerPiece('dragao')).toBe(false);
    expect(isPlayerPiece(3)).toBe(false);
    expect(pieceEmoji('bola')).toBe('⚽');
    expect(pieceEmoji(undefined)).toBeUndefined();
  });
});
