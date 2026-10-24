import { useEffect } from 'react';
import type { CardId } from '../../engine/types';
import { useLang } from '../../i18n/LangProvider';
import { RULES, RULES_CARDS } from '../../i18n/rules';
import { Chips } from './Card';
import { splitRuleText } from '../../theme';
import { Icon } from './Icon';

interface Props {
  /** The game's Kingdom cards, listed with their rule text. Omitted outside a game. */
  kingdom?: CardId[];
  onClose(): void;
}

/** The rulebook: a short guide to Dominion's rules in the Feira theme's words. */
export function RulesDialog({ kingdom, onClose }: Props) {
  const { tr, lang } = useLang();
  const names = Object.fromEntries(RULES_CARDS.map((id) => [id, tr.card(id)]));
  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (m, id: string) => names[id] ?? m);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={tr.t('rulesTitle')} onClick={onClose}>
      <div className="prompt rules panel" onClick={(e) => e.stopPropagation()}>
        <header className="rules__head">
          <span className="rules__ic">
            <Icon name="book" />
          </span>
          <h2>{tr.t('rulesTitle')}</h2>
          <button type="button" className="rules__close" autoFocus onClick={onClose} aria-label={tr.t('close')}>
            <Icon name="x" />
          </button>
        </header>
        {RULES[lang].map((section) => (
          <section key={section.title} className="rules__section">
            <h3>{fill(section.title)}</h3>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{fill(item)}</li>
              ))}
            </ul>
          </section>
        ))}
        {kingdom && kingdom.length > 0 && (
          <section className="rules__section">
            <h3>{tr.t('rulesKingdom')}</h3>
            <dl className="rules__cards">
              {kingdom.map((id) => {
                const { chips, rest } = splitRuleText(tr.cardText(id));
                return (
                  <div key={id}>
                    <dt>{tr.card(id)}</dt>
                    <dd>
                      <Chips chips={chips} />
                      {rest}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
