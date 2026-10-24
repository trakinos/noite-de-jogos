import { useEffect, useRef, useState } from 'react';
import { describePeerError } from '../net/errors';
import { joinLink } from '../net/roomCode';
import { useLang } from '../i18n/LangProvider';
import { Centered } from './components/Centered';
import { hostGame, joinGame, type ActiveSession } from './connect';
import { Board } from './screens/Board';
import { EndScreen } from './screens/EndScreen';
import { FrontPage } from './screens/FrontPage';
import { Lobby } from './screens/Lobby';
import { Icon } from './components/Icon';
import { LangToggle } from './components/LangToggle';
import { Loader } from './components/Loader';
import { entryAction } from './entry';
import { loadName, saveName } from './storage';
import { useGuestState } from './useGuestState';

export function App() {
  const { tr } = useLang();
  const [active, setActive] = useState<ActiveSession | null>(null);
  // Computed once: StrictMode re-runs effects, but never re-runs a state initializer's result.
  const [entry] = useState(() => entryAction(location.hash, loadName()));
  const [busy, setBusy] = useState(entry.kind === 'autoJoin');
  // True only while the invite-link auto-join is in flight; a later manual join uses the normal busy state.
  const [autoJoining, setAutoJoining] = useState(entry.kind === 'autoJoin');
  // Code to prefill in the front page's join row: an invite, or a join that just failed or was refused.
  const [invitedCode, setInvitedCode] = useState<string | null>(entry.kind === 'invited' ? entry.code : null);
  const [error, setError] = useState<string | null>(null);
  const autoJoined = useRef(false);
  const state = useGuestState(active?.session ?? null);

  // A refused join (room full, game in progress) sends the player back to the home screen.
  useEffect(() => {
    if (state?.status !== 'rejected') return;
    setError(state.error);
    if (active) setInvitedCode(active.code);
    active?.close();
    setActive(null);
    // Don't let a refresh retry a dead room.
    history.replaceState(null, '', location.pathname);
  }, [state?.status]);

  // An invite link with a saved name joins straight away, exactly once.
  useEffect(() => {
    if (entry.kind !== 'autoJoin' || autoJoined.current) return;
    autoJoined.current = true;
    const { code, name } = entry;
    void connect(name, () => joinGame(code, name), code).finally(() => setAutoJoining(false));
  }, []);

  // Closing the host's tab ends the game for everyone, so ask first.
  useEffect(() => {
    if (!active?.host) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    // pagehide tears the peer down cleanly so guests see the host leave right away.
    const leave = () => active.close();
    window.addEventListener('beforeunload', warn);
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('pagehide', leave);
    };
  }, [active]);

  async function connect(name: string, open: () => Promise<ActiveSession>, retryCode?: string) {
    saveName(name);
    setBusy(true);
    setError(null);
    try {
      setActive(await open());
    } catch (err) {
      setError(describePeerError(err));
      if (retryCode) setInvitedCode(retryCode);
      history.replaceState(null, '', location.pathname);
    } finally {
      setBusy(false);
    }
  }

  function leave() {
    active?.close();
    setActive(null);
    setError(null);
    setInvitedCode(null);
    history.replaceState(null, '', location.pathname);
  }

  function renderScreen() {
    if (entry.kind === 'autoJoin' && autoJoining && !active) {
      return (
        <Centered>
          <Loader />
          <h2>{tr.t('joiningRoom', { code: entry.code })}</h2>
        </Centered>
      );
    }

    if (!active || !state || state.status === 'rejected') {
      return (
        <FrontPage
          initialName={loadName()}
          invitedCode={invitedCode}
          busy={busy}
          error={state?.status === 'rejected' ? state.error : error}
          onHost={(_game, name) => connect(name, () => hostGame(name))}
          onJoin={(code, name) =>
            connect(name, async () => {
              const session = await joinGame(code, name);
              history.replaceState(null, '', `#join=${code}`);
              return session;
            })
          }
        />
      );
    }

    // Only guests reach this: the host's own connection is in-memory and never drops.
    if (state.status === 'disconnected') {
      const code = active.code;
      const name = loadName();
      return (
        <Centered>
          <div className="sig" aria-hidden="true">
            <Icon name="wifiOff" />
          </div>
          <h1>{tr.t('connectionLost')}</h1>
          <p className="muted">{tr.t('connectionLostBody')}</p>
          {error && (
            <p className="error" role="alert">
              {tr.reason(error)}
            </p>
          )}
          <div className="actions actions--center">
            <button type="button" className="primary" disabled={busy} onClick={() => {
                active.close();
                void connect(name, () => joinGame(code, name));
              }}>
              <Icon name="refresh" />
              {busy ? tr.t('rejoining') : tr.t('rejoin')}
            </button>
            <button type="button" disabled={busy} onClick={leave}>
              {tr.t('backToStart')}
            </button>
          </div>
        </Centered>
      );
    }

    if (state.status === 'connecting' || !state.lobby || !state.playerId) {
      return (
        <Centered>
          <Loader />
          <h2>{tr.t('joiningRoom', { code: active.code })}</h2>
        </Centered>
      );
    }

    if (!state.lobby.inGame) {
      return (
        <Lobby
          lobby={state.lobby}
          me={state.playerId}
          code={active.code}
          shareLink={joinLink(location.origin + location.pathname, active.code)}
          host={active.host}
          onSetColor={(c) => active.session.setColor(c)}
          onLeave={leave}
        />
      );
    }

    if (!state.view) {
      return (
        <Centered>
          <Loader />
          <h2>{tr.t('startingGame')}</h2>
        </Centered>
      );
    }

    if (state.view.result) {
      return (
        <EndScreen
          result={state.view.result}
          lobby={state.lobby}
          isHost={active.host !== null}
          onPlayAgain={() => active.host?.playAgain()}
          onBackToLobby={() => active.host?.backToLobby()}
          onLeave={leave}
        />
      );
    }

    return (
      <Board
        view={state.view}
        lobby={state.lobby}
        code={active.code}
        error={state.error}
        clock={state.clock}
        onIntent={(intent) => active.session.sendIntent(intent)}
        onDismissError={() => active.session.dismissError()}
        onEndGame={active.host ? () => active.host?.backToLobby() : undefined}
      />
    );
  }

  return (
    <>
      <LangToggle />
      {renderScreen()}
    </>
  );
}
