import type { HostSession } from '../../../net/host';
import type { LobbyState } from '../../../net/protocol';
import { HAND_MAX } from '../deck';
import { BAIRRO_THEMES } from '../i18n/themes';
import { bairroModule } from '../module';
import type { BairroOptions } from '../module';
import { useBairroText } from './useBairroText';

interface Props {
  lobby: LobbyState;
  host: HostSession | null;
}

/** The on/off table rules, each with its label and hint keys. */
const RULES = [
  { key: 'auctionDeclined', label: 'lobbyAuctionDeclined', hint: 'lobbyAuctionDeclinedHint' },
  { key: 'skills', label: 'lobbySkills', hint: 'lobbySkillsHint' },
  { key: 'pocketCards', label: 'lobbyPocketCards', hint: 'lobbyPocketCardsHint' },
] as const;

/** The Dono do Bairro's lobby settings, the theme, open trades and the table rules: controls for the host, the chosen settings for guests. */
export function BairroLobbyOptions({ lobby, host }: Props) {
  const text = useBairroText();
  const parsed = bairroModule.parseOptions(lobby.options);
  const options: BairroOptions = 'error' in parsed ? bairroModule.defaultOptions() : parsed;

  return (
    <>
      <div className="bsetting">
        {host ? (
          <label className="bsetting__select">
            <span>{text.ui('lobbyTheme')}</span>
            <select value={options.theme} onChange={e => host.setOptions({ ...options, theme: e.target.value })}>
              {BAIRRO_THEMES.map(t => (
                <option key={t} value={t}>
                  {text.ui(`theme_${t}`)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <b>
            {text.ui('lobbyTheme')}: {text.ui(`theme_${options.theme}`)}
          </b>
        )}
        <span className="zone__hint">{text.ui(`themeHint_${options.theme}`)}</span>
      </div>
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
      {RULES.map(rule => (
        <div key={rule.key} className="bsetting">
          {host ? (
            <label className="bsetting__switch">
              <input type="checkbox" checked={options[rule.key]} onChange={e => host.setOptions({ ...options, [rule.key]: e.target.checked })} />
              <span>{text.ui(rule.label)}</span>
            </label>
          ) : (
            <b>{text.ui(options[rule.key] ? 'lobbyOn' : 'lobbyOff', { name: text.ui(rule.label) })}</b>
          )}
          <span className="zone__hint">{text.ui(rule.hint, { max: HAND_MAX })}</span>
        </div>
      ))}
    </>
  );
}
