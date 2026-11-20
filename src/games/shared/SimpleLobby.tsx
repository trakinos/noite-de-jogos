import { useState, type ReactNode } from 'react';
import type { HostSession } from '../../net/host';
import type { LobbyState } from '../../net/protocol';
import type { PlayerColorId } from '../../theme/playerColors';
import type { PlayerPieceId } from '../../theme/playerPieces';
import { Lobby } from '../../ui/screens/Lobby';
import { RulesSheet } from './GameFrame';

export interface LobbyProps {
  lobby: LobbyState;
  me: string;
  code: string;
  shareLink: string;
  host: HostSession | null;
  onSetColor(color: PlayerColorId): void;
  onSetPiece(piece: PlayerPieceId): void;
  onLeave(): void;
}

/** The shared Lobby with a game's own settings and its rules sheet behind the Rules button. */
export function SimpleLobby({ rules, options, ...props }: LobbyProps & { rules: { title: string; paragraphs: string[]; game?: string }; options?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Lobby {...props} options={options} onRules={() => setOpen(true)} />
      {open && <RulesSheet {...rules} onClose={() => setOpen(false)} />}
    </>
  );
}
