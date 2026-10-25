export type RuaId = 'r1' | 'r2' | 'r3' | 'r4' | 'r5' | 'r6' | 'r7' | 'r8';

export interface PontoSquare {
  kind: 'ponto'; id: string; rua: RuaId; price: number;
  /** Rent for [no buildings, 1, 2, 3, 4 puxadinhos, prédio]. */
  rent: [number, number, number, number, number, number];
  houseCost: number; mortgage: number;
}
export interface ServicoSquare { kind: 'servico'; id: string; price: number; multiplier: number; mortgage: number }
export type Square = PontoSquare | ServicoSquare
  | { kind: 'start' | 'luck' | 'jail' | 'pracinha' | 'goToJail'; id: string }
  | { kind: 'iptu' | 'bolao'; id: string; amount: number };

export const START_MONEY = 1500;
export const PASS_START = 200;
export const JAIL_FINE = 50;
export const JAIL_POS = 10;
export const MORTGAGE_INTEREST = 0.2;
export const MAX_HOUSES = 4;

type Rent = PontoSquare['rent'];
const ponto = (id: string, rua: RuaId, price: number, rent: Rent, houseCost: number): PontoSquare =>
  ({ kind: 'ponto', id, rua, price, rent, houseCost, mortgage: price / 2 });
const servico = (id: string, price: number, multiplier: number): ServicoSquare =>
  ({ kind: 'servico', id, price, multiplier, mortgage: price / 2 });
const luck = (): Square => ({ kind: 'luck', id: 'luck' });

export const BOARD: readonly Square[] = [
  { kind: 'start', id: 'start' },
  ponto('borracharia', 'r1', 60, [2, 10, 30, 90, 160, 250], 50),
  luck(),
  ponto('lava-jato', 'r1', 60, [4, 20, 60, 180, 320, 450], 50),
  { kind: 'iptu', id: 'iptu', amount: 200 },
  servico('kombi', 200, 8),
  ponto('lan-house', 'r2', 100, [6, 30, 90, 270, 400, 550], 50),
  luck(),
  ponto('bicicletaria', 'r2', 100, [6, 30, 90, 270, 400, 550], 50),
  ponto('chaveiro', 'r2', 120, [8, 40, 100, 300, 450, 600], 50),
  { kind: 'jail', id: 'jail' },
  ponto('quitanda', 'r3', 140, [10, 50, 150, 450, 625, 750], 100),
  servico('mototaxi', 150, 5),
  ponto('acougue', 'r3', 140, [10, 50, 150, 450, 625, 750], 100),
  ponto('peixaria', 'r3', 160, [12, 60, 180, 500, 700, 900], 100),
  servico('carro-do-ovo', 200, 8),
  ponto('salao-da-cida', 'r4', 180, [14, 70, 200, 550, 750, 950], 100),
  luck(),
  ponto('barbearia', 'r4', 180, [14, 70, 200, 550, 750, 950], 100),
  ponto('atelie-de-costura', 'r4', 200, [16, 80, 220, 600, 800, 1000], 100),
  { kind: 'pracinha', id: 'pracinha' },
  ponto('papelaria', 'r5', 220, [18, 90, 250, 700, 875, 1050], 150),
  luck(),
  ponto('loja-de-1-99', 'r5', 220, [18, 90, 250, 700, 875, 1050], 150),
  ponto('farmacia', 'r5', 240, [20, 100, 300, 750, 925, 1100], 150),
  servico('caminhao-do-gas', 200, 8),
  ponto('pastelaria', 'r6', 260, [22, 110, 330, 800, 975, 1150], 150),
  ponto('sorveteria', 'r6', 260, [22, 110, 330, 800, 975, 1150], 150),
  servico('sorveteiro', 150, 5),
  ponto('padaria', 'r6', 280, [24, 120, 360, 850, 1025, 1200], 150),
  { kind: 'goToJail', id: 'go-to-jail' },
  ponto('boteco', 'r7', 300, [26, 130, 390, 900, 1100, 1275], 200),
  ponto('pizzaria', 'r7', 300, [26, 130, 390, 900, 1100, 1275], 200),
  luck(),
  ponto('churrascaria', 'r7', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  servico('van-escolar', 200, 8),
  luck(),
  ponto('academia', 'r8', 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { kind: 'bolao', id: 'bolao', amount: 200 },
  ponto('supermercado', 'r8', 400, [50, 200, 600, 1400, 1700, 2000], 200),
];

/** Ponto ids per rua, cheapest first. */
export const RUAS: Record<RuaId, string[]> = {
  r1: ['borracharia', 'lava-jato'],
  r2: ['lan-house', 'bicicletaria', 'chaveiro'],
  r3: ['quitanda', 'acougue', 'peixaria'],
  r4: ['salao-da-cida', 'barbearia', 'atelie-de-costura'],
  r5: ['papelaria', 'loja-de-1-99', 'farmacia'],
  r6: ['pastelaria', 'sorveteria', 'padaria'],
  r7: ['boteco', 'pizzaria', 'churrascaria'],
  r8: ['academia', 'supermercado'],
};

export function unmortgageCost(sq: PontoSquare | ServicoSquare): number {
  return Math.ceil(sq.mortgage * (1 + MORTGAGE_INTEREST));
}
