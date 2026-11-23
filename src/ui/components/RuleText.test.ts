import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { emphasize } from './RuleText';

const marked = (text: string) =>
  emphasize(text)
    .filter((n): n is ReactElement<{ className: string; children: string }> => typeof n !== 'string')
    .map((n) => [n.props.className, n.props.children]);

describe('emphasize', () => {
  it('marks discard and trash words in English', () => {
    expect(marked('Trash a card. Each other player discards the rest.')).toEqual([
      ['kw kw--trash', 'Trash'],
      ['kw kw--discard', 'discards'],
    ]);
  });

  it('marks discard and trash words in Portuguese', () => {
    expect(marked('Coloque uma carta no lixo e descarte o resto.')).toEqual([
      ['kw kw--trash', 'no lixo'],
      ['kw kw--discard', 'descarte'],
    ]);
  });

  it('leaves other text alone', () => {
    expect(emphasize('Gain a Gold.')).toEqual(['Gain a Gold.']);
  });
});
