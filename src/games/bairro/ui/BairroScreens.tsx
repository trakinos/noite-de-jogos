import { useEffect, useState } from 'react';
import type { LobbyState } from '../../../net/protocol';
import { BairroBoard } from './BairroBoard';
import type { BairroBoardProps } from './BairroBoard';
import { BairroEnd } from './BairroEnd';
import { BairroRules } from './BairroRules';

type Props = Omit<BairroBoardProps, 'onRules'> & {
  lobby: LobbyState;
  isHost: boolean;
  onPlayAgain(): void;
  onBackToLobby(): void;
  onLeave(): void;
};

/** The Dono do Bairro screens once a game is running: the board with its rulebook, then the end screen. */
export function BairroScreens({ isHost, onPlayAgain, onBackToLobby, onLeave, ...board }: Props) {
  const [rules, setRules] = useState(false);
  // Close the rulebook when a game ends or restarts, so it can't reappear over the next board.
  useEffect(() => setRules(false), [board.view.winner]);
  if (board.view.winner !== null) {
    return <BairroEnd view={board.view} lobby={board.lobby} isHost={isHost} onPlayAgain={onPlayAgain} onBackToLobby={onBackToLobby} onLeave={onLeave} />;
  }
  return (
    <>
      <BairroBoard {...board} onRules={() => setRules(true)} />
      {rules && <BairroRules onClose={() => setRules(false)} />}
    </>
  );
}
