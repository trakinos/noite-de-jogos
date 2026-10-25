import { useState, type ReactNode } from 'react';
import { TURN_TIMER_OPTIONS, type HostSession } from '../../net/host';
import type { LobbyState } from '../../net/protocol';
import { useLang } from '../../i18n/LangProvider';
import { colorHex, type PlayerColorId } from '../../theme/playerColors';
import { Avatar } from '../components/Avatar';
import { ColorPicker } from '../components/ColorPicker';
import { Icon } from '../components/Icon';

interface Props {
  lobby: LobbyState;
  me: string;
  code: string;
  shareLink: string;
  host: HostSession | null;
  onSetColor(color: PlayerColorId): void;
  onLeave(): void;
  /** The game's own options section, below the turn timer. */
  options?: ReactNode;
  /** Opens the game's rulebook; the Rules button is hidden without it. */
  onRules?: () => void;
  /** Extra readiness the game's options impose on Start: whether it's met, what to tell the host if not, and a summary line. */
  startGate?: { ready: boolean; notReady: string; summary: string };
}

export function Lobby({ lobby, me, code, shareLink, host, onSetColor, onLeave, options, onRules, startGate }: Props) {
  const { tr } = useLang();
  const [startError, setStartError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the link stays visible in the field to copy by hand.
    }
  }

  function start() {
    if (!host) return;
    const result = host.start();
    setStartError(result.ok ? null : result.reason);
  }

  const enoughPlayers = lobby.players.length >= lobby.minPlayers;
  const optionsReady = startGate ? startGate.ready : true;
  const canStart = enoughPlayers && optionsReady;
  const openSeats = Math.max(0, lobby.maxPlayers - lobby.players.length);
  return (
    <main className="screen lobby">
      <header className="lobby__header">
        <h1>{tr.t('room', { code })}</h1>
        {onRules && (
          <button type="button" className="rules-btn" onClick={onRules} title={tr.t('rules')}>
            <Icon name="book" />
            <span>{tr.t('rules')}</span>
          </button>
        )}
        <button type="button" onClick={onLeave}>
          <Icon name="door" />
          {tr.t('leave')}
        </button>
      </header>

      <div className="lobby__grid">
        <div className="lobby__side">
          <section className="panel">
            <h2>{tr.t('invite')}</h2>
            <p>{tr.t('inviteBlurb', { code })}</p>
            <div className="share">
              <input readOnly value={shareLink} onFocus={(e) => e.currentTarget.select()} aria-label={tr.t('shareLink')} />
              <button type="button" className="primary" onClick={copy}>
                <Icon name={copied ? 'check' : 'copy'} />
                {copied ? tr.t('copied') : tr.t('copyLink')}
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="picker__bar" style={{ marginBottom: 0 }}>
              <h2>{tr.t('players')}</h2>
              <span className="picker__count" style={{ marginLeft: 'auto' }}>
                {lobby.players.length}/{lobby.maxPlayers}
              </span>
            </div>
            <ul className="seats">
              {lobby.players.map((p) => (
                <li key={p.id} className={p.id === me ? 'is-me' : ''}>
                  <Avatar name={p.name} color={colorHex(p.color)} />
                  <span className="seats__name">{p.name}</span>
                  {p.id === lobby.hostId && <span className="pill">{tr.t('hostTag')}</span>}
                  {p.id === me && <span className="pill pill--accent">{tr.t('youTag')}</span>}
                  <span className="seats__status">
                    <span className={`dot ${p.online ? 'dot--on' : ''}`} />
                    {p.online ? tr.t('online') : tr.t('offline')}
                  </span>
                  {p.id === me && (
                    <ColorPicker
                      value={p.color}
                      taken={lobby.players.filter((o) => o.id !== me).map((o) => o.color)}
                      onPick={onSetColor}
                    />
                  )}
                </li>
              ))}
              {Array.from({ length: openSeats }, (_, i) => (
                <li key={`open-${i}`} className="is-empty">
                  <span className="seats__ghost" />
                  {tr.t('emptySeat')}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="panel">
          <div className="timer-setting">
            <Icon name="clock" />
            <label htmlFor="turn-timer">{tr.t('turnTimer')}</label>
            {host ? (
              <select
                id="turn-timer"
                value={lobby.turnTimer ?? ''}
                onChange={(e) => host.setTurnTimer(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">{tr.t('timerOff')}</option>
                {TURN_TIMER_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {tr.t('timerSeconds', { n: s })}
                  </option>
                ))}
              </select>
            ) : (
              <b id="turn-timer">{lobby.turnTimer === null ? tr.t('timerOff') : tr.t('timerSeconds', { n: lobby.turnTimer })}</b>
            )}
            {/* Only Dominion has attack responses with their own clock. */}
            {lobby.turnTimer !== null && lobby.game === 'dominion' && <span className="zone__hint">{tr.t('timerHint')}</span>}
          </div>
          {options}
        </section>
      </div>

      {host ? (
        <div className="startbar">
          <div className="startbar__info">
            <strong>{canStart ? tr.t('readyToStart') : !enoughPlayers ? tr.t('needPlayer') : startGate?.notReady}</strong>
            {startGate && <span>{startGate.summary}</span>}
            {startError && <span className="error">{tr.reason(startError)}</span>}
          </div>
          <button type="button" className="primary lg" disabled={!canStart} onClick={start}>
            <Icon name="play" />
            {tr.t('startGame')}
          </button>
        </div>
      ) : (
        <div className="banner">
          <Icon name="clock" />
          {tr.t('waitingHostStart')}
        </div>
      )}
    </main>
  );
}
