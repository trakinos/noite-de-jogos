import { useLang } from '../../../i18n/LangProvider';
import { Centered } from '../../../ui/components/Centered';
import { Icon } from '../../../ui/components/Icon';
import { BAIRRO_DICTIONARIES } from '../i18n';

/** Placeholder until the Dono do Bairro board lands. */
export function BairroScreens({ onLeave }: { onLeave(): void }) {
  const { tr, lang } = useLang();
  return (
    <Centered>
      <h2>{BAIRRO_DICTIONARIES[lang].ui.underConstruction}</h2>
      <div className="actions actions--center">
        <button type="button" onClick={onLeave}>
          <Icon name="door" />
          {tr.t('leave')}
        </button>
      </div>
    </Centered>
  );
}
