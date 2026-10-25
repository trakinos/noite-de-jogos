import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLang } from '../../../i18n/LangProvider';
import { Icon } from '../../../ui/components/Icon';

interface Props {
  title: string;
  onClose(): void;
  children: ReactNode;
  className?: string;
}

/** The shared Bairro dialog: overlay, labelled title, Escape and the close button, focus back to the opener on close. */
export function BairroDialog({ title, onClose, children, className = '' }: Props) {
  const { tr } = useLang();
  const titleId = useId();
  // Read while rendering, before the dialog takes focus.
  const opener = useRef<Element | null>(typeof document === 'undefined' ? null : document.activeElement);
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
      const el = opener.current;
      if (el instanceof HTMLElement && el.isConnected) el.focus();
    };
  }, []);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
      <div className={`prompt panel bsheet ${className}`} onClick={e => e.stopPropagation()}>
        <div className="bsheet__head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" ref={closeButton} onClick={onClose} aria-label={tr.t('close')}>
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
