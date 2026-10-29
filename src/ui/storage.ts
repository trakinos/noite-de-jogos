import { isPlayerPiece, type PlayerPieceId } from '../theme/playerPieces';

const NAME_KEY = 'dmf-name';
const PIECE_KEY = 'dmf-piece';

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Storage unavailable: the name just won't be prefilled next time.
  }
}

/** The piece picked on the front page, if any. */
export function loadPiece(): PlayerPieceId | undefined {
  try {
    const piece = localStorage.getItem(PIECE_KEY);
    return isPlayerPiece(piece) ? piece : undefined;
  } catch {
    return undefined;
  }
}

export function savePiece(piece: PlayerPieceId): void {
  try {
    localStorage.setItem(PIECE_KEY, piece);
  } catch {
    // Storage unavailable: the piece just won't be remembered.
  }
}
