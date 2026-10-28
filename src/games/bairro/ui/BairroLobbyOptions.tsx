import type { HostSession } from '../../../net/host';
import type { LobbyState } from '../../../net/protocol';
import { bairroModule } from '../module';
import type { BairroOptions } from '../module';
import { useBairroText } from './useBairroText';

interface Props {
  lobby: LobbyState;
  host: HostSession | null;
}

/** The Dono do Bairro's lobby settings: a switch for the host, the chosen setting for guests. */
export function BairroLobbyOptions({ lobby, host }: Props) {
  const text = useBairroText();
  const parsed = bairroModule.parseOptions(lobby.options);
  const options: BairroOptions = 'error' in parsed ? bairroModule.defaultOptions() : parsed;

  return (
    <div className="bsetting">
      {host ? (
        <label className="bsetting__switch">
          <input type="checkbox" checked={options.openTrades} onChange={e => host.setOptions({ ...options, openTrades: e.target.checked })} />
          <span>{text.ui('lobbyOpenTrades')}</span>
        </label>
      ) : (
        <b>{text.ui(options.openTrades ? 'lobbyOpenTradesOn' : 'lobbyOpenTradesOff')}</b>
      )}
      <span className="zone__hint">{text.ui('lobbyOpenTradesHint')}</span>
    </div>
  );
}
