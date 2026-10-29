import type { BairroIntent } from '../types';
import type { BairroView } from '../view';
import { BairroLog } from './BairroLog';
import { BOARD_SIZE, ringFacing, ringGridArea } from './geometry';
import { PlayersPanel } from './PlayersPanel';
import { Cigarette } from './Cigarette';
import { Pracinha } from './Pracinha';
import { Square } from './Square';
import { withPositions } from './motion';
import { squareInfo } from './squareInfo';
import { useBairroText } from './useBairroText';

const POSITIONS = Array.from({ length: BOARD_SIZE }, (_, p) => p);

export interface LayoutProps {
  /** What the board shows: it waits for the dice, the walk and its scenes (see useBoardMotion). */
  view: BairroView;
  /** The latest view, for the dice. */
  live: BairroView;
  /** True while the dice, a walk or a scene is under way: no buttons until it ends. */
  moving: boolean;
  names: string[];
  /** CSS color per seat. */
  colors: string[];
  /** Each seat's piece (an emoji), or undefined in a room from before pieces. */
  pieces: (string | undefined)[];
  awaiting: boolean;
  onIntent(intent: BairroIntent): void;
  onOpenSquare(pos: number): void;
  onTrade(): void;
  /** Where each seat's token is drawn right now (see useBoardMotion). */
  positions: number[];
}

/** The computer board: the bairro seen from above, a road around the ring and the Pracinha in the middle. */
export function MapBoard({ view, live, moving, names, colors, pieces, awaiting, onIntent, onOpenSquare, onTrade, positions }: LayoutProps) {
  const text = useBairroText();
  const drawn = withPositions(view, positions);
  return (
    <div className="bmap">
      <div className="bmap__ring">
        {POSITIONS.map(pos => (
          <div key={pos} className="bmap__cell" style={ringGridArea(pos)}>
            <Square info={squareInfo(drawn, pos)} size="ring" colors={colors} pieces={pieces} names={names} current={view.current} facing={ringFacing(pos)} onOpen={onOpenSquare} />
          </div>
        ))}
        <div className="bmap__park">
          <Cigarette />
          <Pracinha view={view} live={live} moving={moving} names={names} awaiting={awaiting} onIntent={onIntent} onTrade={onTrade} />
        </div>
      </div>
      <div className="bmap__side">
        <PlayersPanel view={view} names={names} colors={colors} pieces={pieces} onOpenSquare={onOpenSquare} />
        <section className="panel bpanel__box" aria-label={text.ui('log')}>
          <h2>{text.ui('log')}</h2>
          <BairroLog entries={view.log} total={view.logTotal} names={names} />
        </section>
      </div>
    </div>
  );
}
