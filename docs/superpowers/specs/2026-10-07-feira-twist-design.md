# The Feira twist: Caderneta, Market-day events, Secret objectives

Date: 2026-10-07
Status: **draft for review**. Decisions made with the user are marked ✅. Proposals still to confirm are marked ❓.

Dominion Friends has played plain Dominion so far. This adds three optional rule modules, Tanto Cuore style, that the host switches on in the lobby. Each works alone or with the others:

1. **Caderneta** (the books): where your points become safe, and where your debts sit.
2. **Dia de feira** (market-day events): one shared rule change per round.
3. **Objetivos secretos** (secret objectives): a hidden personal goal for bonus points.

The base rules stay available: with every switch off, the game is exactly today's.

---

## 1. Caderneta (the books)

Every player has a **caderneta**: a public area in front of them, visible to everyone, holding the Victory cards they have *written in the books* and their *Fiado* (IOU) debts.

### 1.1 Scoring ✅

A Victory card scores **full points in your caderneta** and **half its points, rounded up**, anywhere else you own it (deck, hand, discard, in play).

| Card | Outside the caderneta | In the caderneta |
|---|---|---|
| Banca (Estate) 1 | 1 | 1 |
| Barraca (Duchy) 3 | 2 | 3 |
| Mercadão (Province) 6 | 3 | 6 |
| Horta (Gardens) *n* | ⌈n/2⌉ | n |

- Horta's value *n* still counts **every** card you own, the caderneta included.
- Rounding up means Banca never gains points from the books, as intended. Writing a Banca in is still useful, because it leaves your deck (1.2).

### 1.2 Writing a card in the books ("Anotar") ✅

- A card written in the caderneta **leaves your deck for good**: it is never drawn again, can't be trashed or discarded by card effects, and stays there until the end. ✅
- **Basic price, in your Buy phase:** spend **1 Buy plus coins** to move one Victory card from your hand into your caderneta. ✅
  - Banca, Barraca, Horta: **$2**
  - Mercadão: **$5**
  - Always plus 1 Buy, also when an event changes the price. ✅
- Writing a card counts as buying: afterwards you can't play more Treasures this turn (the same rule as buying a card). ✅
- You may write more than one card per turn if you have the Buys and coins.

### 1.3 New Kingdom cards: trashing as the price ✅

New Action cards make writing cheaper by trashing other cards. They join the kingdom picker only when Caderneta is on.

| Card | Cost | Text (proposal) |
|---|---|---|
| **Guarda-livros** (Bookkeeper) | $4 | +1 Card, +1 Action. You may trash a card from your hand. If you do, write a Victory card from your hand in your caderneta. |
| **Contador** (Accountant) | $5 | Trash up to 2 cards from your hand. For each card trashed, write a Victory card from your hand in your caderneta. |

Writing through these cards costs no Buy and no coins: the trashed card is the price. These two texts are approved for now ✅; more cards can come later (ideas: a $3 "write one Banca or Barraca for free", a $6 "+$2, write a card").

### 1.4 Fiado as debt ✅

- A gained **Fiado** (Curse) goes **into your caderneta as a debt**, not into your deck. It does not clog your draws, but everyone can see it.
- Each Fiado in the caderneta is **−1 point** at the end. (No halving: debts are always in the books.)
- **Settling a debt ("Quitar"):** ⏸ **on hold.** The user is thinking of a different mechanic. Until then, Fiado debts can't be removed.
- Caloteiro (the Witch card) keeps its text. Its attack now builds visible debt instead of junk in the deck.
- A Fiado pile that runs out still counts as an empty Supply pile.

### 1.5 Interactions to check ❓

- **Fiscal (Bureaucrat)** keeps its effect (others put a Victory card from their hand on their deck). A Victory card in the caderneta is safe from it. Possible upgrade later: "audit" one card in someone's caderneta.
- **Faxina (Chapel), Reforma (Remodel), etc.** can't touch the caderneta: they only see the hand.
- **Ending:** unchanged (Mercadão pile empty, or any 3 piles empty).
- **Bots** (`src/sim/bigMoney.ts`): learn a simple rule, "write in a Mercadão when you have $5 and nothing better to buy", so simulations keep working.

### 1.6 UI

- **Your caderneta:** a strip in your dock next to the discard pile: small cards for written Victory cards, Fiado chips in danger color, and your current points shown as "full points in the books".
- **Opponents:** their seat in the header gets a caderneta count (a notebook icon with VP in the books and debts).
- **Writing:** in the Buy phase, Victory cards in your hand become clickable with a price tag ("Anotar · $2" / "$5"); clicking writes them. A flight animation moves the card from hand to the caderneta (the same system as the discard flights).
- **Settling:** clicking a Fiado chip in your own caderneta during the Buy phase offers "Quitar · $2".
- **End screen:** the tally counts the caderneta at full value and the rest at half, and shows both.
- **Rulebook:** a new section explaining the caderneta when the switch is on.

---

## 2. Dia de feira (market-day events) ✅

- At setup the event deck is shuffled. At the **start of every round** (when the first player starts a turn, including round 1), the next event is turned face up and replaces the previous one. It applies to every turn in that round.
- The current event shows as a banner on the turn board, with its icon and one-line effect. The log announces each new one ("Dia de feira: Chuva").
- If the deck runs out, it is reshuffled.

### Event list ✅ (kept for now)

| Event | Effect for this round |
|---|---|
| **Chuva** (Rain) | Every card costs $1 more. |
| **Xepa** (Last call) | Every card costs $1 less (minimum $0). |
| **Feriado** (Holiday) | +$1 on every turn. |
| **Promoção** (Sale) | +1 Buy on every turn. |
| **Mutirão de feira** (Market work party) | +1 Action on every turn. |
| **Freguesia cheia** (Busy market) | Draw 6 cards at Clean-up instead of 5. |
| **Fiscalização** (Inspection) | Writing in the caderneta costs $1 more. *(Only with Caderneta on.)* |
| **Dia de pagamento** (Payday) | ⏸ Effect depends on how debts are settled (1.4, on hold). *(Only with Caderneta on.)* |
| **Pechincha** (Haggling) | The first card you buy each turn costs $2 less. |
| **Calmaria** (Quiet day) | Nothing changes. |

All of these are simple modifiers the engine applies to costs, turn start or Clean-up, so no card code changes.

---

## 3. Objetivos secretos (secret objectives) ✅

- At setup each player is dealt **1 objective**, at random, with no choice. ✅
- Your objective is **hidden** from the others: the host sends it only in your own view. It shows in your header as a small card with your progress ("3 / 4").
- At the end it is revealed in the tally. If you met it, you get **+4 points** ❓, never halved.
- Objectives are thresholds, so several players can meet theirs and there are no tie rules.

### Objective list ✅ (kept for now)

| Objective | Condition at the end |
|---|---|
| **Atacadista** (Wholesaler) | Own 3+ Notas (Gold). |
| **Nome limpo** (Clean name) | No Fiado in your caderneta or deck. |
| **Escriturário** (Clerk) | 4+ Victory cards in your caderneta. *(Only with Caderneta on.)* |
| **Freguês fiel** (Loyal customer) | 3+ copies of one Kingdom card. |
| **Faxina geral** (Spring cleaning) | Trashed 6+ of your own cards during the game. |
| **Banca cheia** (Full stall) | Own 10+ Action cards. |
| **Pé-de-meia** (Nest egg) | Own Treasures worth $16+ in total. |
| **Grande comerciante** (Big trader) | Own 2+ Mercadões. |

Objectives that need Caderneta are left out of the deck when it's off.

---

## 4. Lobby ✅

The host sees three switches under the timer setting: **Caderneta**, **Dia de feira**, **Objetivos secretos**, all off by default. Guests see which are on. The new Kingdom cards appear in the picker only with Caderneta on, and a random kingdom may include them.

---

## 5. Engine shape

- `GameState.options: { caderneta: boolean; events: boolean; objectives: boolean }`, set at `createGame`.
- `PlayerState.books: CardId[]` (written Victory cards and Fiado debts).
- `GameState.events: { deck: EventId[]; current: EventId | null } | null`.
- `PlayerState.objective: ObjectiveId | null`, plus counters the objectives need (cards trashed).
- New intents: `{ type: 'write', handIndex }` and `{ type: 'settle' }`.
- **Costs go through one function**, `costOf(state, card)`, which applies events, so the Supply, buying and "gain a card costing up to $X" effects all agree.
- `gain()` sends Fiado to `books` when Caderneta is on.
- `scoring.ts`: halves Victory cards outside the books, adds the debts and the objective bonus, and the breakdown separates "in the books" from "outside".
- `viewFor`: everyone's `books` and the current event are public. **Your objective goes only in your own view.**

---

## 6. Order of work

Each module is a separate plan, in this order:

1. **Caderneta** (biggest change; scoring, zones, two new cards, UI strip).
2. **Dia de feira** (cost modifiers, turn-start hook, banner).
3. **Objetivos secretos** (setup choice, hidden view, end reveal).

Each keeps the 200-game simulation passing with its switch on, and both dictionaries complete.

---

## 7. Open questions

1. ⏸ How Fiado debts are settled (1.4): the user has a different idea in mind.
2. Is +4 the right objective bonus?
