import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLang } from '../../../i18n/LangProvider';
import { Icon } from '../../../ui/components/Icon';

interface Props {
  title: string;
  onClose(): void;
  children: ReactNode;
  className?: string;
  /** Where focus goes on close; defaults to whatever had focus when the dialog opened. */
  returnFocus?: HTMLElement | null;
  /** False: Escape, the backdrop and the close button do nothing, and the button is not shown. */
  dismissable?: boolean;
  /** Tucked away to show the board: still mounted (nothing typed is lost) but not drawn, and Escape skips it. */
  hidden?: boolean;
}

/** Open dialogs, oldest first: only the last one answers Escape. */
const open: symbol[] = [];
/** The element focus was last handed back to: the fallback when an opener has unmounted (deed button in a closing sheet). */
let lastRestored: HTMLElement | null = null;

const focusable = (el: Element | null | undefined): el is HTMLElement => el instanceof HTMLElement && el.isConnected;

/** The shared Bairro dialog: overlay, labelled title, Escape and the close button, focus back to the opener on close. */
export function BairroDialog({ title, onClose, children, className = '', returnFocus, dismissable = true, hidden = false }: Props) {
  const { tr } = useLang();
  const titleId = useId();
  // Read while rendering, before the dialog takes focus.
  const opener = useRef<Element | null>(returnFocus ?? (typeof document === 'undefined' ? null : document.activeElement));
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pressedBackdrop = useRef(false);
  const latest = useRef({ onClose, dismissable, hidden });
  latest.current = { onClose, dismissable, hidden };

  useEffect(() => {
    const me = Symbol('dialog');
    open.push(me);
    // Without a close button, the panel itself takes focus so the keyboard starts inside the dialog.
    (closeButton.current ?? panel.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open.at(-1) === me && latest.current.dismissable && !latest.current.hidden) latest.current.onClose();
    };
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
      open.splice(open.indexOf(me), 1);
      const target = [opener.current, lastRestored, document.querySelector('main')].find(focusable);
      if (target) {
        target.focus();
        if (target === opener.current) lastRestored = target;
      }
    };
  }, []);

  const onBackdrop = (down: boolean) => (e: { target: unknown; currentTarget: unknown }) => {
    if (down) pressedBackdrop.current = e.target === e.currentTarget;
    else {
      const hit = pressedBackdrop.current && e.target === e.currentTarget;
      pressedBackdrop.current = false;
      if (hit && latest.current.dismissable) latest.current.onClose();
    }
  };

  return (
    <div className={`overlay${hidden ? ' is-hidden' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={onBackdrop(true)} onClick={onBackdrop(false)}>
      <div ref={panel} tabIndex={-1} className={`prompt panel bsheet ${className}`}>
        <div className="bsheet__head">
          <h2 id={titleId}>{title}</h2>
          {dismissable && (
            <button type="button" ref={closeButton} onClick={onClose} aria-label={tr.t('close')}>
              <Icon name="x" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
