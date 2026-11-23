import { useState, type ReactNode } from 'react';
import { TURN_TIMER_OPTIONS, type HostSession } from '../../net/host';
import type { LobbyState } from '../../net/protocol';
import { GAMES, type GameId } from '../../games/catalog';
import { moduleFor } from '../../games/registry';
import { useLang } from '../../i18n/LangProvider';
import { colorHex, type PlayerColorId } from '../../theme/playerColors';
import { pieceEmoji, type PlayerPieceId } from '../../theme/playerPieces';
import { Avatar } from '../components/Avatar';
import { ColorPicker } from '../components/ColorPicker';
import { PiecePicker } from '../components/PiecePicker';
import { Icon } from '../components/Icon';

interface Props {
  lobby: LobbyState;
  me: string;
  code: string;
  shareLink: string;
  host: HostSession | null;
  onSetColor(color: PlayerColorId): void;
  onSetPiece(piece: PlayerPieceId): void;
  /** Casts or clears this player's vote for the next game. */
  onVote?(game: GameId | null): void;
  onLeave(): void;
  /** The game's own options section, below the turn timer. */
  options?: ReactNode;
  /** Opens the game's rulebook; the Rules button is hidden without it. */
  onRules?: () => void;
  /** Extra readiness the game's options impose on Start: whether it's met, what to tell the host if not, and a summary line. */
  startGate?: { ready: boolean; notReady: string; summary: string };
}

export function Lobby({ lobby, me, code, shareLink, host, onSetColor, onSetPiece, onVote, onLeave, options, onRules, startGate }: Props) {
  const { tr } = useLang();
  const [startError, setStartError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const voteGames = GAMES.filter((g) => g.available && g.maxPlayers >= lobby.players.length);
  const myVote = lobby.players.find((p) => p.id === me)?.vote ?? null;
  const [pickGame, setPickGame] = useState<GameId>(myVote ?? voteGames.find((g) => g.id !== lobby.game)?.id ?? lobby.game);
  const votes = voteGames.map((g) => ({ g, count: lobby.players.filter((p) => p.vote === g.id).length })).filter((v) => v.count > 0);

  function changeGame(id: string) {
    if (!host) return;
    const game = GAMES.find((g) => g.id === id);
    if (!game) return;
    const result = host.setGame(moduleFor(game.id));
    setGameError(result.ok ? null : result.reason);
    if (result.ok) setStartError(null);
  }

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
        <div className="lobby__title">
          <h1>{tr.t('room', { code })}</h1>
          <p className="lobby__game" aria-live="polite">
            {tr.t('game')}: <b>{tr.t(GAMES.find((g) => g.id === lobby.game)?.nameKey ?? 'gameDominionName')}</b>
          </p>
        </div>
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

          {onVote && (
            <section className="panel">
              <h2>{tr.t('voteTitle')}</h2>
              <p className="zone__hint">{tr.t('voteHint')}</p>
              <div className="timer-setting">
                <select aria-label={tr.t('voteTitle')} value={pickGame} onChange={(e) => setPickGame(e.target.value as GameId)}>
                  {voteGames.map((g) => (
                    <option key={g.id} value={g.id}>
                      {tr.t(g.nameKey)}
                    </option>
                  ))}
                </select>
                <button type="button" className="primary" disabled={myVote === pickGame} onClick={() => onVote(pickGame)}>
                  {tr.t('voteSuggest')}
                </button>
                {myVote && (
                  <button type="button" className="ghost" onClick={() => onVote(null)}>
                    {tr.t('voteClear')}
                  </button>
                )}
              </div>
              {votes.length > 0 && (
                <ul className="seats">
                  {votes.map(({ g, count }) => (
                    <li key={g.id} className={g.id === myVote ? 'is-me' : ''}>
                      <span className="seats__name">{tr.t(g.nameKey)}</span>
                      {g.id === lobby.game && <span className="pill">{tr.t('game')}</span>}
                      <span className="pill pill--accent">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

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
                  <Avatar name={p.name} color={colorHex(p.color)} piece={pieceEmoji(p.piece)} />
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
                  {p.id === me && <PiecePicker value={p.piece} color={colorHex(p.color)} onPick={onSetPiece} />}
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
          {host && (
            <div className="timer-setting">
              <label htmlFor="game-pick">{tr.t('game')}</label>
              <select id="game-pick" value={lobby.game} onChange={(e) => changeGame(e.target.value)}>
                {GAMES.filter((g) => g.available).map((g) => (
                  <option key={g.id} value={g.id}>
                    {tr.t(g.nameKey)}
                  </option>
                ))}
              </select>
              {gameError && <span className="error">{tr.reason(gameError)}</span>}
            </div>
          )}
          {!host && (
            <div className="timer-setting">
              <label>{tr.t('game')}</label>
              <b>{tr.t(GAMES.find((g) => g.id === lobby.game)?.nameKey ?? 'gameDominionName')}</b>
            </div>
          )}
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
