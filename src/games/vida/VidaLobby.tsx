import { useGameText } from '../shared/GameFrame';
import { SimpleLobby, type LobbyProps } from '../shared/SimpleLobby';
import { vidaModule, type LengthOption } from './game';
import { RULE_KEYS, VIDA_TEXT } from './text';

const LENGTHS: readonly LengthOption[] = ['auto', 'normal', 'short'];

/** The shared lobby with Vida Adulta's one setting: how long a life lasts. */
export function VidaLobby(props: LobbyProps) {
  const t = useGameText(VIDA_TEXT);
  const parsed = vidaModule.parseOptions(props.lobby.options);
  const length = 'error' in parsed ? 'auto' : parsed.length;
  const options = (
    <div className="bsetting">
      {props.host ? (
        <label className="bsetting__select">
          <span>{t('lobbyLength')}</span>
          <select value={length} onChange={e => props.host!.setOptions({ length: e.target.value })}>
            {LENGTHS.map(l => (
              <option key={l} value={l}>
                {t(`length_${l}`)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <b>
          {t('lobbyLength')}: {t(`length_${length}`)}
        </b>
      )}
    </div>
  );
  return <SimpleLobby {...props} options={options} rules={{ game: 'vida', title: t('rulesTitle'), paragraphs: RULE_KEYS.map(k => t(k)) }} />;
}
