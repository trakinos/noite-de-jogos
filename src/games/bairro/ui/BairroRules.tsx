import { useLang } from '../../../i18n/LangProvider';
import { BOARD, JAIL_FINE, MORTGAGE_INTEREST, PASS_START, START_MONEY } from '../board';
import { HAND_MAX } from '../deck';
import { BICHEIRO_BONUS, PRACINHA_BONUS } from '../skills';
import { MAX_COUNTERS, MAX_TRADES_PER_TURN } from '../trades';
import { BairroDialog } from './BairroDialog';
import { RULES_LAYOUT } from './rulesLayout';
import { money } from './text';
import { useBairroText } from './useBairroText';

/** The numbers the rules text quotes, straight from the game's constants. */
function ruleParams(lang: 'pt' | 'en'): Record<string, string | number> {
  const $ = (n: number) => money(lang, n);
  const amount = (kind: 'iptu' | 'bolao') => BOARD.flatMap(s => (s.kind === kind ? [s.amount] : []))[0] ?? 0;
  const mults = BOARD.flatMap(s => (s.kind === 'servico' ? [s.multiplier] : []));
  return {
    startMoney: $(START_MONEY), passStart: $(PASS_START), jailFine: $(JAIL_FINE),
    iptu: $(amount('iptu')), bolao: $(amount('bolao')),
    multLow: Math.min(...mults), multHigh: Math.max(...mults),
    interest: Math.round(MORTGAGE_INTEREST * 100), maxTrades: MAX_TRADES_PER_TURN, maxCounters: MAX_COUNTERS,
    pracinhaBonus: $(PRACINHA_BONUS), bicheiroBonus: $(BICHEIRO_BONUS), handMax: HAND_MAX,
  };
}

/** The rulebook for Dono do Bairro, from the `rules` section of the bairro dictionary. */
export function BairroRules({ onClose }: { onClose(): void }) {
  const { tr, lang } = useLang();
  const text = useBairroText();
  const params = ruleParams(lang);
  const say = (key: string) => text.rule(key, params);
  return (
    <BairroDialog title={tr.t('rules')} onClose={onClose} className="brules">
      {RULES_LAYOUT.map(section => (
        <section key={section.title} className="rules__section">
          <h3>{say(section.title)}</h3>
          <ul>
            {section.items.map(item => (
              <li key={item}>{say(item)}</li>
            ))}
          </ul>
        </section>
      ))}
    </BairroDialog>
  );
}
