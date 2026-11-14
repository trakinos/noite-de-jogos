import { useEffect, useState } from 'react';
import { useLang } from '../../i18n/LangProvider';

const DISMISS_KEY = 'ndj-install-dismissed';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

function standalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** How to put the site on the home screen: Android's own install prompt, or the Share-menu steps on iPhone. Hidden once installed or dismissed. */
export function InstallHint() {
  const { tr } = useLang();
  const pt = tr.lang === 'pt';
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(() => standalone() || dismissed());
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);

  useEffect(() => {
    const capture = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', capture);
    return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);

  if (hidden || (!prompt && !ios)) return null;
  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Not remembered; it just shows again next time.
    }
  };
  return (
    <div className="install banner banner--info" role="note">
      <span aria-hidden="true">📲</span>
      <span>
        {ios
          ? pt
            ? 'Use como app: toque em Compartilhar e depois em “Adicionar à Tela de Início”.'
            : 'Use it as an app: tap Share, then “Add to Home Screen”.'
          : pt
            ? 'Instale a Noite de Jogos como app no seu celular.'
            : 'Install Noite de Jogos as an app on your phone.'}
      </span>
      {prompt && (
        <button type="button" className="primary banner__action" onClick={() => void prompt.prompt().then(close)}>
          {pt ? 'Instalar' : 'Install'}
        </button>
      )}
      <button type="button" className="banner__close" onClick={close} aria-label={tr.t('dismiss')}>
        ✕
      </button>
    </div>
  );
}
