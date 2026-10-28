import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useLang } from '../../../i18n/LangProvider';
import { ownsWholeRua, ruaPositions } from '../assets';
import { BOARD, JAIL_POS, RUAS } from '../board';
import type { RuaId } from '../board';
import type { BairroView } from '../view';
import { RUA_COLORS } from './geometry';
import { money } from './text';
import { useBairroText } from './useBairroText';

interface Props {
  view: BairroView;
  names: string[];
  /** CSS color per seat. */
  colors: string[];
  onOpenSquare(pos: number): void;
}

/** Everyone's money and status, then one player's escrituras by rua: yours, or whoever you tap in the list. */
export function PlayersPanel({ view, names, colors, onOpenSquare }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  const [shown, setShown] = useState(view.you);
  const owned = (seat: number) => Object.values(view.owned).filter(o => o.owner === seat).length;
  const mine = (positions: number[]) => positions.filter(p => view.owned[p]?.owner === shown);
  const ruas = (Object.keys(RUAS) as RuaId[]).map(rua => ({ rua, positions: mine(ruaPositions(rua)) })).filter(g => g.positions.length > 0);
  const servicos = mine(BOARD.flatMap((sq, i) => (sq.kind === 'servico' ? [i] : [])));

  const deedsTitle = shown === view.you ? text.ui('yourDeeds') : text.ui('theirDeeds', { name: names[shown] || text.ui('ownerFallback') });

  const deed = (pos: number) => {
    const own = view.owned[pos]!;
    return (
      <li key={pos}>
        <button type="button" className={`bdeed ${own.mortgaged ? 'bdeed--mortgaged' : ''}`} onClick={() => onOpenSquare(pos)}>
          <span>{text.square(pos)}</span>
          {own.houses > 0 && (
            <span className="bdeed__houses" aria-label={own.houses === 5 ? text.ui('predio') : text.ui(own.houses === 1 ? 'houseOne' : 'houses', { n: own.houses })}>
              {own.houses === 5 ? '▮' : '⌂'.repeat(own.houses)}
            </span>
          )}
          {own.mortgaged && <span className="muted">{text.ui('mortgagedTag')}</span>}
        </button>
      </li>
    );
  };

  return (
    <aside className="bpanel">
      <section className="panel bpanel__box" aria-label={text.ui('players')}>
        <h2>{text.ui('players')}</h2>
        {view.players.length > 1 && <p className="muted bplayers__hint">{text.ui('playersHint')}</p>}
        <ul className="bplayers">
          {view.players.map((p, i) => {
            const n = owned(i);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={`bplayer ${i === view.current ? 'is-current' : ''} ${p.bankrupt ? 'is-bankrupt' : ''} ${i === shown ? 'is-shown' : ''}`}
                  style={{ '--player': colors[i] } as CSSProperties}
                  aria-pressed={i === shown}
                  onClick={() => setShown(i)}
                >
                  <span className="bdot" aria-hidden="true" />
                  <span className="bplayer__name">
                    {i === view.you ? <b>{names[i]}</b> : names[i]}
                    {i === view.you && <span className="muted"> ({text.ui('youTag')})</span>}
                  </span>
                  {p.bankrupt ? (
                    <span className="bplayer__tag">{text.ui('bankruptTag')}</span>
                  ) : (
                    <>
                      <span className="bplayer__cash">{money(tr.lang, p.cash)}</span>
                      <span className="bplayer__meta">
                        <span className="muted">{n === 1 ? text.ui('deedOne') : text.ui('deeds', { n })}</span>
                        {p.jailTurns !== null && <span className="bplayer__tag">{text.square(JAIL_POS)}</span>}
                      </span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="panel bpanel__box" aria-label={deedsTitle}>
        <h2>{deedsTitle}</h2>
        {ruas.length === 0 && servicos.length === 0 && <p className="muted">{text.ui('noDeeds')}</p>}
        {ruas.map(({ rua, positions }) => (
          <div key={rua} className="bdeeds">
            <h3>
              <span className="bswatch" style={{ backgroundColor: RUA_COLORS[rua] }} aria-hidden="true" />
              {text.rua(rua)}
              {ownsWholeRua(view, shown, rua) && <span className="bdeeds__whole" title={text.ui('wholeRua')}>✓ <span className="sr-only">{text.ui('wholeRua')}</span></span>}
            </h3>
            <ul>{positions.map(deed)}</ul>
          </div>
        ))}
        {servicos.length > 0 && (
          <div className="bdeeds">
            <h3>{text.ui('servicos')}</h3>
            <ul>{servicos.map(deed)}</ul>
          </div>
        )}
      </section>
    </aside>
  );
}
