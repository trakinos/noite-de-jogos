import { BairroBoard } from './BairroBoard';
import type { BairroBoardProps } from './BairroBoard';

/** The Dono do Bairro screens once a game is running. The board stays up after a win until the end screen lands. */
export function BairroScreens(props: BairroBoardProps) {
  return <BairroBoard {...props} />;
}
