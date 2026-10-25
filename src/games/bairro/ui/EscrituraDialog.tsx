import { useLang } from '../../../i18n/LangProvider';
import type { BairroIntent } from '../types';
import type { BairroView } from '../view';
import { BairroDialog } from './BairroDialog';
import { escrituraFor } from './escritura';
import type { EscrituraButtonId, RentRow } from './escritura';
import { RUA_COLORS } from './geometry';
import { money } from './text';
import { useBairroText } from './useBairroText';

const INTENTS: Record<EscrituraButtonId, 'build' | 'sellBuilding' | 'mortgage' | 'unmortgage'> = {
  build: 'build', sell: 'sellBuilding', mortgage: 'mortgage', unmortgage: 'unmortgage',
};

interface Props {
  view: BairroView;
  pos: number;
  names: string[];
  awaiting: boolean;
  onIntent(intent: BairroIntent): void;
  onClose(): void;
}

/** A ponto's or serviço's escritura: price, rent table, and your build / sell / mortgage buttons. */
export function EscrituraDialog({ view, pos, names, awaiting, onIntent, onClose }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  const e = escrituraFor(view, pos);
  if (!e) return null;
  const $ = (n: number) => money(tr.lang, n);

  const rowLabel = (r: RentRow) =>
    r.label === 'base' ? text.ui('escBase') : r.label === 'predio' ? text.ui('predio')
    : r.label === '1' ? text.ui('houseOne') : text.ui('houses', { n: r.label });
  const buttonLabel = (id: EscrituraButtonId, amount: number) => {
    const key = id === 'build' ? (e.houses === 4 ? 'btnBuildPredio' : 'btnBuild')
      : id === 'sell' ? 'btnSell' : id === 'mortgage' ? 'btnMortgage' : 'btnUnmortgage';
    return text.ui(key, { amount: $(amount) });
  };
  const ownerName = e.owner === null ? null : (names[e.owner] || text.ui('ownerFallback'));
  const color = e.rua ? RUA_COLORS[e.rua] : null;

  return (
    <BairroDialog title={text.square(pos)} onClose={onClose} className="besc">
      {color && <div className="besc__awning" style={{ backgroundColor: color }} aria-hidden="true" />}
      <p className="besc__meta">
        {e.rua && <span>{text.rua(e.rua)}</span>}
        <span>{text.ui('escPrice', { amount: $(e.price) })}</span>
        <span>{ownerName ? text.ui('escOwner', { name: ownerName }) : text.ui('forSale')}</span>
      </p>
      {e.mortgaged && <p className="besc__note"><b>{text.ui('mortgagedTag')}</b>. {text.ui('escMortgaged')}</p>}

      {e.servico ? (
        <>
          <table className="besc__rent">
            <caption>{text.ui('escRent')}</caption>
            <tbody>
              <tr className={e.owner !== null && !e.servico.doubled ? 'is-current' : ''}>
                <th scope="row">{text.ui('servicoRule', { mult: e.servico.multiplier })}</th>
                <td>{e.owner !== null && !e.servico.doubled ? text.ui('escNow') : ''}</td>
              </tr>
              <tr className={e.servico.doubled ? 'is-current' : ''}>
                <th scope="row">{text.ui('servicoDouble')}</th>
                <td>{e.servico.doubled ? text.ui('escNow') : ''}</td>
              </tr>
            </tbody>
          </table>
          <p className="besc__note muted">{text.ui('servicoNote', { mult: e.servico.multiplier })}</p>
        </>
      ) : (
        <table className="besc__rent">
          <caption>{text.ui('escRent')}</caption>
          <tbody>
            {e.rentRows.map(r => (
              <tr key={r.label} className={r.current ? 'is-current' : ''} aria-current={r.current ? 'true' : undefined}>
                <th scope="row">
                  {rowLabel(r)}
                  {r.doubled && <span className="muted"> ({text.ui('escDoubled')})</span>}
                </th>
                <td>
                  {$(r.amount)}
                  {r.current && <span className="besc__now"> {text.ui('escNow')}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="besc__meta muted">
        {e.houseCost !== null && <span>{text.ui('escHouseCost', { amount: $(e.houseCost) })}</span>}
        <span>{text.ui('escMortgageValue', { amount: $(e.mortgage) })}</span>
      </p>

      {e.buttons.length > 0 && (
        <div className="besc__actions">
          {e.buttons.map(b => (
            <div key={b.id} className="besc__action">
              <button
                type="button"
                className={b.id === 'build' ? 'primary' : ''}
                disabled={!b.enabled || awaiting}
                onClick={() => onIntent({ type: INTENTS[b.id], pos })}
              >
                {buttonLabel(b.id, b.amount)}
              </button>
              {b.reason && <small className="besc__reason">{text.reason(b.reason)}</small>}
            </div>
          ))}
        </div>
      )}
    </BairroDialog>
  );
}
