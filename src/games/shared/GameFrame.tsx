import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLang } from '../../i18n/LangProvider';
import { interpolate, type Params } from '../../i18n';
import type { LocalClock } from '../../net/guest';
import type { LobbyState } from '../../net/protocol';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { Icon } from '../../ui/components/Icon';
import { TimerBar } from '../../ui/components/TimerBar';

/** What App hands every newer game's screens. */
export interface GameScreenProps {
  view: unknown;
  lobby: LobbyState;
  me: string;
  code: string;
  error: string | null;
  clock: LocalClock | null;
  awaiting: boolean;
  onIntent(intent: unknown): void;
  onDismissError(): void;
  onEndGame?: () => void;
  isHost: boolean;
  onPlayAgain(): void;
  onBackToLobby(): void;
  onLeave(): void;
}

export type Texts = { pt: Record<string, string>; en: Record<string, string> };
export type TextFn = (key: string, params?: Params) => string;

/** A game's own strings in the current language; a missing English line falls back to Portuguese, then the key. */
export function useGameText(texts: Texts): TextFn {
  const { tr } = useLang();
  const d = texts[tr.lang];
  return (key, params) => interpolate(d[key] ?? texts.pt[key] ?? key, params);
}

const TOAST_MS = 4000;

interface FrameProps {
  title: string;
  code: string;
  clock: LocalClock | null;
  error: string | null;
  /** Translates a refusal from the host. */
  reason(text: string): string;
  onDismissError(): void;
  onEndGame?: () => void;
  onRules?: () => void;
  className?: string;
  children: ReactNode;
}

/** The header (name, room, timer, rules, end-game menu), the error toast and the page around a game's board. */
export function GameFrame({ title, code, clock, error, reason, onDismissError, onEndGame, onRules, className, children }: FrameProps) {
  const { tr } = useLang();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(onDismissError, TOAST_MS);
    return () => clearTimeout(timer);
  }, [error]);

  return (
    <main className={`screen gframe ${className ?? ''}`}>
      <header className="gframe__top">
        <div className="brand">
          {title}
          <span className="room">{code}</span>
        </div>
        {clock && <TimerBar clock={clock} />}
        {onRules && (
          <button type="button" className="rules-btn" onClick={onRules} title={tr.t('rules')}>
            <Icon name="book" />
            <span>{tr.t('rules')}</span>
          </button>
        )}
        {onEndGame && (
          <details className="menu" ref={menu}>
            <summary aria-label={tr.t('moreOptions')} title={tr.t('moreOptions')}>
              <Icon name="more" />
            </summary>
            <div className="menu__list">
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (menu.current) menu.current.open = false;
                  setConfirmEnd(true);
                }}
              >
                <Icon name="x" />
                {tr.t('endGame')}…
              </button>
            </div>
          </details>
        )}
      </header>

      {children}

      {error && (
        <div className="toast gframe__toast" role="alert">
          <span className="toast__ic">
            <Icon name="alert" />
          </span>
          <span>{reason(error)}</span>
          <button type="button" onClick={onDismissError} aria-label={tr.t('dismiss')}>
            <Icon name="x" />
          </button>
        </div>
      )}

      {confirmEnd && onEndGame && (
        <ConfirmDialog
          title={tr.t('endGameTitle')}
          body={tr.t('endGameConfirm')}
          cancel={tr.t('keepPlaying')}
          confirm={tr.t('endGame')}
          onCancel={() => setConfirmEnd(false)}
          onConfirm={() => {
            setConfirmEnd(false);
            onEndGame();
          }}
        />
      )}
    </main>
  );
}

/** Play again / back to lobby for the host, a waiting line for guests, and Leave for everyone. */
export function EndActions({ isHost, onPlayAgain, onBackToLobby, onLeave, playAgain }: {
  isHost: boolean;
  onPlayAgain(): void;
  onBackToLobby(): void;
  onLeave(): void;
  playAgain: string;
}) {
  const { tr } = useLang();
  return (
    <div className="actions actions--center">
      {isHost ? (
        <>
          <button type="button" className="primary lg" onClick={onPlayAgain}>
            <Icon name="refresh" />
            {playAgain}
          </button>
          <button type="button" className="lg" onClick={onBackToLobby}>
            {tr.t('backToLobby')}
          </button>
        </>
      ) : (
        <span className="muted">{tr.t('waitingHost')}</span>
      )}
      <button type="button" className="ghost lg" onClick={onLeave}>
        <Icon name="door" />
        {tr.t('leave')}
      </button>
    </div>
  );
}

/** A rules sheet over the game: a title and paragraphs, each paragraph a text key. */
export function RulesSheet({ title, paragraphs, onClose }: { title: string; paragraphs: string[]; onClose(): void }) {
  const { tr } = useLang();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="panel gframe__rules" onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <div className="actions actions--center">
          <button type="button" className="primary" autoFocus onClick={onClose}>
            {tr.t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A host refusal in the game's own words when it has them, else the site's. */
export function useReason(t: TextFn): (text: string) => string {
  const { tr } = useLang();
  return text => {
    const key = `reason:${text}`;
    const own = t(key);
    return own === key ? tr.reason(text) : own;
  };
}
