import type { Lang } from './types';

/**
 * The in-game rulebook (RulesDialog). Card names are placeholders such as {province},
 * filled in with the themed name of that card in the reader's language.
 */
export interface RulesSection {
  title: string;
  items: string[];
}

export const RULES: Record<Lang, RulesSection[]> = {
  pt: [
    {
      title: 'Objetivo',
      items: [
        'Tenha mais pontos de vitória (PV) que todo mundo quando a partida acabar.',
        'Cartas de Vitória valem pontos: {estate} 1 PV, {duchy} 3 PV, {province} 6 PV. Cada {curse} vale −1 PV.',
        'Cartas de Vitória não fazem nada na mão. Comprar cedo demais deixa seu baralho mais lento.',
      ],
    },
    {
      title: 'Começo',
      items: [
        'Cada jogador começa com 7 {copper} e 3 {estate}, embaralhados, e compra 5 cartas.',
        'A Feira tem os Tesouros, as Vitórias, {curse} e as 10 cartas do Reino escolhidas para a partida.',
      ],
    },
    {
      title: 'Seu turno: Ações › Compras › Fim do turno',
      items: [
        'Ações: você tem 1 Ação. Jogar uma carta de Ação gasta 1 Ação. "+1 Ação" deixa você jogar mais uma.',
        '"+1 Carta" compra cartas do seu baralho. "+$1" dá moedas para gastar neste turno.',
        'Compras: jogue Tesouros para somar moedas e compre 1 carta da Feira (mais, se tiver "+1 Compra") que custe até o que você tem.',
        'Cartas compradas ou ganhas vão para o seu descarte. Depois de comprar, você não joga mais Tesouros neste turno.',
        'Fim do turno: tudo da mão e da mesa vai para o descarte, e você compra 5 cartas novas.',
        'Quando o baralho acaba, embaralhe o descarte para formar um baralho novo.',
      ],
    },
    {
      title: 'Ataques e Reações',
      items: [
        'Cartas de Ataque afetam os outros jogadores. Exemplo: {militia} faz cada um descartar até ficar com 3 cartas.',
        'Todos os atingidos escolhem ao mesmo tempo. Quem joga o Ataque vê quem ainda está escolhendo.',
        'Com {moat} na mão, você pode revelar essa carta quando alguém joga um Ataque e não é afetado por ele.',
      ],
    },
    {
      title: 'Fim da partida',
      items: [
        'A partida acaba no fim do turno em que a pilha de {province} esvazia, ou em que 3 pilhas quaisquer da Feira ficam vazias.',
        'Vence quem tiver mais PV. No empate, vence quem jogou menos turnos; se ainda empatar, a vitória é dividida.',
      ],
    },
    {
      title: 'Palavras do jogo',
      items: [
        'Ganhar: pegar uma carta da Feira sem pagar. Ela vai para o descarte, a não ser que a carta diga outro lugar.',
        'Lixo: cartas que vão para o lixo saem da partida. Ótimo para tirar {copper} e {curse} do baralho.',
        'Descartar: pôr cartas na sua pilha de descarte. Revelar: mostrar a todos e devolver para onde estava.',
        'Com o tempo por turno ligado, quem estoura o tempo tem as escolhas feitas ao acaso; o tempo nunca joga nem compra cartas.',
      ],
    },
  ],
  en: [
    {
      title: 'Goal',
      items: [
        'Have the most victory points (VP) when the game ends.',
        'Victory cards score: {estate} 1 VP, {duchy} 3 VP, {province} 6 VP. Each {curse} is −1 VP.',
        'Victory cards do nothing in your hand. Buying them too early slows your deck down.',
      ],
    },
    {
      title: 'Setup',
      items: [
        'Everyone starts with 7 {copper} and 3 {estate}, shuffled, and draws 5 cards.',
        'The Market holds the Treasures, the Victory cards, {curse} and the 10 Kingdom cards picked for this game.',
      ],
    },
    {
      title: 'Your turn: Actions › Buys › End of turn',
      items: [
        'Actions: you have 1 Action. Playing an Action card spends 1 Action. "+1 Action" lets you play another.',
        '"+1 Card" draws from your deck. "+$1" gives coins to spend this turn.',
        'Buys: play Treasures to add up coins, then buy 1 card from the Market (more with "+1 Buy") costing up to what you have.',
        'Bought and gained cards go to your discard pile. Once you buy, you can\'t play more Treasures this turn.',
        'End of turn: everything in your hand and in play goes to your discard pile, and you draw 5 new cards.',
        'When your deck runs out, shuffle your discard pile to make a new deck.',
      ],
    },
    {
      title: 'Attacks and Reactions',
      items: [
        'Attack cards affect the other players, like {militia}, which makes everyone else discard down to 3 cards.',
        'Everyone hit chooses at the same time. Whoever played the Attack sees who is still choosing.',
        'With a {moat} in hand, you may reveal it when someone plays an Attack, and it doesn\'t affect you.',
      ],
    },
    {
      title: 'End of the game',
      items: [
        'The game ends at the end of the turn in which the {province} pile runs out, or any 3 Market piles are empty.',
        'Most VP wins. On a tie, whoever took fewer turns wins; if still tied, the win is shared.',
      ],
    },
    {
      title: 'Game words',
      items: [
        'Gain: take a card from the Market without paying. It goes to your discard pile unless the card says otherwise.',
        'Trash: trashed cards leave the game. Great for getting {copper} and {curse} out of your deck.',
        'Discard: put cards on your discard pile. Reveal: show everyone, then put the card back where it was.',
        'With the turn timer on, a player who runs out of time has their choices made at random; the timer never plays or buys cards.',
      ],
    },
  ],
};

/** Card ids the rule texts may name as {id}. */
export const RULES_CARDS = ['copper', 'silver', 'gold', 'estate', 'duchy', 'province', 'curse', 'militia', 'moat'];
