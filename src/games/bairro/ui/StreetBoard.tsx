import { useLayoutEffect, useRef, useState } from 'react';
import { useLang } from '../../../i18n/LangProvider';
import { Icon } from '../../../ui/components/Icon';
import { BairroDialog } from './BairroDialog';
import { BairroLog } from './BairroLog';
import { BOARD_SIZE } from './geometry';
import type { LayoutProps } from './MapBoard';
import { MiniMap } from './MiniMap';
import { withPositions } from './motion';
import { PlayersPanel } from './PlayersPanel';
import { Pracinha } from './Pracinha';
import { Square } from './Square';
import { squareInfo } from './squareInfo';
import { money } from './text';
import { useBairroText } from './useBairroText';

const POSITIONS = Array.from({ length: BOARD_SIZE }, (_, p) => p);

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The phone board: a mini-map, the street in focus as a snapping row, the Pracinha and a players summary. */
export function StreetBoard({ view, names, colors, awaiting, onIntent, onOpenSquare, onTrade, positions }: LayoutProps) {
  const { tr } = useLang();
  const text = useBairroText();
  const strip = useRef<HTMLDivElement>(null);
  const [sheet, setSheet] = useState(false);
  const [logSheet, setLogSheet] = useState(false);
  const drawn = withPositions(view, positions);
  // The strip follows your token as it walks.
  const myPos = positions[view.you] ?? 0;

  function center(pos: number, instant: boolean) {
    const row = strip.current;
    const el = row?.children[pos] as HTMLElement | undefined;
    if (!row || !el) return;
    const left = el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2;
    row.scrollTo({ left, behavior: instant || reducedMotion() ? 'auto' : 'smooth' });
  }

  // First paint lands on your square at once; later moves glide there.
  const mounted = useRef(false);
  useLayoutEffect(() => {
    center(myPos, !mounted.current);
    mounted.current = true;
  }, [myPos]);

  const me = view.players[view.you];
  const others = view.players.flatMap((p, i) => (i === view.you ? [] : [{ p, i }]));

  return (
    <div className="bstreet">
      <MiniMap view={view} colors={colors} onPick={pos => center(pos, false)} />
      <div className="bstrip" ref={strip} role="group" aria-label={text.ui('streetStrip')}>
        {POSITIONS.map(pos => (
          <Square key={pos} info={squareInfo(drawn, pos)} size="strip" colors={colors} names={names} onOpen={onOpenSquare} />
        ))}
      </div>
      <Pracinha view={view} names={names} awaiting={awaiting} onIntent={onIntent} onTrade={onTrade} compact />
      <div className="bline">
      <button type="button" className="bsummary" aria-label={text.ui('playersSheet')} onClick={() => setSheet(true)}>
        {me && (
          <span className="bsummary__me">
            <b>{money(tr.lang, me.cash)}</b>
          </span>
        )}
        {others.map(({ p, i }) => (
          <span key={p.id} className={`bsummary__other${p.bankrupt ? ' is-bankrupt' : ''}`}>
            <span className="bdot" style={{ ['--player' as string]: colors[i] }} aria-hidden="true" />
            {p.bankrupt ? text.ui('bankruptTag') : money(tr.lang, p.cash)}
          </span>
        ))}
        <Icon name="more" />
      </button>
      <button type="button" className="blog-btn" aria-label={text.ui('logSheet')} title={text.ui('logSheet')} onClick={() => setLogSheet(true)}>
        <Icon name="book" />
      </button>
      </div>
      {sheet && (
        <BairroDialog title={text.ui('players')} onClose={() => setSheet(false)}>
          <PlayersPanel
            view={view}
            names={names}
            colors={colors}
            onOpenSquare={pos => {
              setSheet(false);
              onOpenSquare(pos);
            }}
          />
        </BairroDialog>
      )}
      {logSheet && (
        <BairroDialog title={text.ui('log')} onClose={() => setLogSheet(false)}>
          <BairroLog entries={view.log} total={view.logTotal} names={names} />
        </BairroDialog>
      )}
    </div>
  );
}
