import type { BairroIntent } from '../types';
import type { BairroView } from '../view';
import { BOARD_SIZE, ringGridArea } from './geometry';
import { PlayersPanel } from './PlayersPanel';
import { Pracinha } from './Pracinha';
import { Square } from './Square';
import { squareInfo } from './squareInfo';

const POSITIONS = Array.from({ length: BOARD_SIZE }, (_, p) => p);

export interface LayoutProps {
  view: BairroView;
  names: string[];
  /** CSS color per seat. */
  colors: string[];
  awaiting: boolean;
  onIntent(intent: BairroIntent): void;
  onOpenSquare(pos: number): void;
  onTrade(): void;
}

/** The computer board: the bairro seen from above, a road around the ring and the Pracinha in the middle. */
export function MapBoard({ view, names, colors, awaiting, onIntent, onOpenSquare, onTrade }: LayoutProps) {
  return (
    <div className="bmap">
      <div className="bmap__ring">
        {POSITIONS.map(pos => (
          <div key={pos} className="bmap__cell" style={ringGridArea(pos)}>
            <Square info={squareInfo(view, pos)} size="ring" colors={colors} names={names} onOpen={onOpenSquare} />
          </div>
        ))}
        <div className="bmap__park">
          <Pracinha view={view} names={names} awaiting={awaiting} onIntent={onIntent} onTrade={onTrade} />
        </div>
      </div>
      <PlayersPanel view={view} names={names} colors={colors} onOpenSquare={onOpenSquare} />
    </div>
  );
}
