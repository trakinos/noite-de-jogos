import type { CSSProperties } from 'react';
import { BOARD_SIZE, ringGridArea } from './geometry';
import { squareInfo } from './squareInfo';
import { useBairroText } from './useBairroText';
import type { BairroView } from '../view';

const POSITIONS = Array.from({ length: BOARD_SIZE }, (_, p) => p);

interface Props {
  view: BairroView;
  /** CSS color per seat. */
  colors: string[];
  onPick(pos: number): void;
}

/** The whole ring in miniature, each cell in its rua's color; your token's cell is outlined. */
export function MiniMap({ view, colors, onPick }: Props) {
  const text = useBairroText();
  const mine = view.players[view.you]?.pos;
  return (
    <div className="bmini">
      {POSITIONS.map(pos => {
        const info = squareInfo(view, pos);
        const style: CSSProperties = { ...ringGridArea(pos), ...(info.ruaColor ? { backgroundColor: info.ruaColor } : {}) };
        const others = info.tokens.filter(i => i !== view.you);
        return (
          <button
            key={pos}
            type="button"
            className={`bmini__cell${pos === mine ? ' is-you' : ''}${info.ruaColor ? '' : ' bmini__cell--plain'}`}
            style={style}
            data-sq={pos}
            aria-label={text.square(pos)}
            onClick={() => onPick(pos)}
          >
            {others.length > 0 && <span className="bmini__dot" style={{ backgroundColor: colors[others[0]!] }} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
