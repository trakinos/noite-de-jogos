import type { BairroIntent } from '../types';
import type { BairroView } from '../view';
import { BairroLog } from './BairroLog';
import { BOARD_SIZE, ringGridArea } from './geometry';
import { PlayersPanel } from './PlayersPanel';
import { Pracinha } from './Pracinha';
import { Square } from './Square';
import { withPositions } from './motion';
import { squareInfo } from './squareInfo';
import { useBairroText } from './useBairroText';

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
  /** Where each seat's token is drawn right now (see useDisplayedPositions). */
  positions: number[];
}

/** The computer board: the bairro seen from above, a road around the ring and the Pracinha in the middle. */
export function MapBoard({ view, names, colors, awaiting, onIntent, onOpenSquare, onTrade, positions }: LayoutProps) {
  const text = useBairroText();
  const drawn = withPositions(view, positions);
  return (
    <div className="bmap">
      <div className="bmap__ring">
        {POSITIONS.map(pos => (
          <div key={pos} className="bmap__cell" style={ringGridArea(pos)}>
            <Square info={squareInfo(drawn, pos)} size="ring" colors={colors} names={names} onOpen={onOpenSquare} />
          </div>
        ))}
        <div className="bmap__park">
          <Pracinha view={view} names={names} awaiting={awaiting} onIntent={onIntent} onTrade={onTrade} />
        </div>
      </div>
      <div className="bmap__side">
        <PlayersPanel view={view} names={names} colors={colors} onOpenSquare={onOpenSquare} />
        <section className="panel bpanel__box" aria-label={text.ui('log')}>
          <h2>{text.ui('log')}</h2>
          <BairroLog entries={view.log} total={view.logTotal} names={names} />
        </section>
      </div>
    </div>
  );
}
