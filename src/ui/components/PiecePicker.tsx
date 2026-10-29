import type { UiKey } from '../../i18n';
import { useLang } from '../../i18n/LangProvider';
import { PLAYER_PIECES, type PlayerPieceId } from '../../theme/playerPieces';

export const PIECE_LABELS: Record<PlayerPieceId, UiKey> = {
  'vira-lata': 'pieceViraLata', chinelo: 'pieceChinelo', bola: 'pieceBola', moto: 'pieceMoto', coco: 'pieceCoco',
  papagaio: 'piecePapagaio', cafezinho: 'pieceCafezinho', violao: 'pieceViolao', pipa: 'piecePipa', abacaxi: 'pieceAbacaxi',
};

interface Props {
  value: PlayerPieceId | undefined;
  onPick(piece: PlayerPieceId): void;
  /** The disc color behind each piece, so you see your token as it will be on the board. */
  color?: string;
}

/** The pieces to play as, one button each. */
export function PiecePicker({ value, onPick, color }: Props) {
  const { tr } = useLang();
  return (
    <div className="pieces" role="radiogroup" aria-label={tr.t('yourPiece')}>
      {PLAYER_PIECES.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={p.id === value}
          aria-label={tr.t(PIECE_LABELS[p.id])}
          title={tr.t(PIECE_LABELS[p.id])}
          className={`piece ${p.id === value ? 'is-on' : ''}`}
          style={color && p.id === value ? { background: color } : undefined}
          onClick={() => onPick(p.id)}
        >
          {p.emoji}
        </button>
      ))}
    </div>
  );
}
