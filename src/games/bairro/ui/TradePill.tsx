import { useBairroText } from './useBairroText';

/** In a trade window: tucks it away so the board shows; the pill brings it back. */
export function HideButton({ onHide }: { onHide(): void }) {
  const text = useBairroText();
  return (
    <button type="button" onClick={onHide}>
      {text.ui('tradeHide')}
    </button>
  );
}

/** While a trade window is tucked away: a pill at the bottom of the screen that shows it again. */
export function TradePill({ onShow }: { onShow(): void }) {
  const text = useBairroText();
  return (
    <button type="button" className="btradepill" onClick={onShow}>
      <span aria-hidden="true">🤝</span> {text.ui('tradeHidden')} · <b>{text.ui('tradeShow')}</b>
    </button>
  );
}
