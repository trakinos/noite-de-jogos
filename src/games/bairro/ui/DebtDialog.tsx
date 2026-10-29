import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../../i18n/LangProvider';
import { ConfirmDialog } from '../../../ui/components/ConfirmDialog';
import type { BairroIntent } from '../types';
import type { BairroView } from '../view';
import { actionsFor } from './actions';
import { BairroDialog } from './BairroDialog';
import { escrituraFor } from './escritura';
import { money } from './text';
import { useBairroText } from './useBairroText';

interface Props {
  view: BairroView;
  names: string[];
  awaiting: boolean;
  onIntent(intent: BairroIntent): void;
}

type RaiseId = 'sell' | 'mortgage';
const pickKey = (id: RaiseId, pos: number) => `${id}:${pos}`;
const intentOf = (id: RaiseId, pos: number): BairroIntent => (id === 'sell' ? { type: 'sellBuilding', pos } : { type: 'mortgage', pos });

/**
 * Opens by itself while you owe: what you owe, to whom, and the ways out. It can't be dismissed.
 * You tick what to sell or mortgage and confirm, so one stray tap can't mortgage the wrong escritura;
 * the picks are then sent one by one, as the host answers each.
 */
export function DebtDialog({ view, names, awaiting, onIntent }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  const [confirmBust, setConfirmBust] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [queue, setQueue] = useState<BairroIntent[]>([]);
  const bustButton = useRef<HTMLButtonElement>(null);
  const $ = (n: number) => money(tr.lang, n);

  // Escape closes only the confirmation; the dialog under it ignores it.
  useEffect(() => {
    if (!confirmBust) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setConfirmBust(false);
      bustButton.current?.focus();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [confirmBust]);

  const mine = view.debts.filter(d => d.debtor === view.you);
  const total = mine.reduce((sum, d) => sum + d.amount, 0);
  const cash = view.players[view.you]?.cash ?? 0;
  const raisers = Object.keys(view.owned).map(Number).sort((a, b) => a - b).flatMap(pos => {
    const buttons = escrituraFor(view, pos)?.buttons.filter(b => (b.id === 'sell' || b.id === 'mortgage') && b.enabled) ?? [];
    return buttons.length > 0 ? [{ pos, buttons }] : [];
  });
  // Only picks that are still on offer count; the list changes as each sale or mortgage lands.
  const offered = raisers.flatMap(({ pos, buttons }) => buttons.map(b => ({ key: pickKey(b.id as RaiseId, pos), id: b.id as RaiseId, pos, amount: b.amount })));
  const chosen = offered.filter(o => picked.includes(o.key));
  const raised = chosen.reduce((sum, o) => sum + o.amount, 0);
  const sending = queue.length > 0;
  const toggle = (key: string) => setPicked(p => (p.includes(key) ? p.filter(k => k !== key) : [...p, key]));

  // Send the confirmed picks one at a time: the guest drops an intent while another is in flight.
  useEffect(() => {
    if (awaiting || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    onIntent(next!);
  }, [awaiting, queue]);

  const confirm = () => {
    // Buildings first: a rua's escrituras can only be mortgaged once its buildings are gone.
    const order = [...chosen].sort((a, b) => (a.id === b.id ? 0 : a.id === 'sell' ? -1 : 1));
    setQueue(order.map(o => intentOf(o.id, o.pos)));
    setPicked([]);
  };

  const actions = actionsFor(view, awaiting || sending);
  const pay = actions.find(a => a.id === 'payDebt');
  const bust = actions.find(a => a.id === 'goBankrupt');
  const creditor = (c: number | null) => (c === null ? text.term('prefeitura') : names[c] || text.ui('ownerFallback'));

  return (
    <BairroDialog title={text.ui('debtTitle')} onClose={() => undefined} dismissable={false} className="bdebt">
      <ul className="bdebt__list">
        {mine.map((d, i) => (
          <li key={i}>
            <b>{$(d.amount)}</b> {text.ui('debtOwesTo', { to: creditor(d.creditor) })}
          </li>
        ))}
      </ul>
      <p className="besc__meta">
        <span>{text.ui('debtTotal', { amount: $(total) })}</span>
        <span>{text.ui('debtCash', { amount: $(cash) })}</span>
      </p>

      <h3 className="bdebt__sub">{text.ui('debtRaise')}</h3>
      {raisers.length === 0 ? (
        <p className="muted">{text.ui('debtRaiseNone')}</p>
      ) : (
        <>
          <p className="muted">{text.ui('debtPick')}</p>
          <ul className="bdebt__assets">
            {raisers.map(({ pos, buttons }) => (
              <li key={pos}>
                <span className="bdebt__name">{text.square(pos)}</span>
                {buttons.map(b => {
                  const key = pickKey(b.id as RaiseId, pos);
                  return (
                    <label key={b.id} className={`bdebt__pick${picked.includes(key) ? ' is-picked' : ''}`}>
                      <input type="checkbox" checked={picked.includes(key)} disabled={awaiting || sending} onChange={() => toggle(key)} />
                      <span>{text.ui(b.id === 'sell' ? 'btnSell' : 'btnMortgage', { amount: $(b.amount) })}</span>
                    </label>
                  );
                })}
              </li>
            ))}
          </ul>
          {chosen.length > 0 && (
            <div className="bdebt__tally" aria-live="polite">
              <span>{text.ui('debtSelected', { amount: $(raised) })}</span>
              <span>
                {text.ui('debtAfter', { amount: $(cash + raised) })}
                {' · '}
                {cash + raised >= total ? text.ui('debtEnough') : text.ui('debtShort', { amount: $(total - cash - raised) })}
              </span>
            </div>
          )}
          <div className="besc__actions">
            <button type="button" className="primary" disabled={awaiting || sending || chosen.length === 0} onClick={confirm}>
              {text.ui('debtConfirm', { amount: $(raised) })}
            </button>
          </div>
        </>
      )}

      <div className="besc__actions">
        {pay && (
          <button type="button" className="primary" disabled={!pay.enabled} onClick={() => pay.intent && onIntent(pay.intent)}>
            {text.ui(pay.label, { amount: $(pay.amount ?? 0) })}
          </button>
        )}
        {bust && (
          <button type="button" className="danger" ref={bustButton} disabled={!bust.enabled} onClick={() => setConfirmBust(true)}>
            {text.ui(bust.label)}
          </button>
        )}
      </div>

      {confirmBust && (
        <ConfirmDialog
          title={text.ui('bankruptTitle')}
          body={text.ui('bankruptBody')}
          cancel={text.ui('bankruptCancel')}
          confirm={text.ui('actGoBankrupt')}
          onCancel={() => {
            setConfirmBust(false);
            bustButton.current?.focus();
          }}
          onConfirm={() => {
            setConfirmBust(false);
            onIntent({ type: 'goBankrupt' });
          }}
        />
      )}
    </BairroDialog>
  );
}
