import { useState } from 'react';
import type { GameId } from '../../catalog';
import type { HostSession } from '../../../net/host';
import type { LobbyState } from '../../../net/protocol';
import type { PlayerColorId } from '../../../theme/playerColors';
import type { PlayerPieceId } from '../../../theme/playerPieces';
import { Lobby } from '../../../ui/screens/Lobby';
import { BairroLobbyOptions } from './BairroLobbyOptions';
import { BairroRules } from './BairroRules';
import { roomTheme } from './roomTheme';
import { BairroThemeContext } from './useBairroText';

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
}

/** The shared Lobby with Dono do Bairro's settings and its rulebook (in the room's theme) behind the Rules button. */
export function BairroLobby(props: Props) {
  const [rules, setRules] = useState(false);
  return (
    <BairroThemeContext.Provider value={roomTheme(props.lobby)}>
      <Lobby {...props} options={<BairroLobbyOptions lobby={props.lobby} host={props.host} />} onRules={() => setRules(true)} />
      {rules && <BairroRules onClose={() => setRules(false)} />}
    </BairroThemeContext.Provider>
  );
}
