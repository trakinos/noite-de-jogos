import type { LobbyState } from '../../../net/protocol';
import type { BairroTheme } from '../i18n/themes';
import { bairroModule } from '../module';

/** The theme the room was set up with. */
export function roomTheme(lobby: LobbyState): BairroTheme {
  const parsed = bairroModule.parseOptions(lobby.options);
  return 'error' in parsed ? 'bairro' : parsed.theme;
}
