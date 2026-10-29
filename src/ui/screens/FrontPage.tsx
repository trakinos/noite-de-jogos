import { useState } from 'react';
import { GAMES, type GameId } from '../../games/catalog';
import { MAX_NAME_LENGTH } from '../../net/protocol';
import { useLang } from '../../i18n/LangProvider';
import { CODE_LENGTH, normalizeRoomCode } from '../../net/roomCode';
import { Icon } from '../components/Icon';
import { PiecePicker } from '../components/PiecePicker';
import { PLAYER_PIECES, pieceEmoji, type PlayerPieceId } from '../../theme/playerPieces';
import { loadPiece, savePiece } from '../storage';

/** The saved piece, or a random one saved now, so a first visit already has a token with a shape. */
function initialPiece(): PlayerPieceId {
  const saved = loadPiece();
  if (saved) return saved;
  const piece = PLAYER_PIECES[Math.floor(Math.random() * PLAYER_PIECES.length)]!.id;
  savePiece(piece);
  return piece;
}

interface Props {
  initialName: string;
  invitedCode: string | null;
  busy: boolean;
  error: string | null;
  onHost(game: GameId, name: string): void;
  onJoin(code: string, name: string): void;
}

export function FrontPage({ initialName, invitedCode, busy, error, onHost, onJoin }: Props) {
  const { tr } = useLang();
  const [name, setName] = useState(initialName);
  const [piece, setPiece] = useState(initialPiece);
  const pick = (p: PlayerPieceId) => {
    setPiece(p);
    savePiece(p);
  };
  const [code, setCode] = useState(invitedCode ?? '');
  // A saved name shows as a line; an invite puts the name field up front so it can be checked.
  const [editingName, setEditingName] = useState(initialName.trim() === '' || invitedCode !== null);
  const cleanCode = normalizeRoomCode(code);
  return (
    <main className="screen front">
      <header>
        <h1 className="front__title">{tr.t('siteName')}</h1>
        <p className="front__tagline">{tr.t('siteTagline')}</p>
      </header>

      {editingName ? (
        <div className="front__me">
          <label className="field front__name">
            {tr.t('yourName')}
            <input
              value={name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr.t('namePlaceholder')}
              autoFocus={invitedCode !== null}
            />
          </label>
          <div className="field front__piece">
            <span>{tr.t('yourPiece')}</span>
            <PiecePicker value={piece} onPick={pick} />
          </div>
        </div>
      ) : (
        <p className="front__who">
          {tr.t('yourNameIs')} <b>{name.trim() || tr.t('namePlaceholder')}</b> <span aria-hidden="true">{pieceEmoji(piece)}</span> ·{' '}
          <button type="button" className="link" onClick={() => setEditingName(true)}>
            {tr.t('changeName')}
          </button>
        </p>
      )}

      {invitedCode !== null && <h2 className="front__invited">{tr.t('invitedFrontTitle', { code: invitedCode })}</h2>}

      <section className="front__row">
        <div className="front__art front__art--join" aria-hidden="true">
          <Icon name="door" />
        </div>
        <div className="front__text">
          <b>{tr.t('joinRowTitle')}</b>
          <span className="muted">{tr.t('joinRowBlurb')}</span>
        </div>
        <form
          className="front__join"
          onSubmit={(e) => {
            e.preventDefault();
            if (cleanCode && !busy) onJoin(cleanCode, name);
          }}
        >
          <input
            className="input--code"
            value={code}
            maxLength={CODE_LENGTH}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD"
            aria-label={tr.t('roomCode')}
            autoCapitalize="characters"
            aria-invalid={error ? true : undefined}
          />
          <button type="submit" className={invitedCode !== null ? 'primary' : ''} disabled={busy || !cleanCode}>
            {tr.t('joinButton')}
          </button>
        </form>
      </section>

      <h2 className="front__label">{tr.t('createRoomTitle')}</h2>
      {GAMES.map((game) => (
        <section key={game.id} className={`front__row ${game.available ? '' : 'front__row--soon'}`}>
          <div className={`front__art front__art--${game.id}`} aria-hidden="true" />
          <div className="front__text">
            <b>{tr.t(game.nameKey)}</b>
            <span className="muted">
              {tr.t(game.tagKey)} · {tr.t('playersRange', { min: game.minPlayers, max: game.maxPlayers })} · {tr.t(game.lengthKey)}
            </span>
          </div>
          {game.available ? (
            <button type="button" className="primary" disabled={busy} onClick={() => onHost(game.id, name)}>
              {tr.t('createButton')}
            </button>
          ) : (
            <>
              <span className="pill">{tr.t('comingSoon')}</span>
              {import.meta.env.DEV && (
                <button type="button" disabled={busy} onClick={() => onHost(game.id, name)}>
                  Criar (dev)
                </button>
              )}
            </>
          )}
        </section>
      ))}

      {busy && <p className="front__status muted">{tr.t('connecting')}</p>}
      {error && (
        <p className="err front__status" role="alert">
          <Icon name="alert" />
          {tr.reason(error)}
        </p>
      )}
    </main>
  );
}
