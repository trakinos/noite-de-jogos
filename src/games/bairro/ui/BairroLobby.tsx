import { useState } from 'react';
import type { HostSession } from '../../../net/host';
import type { LobbyState } from '../../../net/protocol';
import type { PlayerColorId } from '../../../theme/playerColors';
import { Lobby } from '../../../ui/screens/Lobby';
import { BairroRules } from './BairroRules';

interface Props {
  lobby: LobbyState;
  me: string;
  code: string;
  shareLink: string;
  host: HostSession | null;
  onSetColor(color: PlayerColorId): void;
  onLeave(): void;
}

/** The shared Lobby with Dono do Bairro's rulebook behind the Rules button. */
export function BairroLobby(props: Props) {
  const [rules, setRules] = useState(false);
  return (
    <>
      <Lobby {...props} onRules={() => setRules(true)} />
      {rules && <BairroRules onClose={() => setRules(false)} />}
    </>
  );
}
