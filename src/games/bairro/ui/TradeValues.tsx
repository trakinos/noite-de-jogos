import { useLang } from '../../../i18n/LangProvider';
import type { OfferSide } from '../types';
import type { BairroView } from '../view';
import { money } from './text';
import { assetValue, sideValue } from './trade';
import { useBairroText } from './useBairroText';

/** An escritura's price in a trade, with what lifting its mortgage costs when it has one. */
export function AssetPrice({ view, pos }: { view: BairroView; pos: number }) {
  const { tr } = useLang();
  const text = useBairroText();
  const v = assetValue(view, pos);
  const amount = money(tr.lang, v.price);
  return (
    <small className={`btrade__price${v.lift === null ? '' : ' is-mortgaged'}`}>
      {v.lift === null ? amount : text.ui('tradeLift', { amount, lift: money(tr.lang, v.lift) })}
    </small>
  );
}

export function SideTotal({ view, side }: { view: BairroView; side: OfferSide }) {
  const { tr } = useLang();
  const text = useBairroText();
  return <p className="btrade__total">{text.ui('tradeTotal', { amount: money(tr.lang, sideValue(view, side)) })}</p>;
}

/** How the trade adds up for you, on paper: what you get less what you give. */
export function TradeBalance({ view, give, get }: { view: BairroView; give: OfferSide; get: OfferSide }) {
  const { tr } = useLang();
  const text = useBairroText();
  const diff = sideValue(view, get) - sideValue(view, give);
  const amount = money(tr.lang, Math.abs(diff));
  const [key, tone] = diff > 0 ? ['tradeAhead', 'ahead'] : diff < 0 ? ['tradeBehind', 'behind'] : ['tradeEven', 'even'];
  return (
    <div className={`btrade__balance btrade__balance--${tone}`} aria-live="polite">
      <p>{text.ui(key, { amount })}</p>
      <small className="muted">{text.ui('tradeValueNote')}</small>
    </div>
  );
}
