import type { Card, Color } from './game';

const SYMBOL: Partial<Record<Card['value'], string>> = { skip: '⊘', rev: '⇄', draw2: '+2', wild: '★', wild4: '+4', swap: '🤝' };

export function CardFace({ card, small, color }: { card: Card; small?: boolean; color?: Color }) {
  const sym = SYMBOL[card.value] ?? card.value;
  const shown = card.color ?? color ?? null;
  return (
    <span className={`zcard zcard--${card.color ?? 'wild'}${small ? ' is-small' : ''}${shown && !card.color ? ` shows-${shown}` : ''}`}>
      <span className="zcard__corner">{sym}</span>
      <span className="zcard__mid">{sym}</span>
      <span className="zcard__corner zcard__corner--end">{sym}</span>
      {/* A 9 starts a tapping race: the finger reminds whoever plays it that everyone must tap. */}
      {card.value === '9' && (
        <span className="zcard__tap" aria-hidden="true">
          👆
        </span>
      )}
    </span>
  );
}
