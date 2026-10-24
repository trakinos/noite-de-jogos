# Design System — Dominion Friends ("Feira")

The reference for how the game looks, moves and reads. Everything here is implemented in `src/styles.css` (one hand-written stylesheet, no framework) and the React components in `src/ui/`. When this document and the code disagree, the code wins. Update this file in the same change.

Last updated: 2026-10-07.

---

## 1. Principles

1. **Game state first.** Whose turn it is, what you can do, and what is about to run out must be readable at a glance, on a phone, in both languages. Decoration never competes with state.
2. **A Brazilian street market (feira).** Striped awnings, kraft paper, price-tag coins and painted signs. Warm, friendly and playful, but never childish.
3. **Color is never the only signal.** Every state that uses color also uses a shape, a border, an icon or text (✓ Done, a dashed empty pile, a number badge).
4. **Motion explains, it doesn't decorate.** Cards move the way they would on a real table: draw from the deck, fly to the discard pile. Everything respects `prefers-reduced-motion` and stays still in background tabs.
5. **Portuguese is the default and is longer.** Every layout must survive the longest pt-BR string. Names never break mid-word.

---

## 2. Theme vocabulary

The theme renames cards; mechanics never change. Names live in `src/theme/index.ts` (`THEME_NAMES`). The UI calls the Supply **Feira** in Portuguese and **Market** in English.

| Role | Cards (pt / en) |
|---|---|
| Money | Centavo / Cent ($1) · Moeda / Coin ($2) · Nota / Bill ($3) |
| Points | Banca / Stand (1) · Barraca / Stall (3) · Mercadão / Grand Market (6) |
| Penalty | Fiado / IOU (−1) |
| Attacks | Rapa / Crackdown · Fiscal / Inspector · Trombadinha / Pickpocket · Caloteiro / Deadbeat |
| Defense | Guarda-chuva / Umbrella |

Words used in the UI: Mão/Hand, Baralho/Deck, Descarte/Discard, Lixo/Trash, Na mesa/In play, Registro/Log, PV/VP.

---

## 3. Color tokens

All colors are CSS custom properties on `:root`, redefined under `@media (prefers-color-scheme: dark)`. Never hard-code a color in a component; add a token instead.

### Surfaces and text

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f3e9d6` | `#17120d` | Page (kraft paper with a dot grid, `--table-dot`) |
| `--surface` | `#fffbf2` | `#221a12` | Panels, buttons, inputs, dialogs |
| `--surface-2` | `#eadcc0` | `#30261a` | Banners, legend, inset rows, tab track |
| `--text` | `#2a1e14` | `#f3e8d4` | Body text |
| `--muted` | `#6b5744` | `#bca88d` | Secondary text, hints, counts |
| `--border` | `#d6c29f` | `#47392b` | Borders (2px is the standard weight) |
| `--table` | `#e4d0aa` | `#241b12` | Table areas |
| `--card-body` | `#fff8ea` | `#2a2017` | Card face |

### Meaning

| Token | Light | Dark | Use |
|---|---|---|---|
| `--accent` / `--accent-text` | `#2c4ba8` / `#fff` | `#93abff` / `#0e1530` | Primary buttons, playable and selected outlines, focus ring, info icons |
| `--danger` / `--danger-text` | `#b42318` / `#fff` | `#ff8a7a` / `#2a0b07` | Errors, destructive buttons, a pile at 0, timer running low, "the game ends this turn" |
| `--alert` / `--alert-text` | `#d4380d` / `#fff` | `#ff9a3c` / `#2a1204` | **Running out:** a Supply pile with 2 or fewer cards, the pile-out counter before it reaches 0 |
| `--online` | `#2f8f4e` | `#5cc98a` | Online dot, "Done" in the waiting list |
| `--coin` / `--coin-edge` | `#f2b632` / `#8a5e10` | same | Cost coins, trophy |
| `--stripe-a` / `--stripe-b` | `#c8372d` / `#fff4de` | `#a9302a` / `#2e2418` | Awning, card backs, rulebook bullets |

`--alert` and `--danger` are a pair: **alert means "about to happen", danger means "happened / blocking".** A pile goes alert at 2 and danger at 0.

### Card types

Card frames are colored by the most specific type: attack, then reaction, then the first listed type (`primaryType()` in `src/ui/format.ts`). Components set `--tc` (frame) and `--tc-ink` (text on the frame).

| Token | Hex | Type |
|---|---|---|
| `--t-action` | `#8c5a2b` | Action (kraft brown) |
| `--t-treasure` | `#f2b632` | Treasure (ink is dark `#2a1e14`) |
| `--t-victory` | `#2f7a35` | Victory |
| `--t-curse` | `#6b3f7f` | Curse |
| `--t-attack` | `#b8321f` | Attack |
| `--t-reaction` | `#17716f` | Reaction |

### Player colors

Eight colors players pick in the lobby (`src/theme/playerColors.ts`). They are mid-tones: readable as a solid fill with white text (4.5:1 or better) and as a 10% tint on light and dark surfaces.

`blue #2c4ba8` · `red #b8321f` · `teal #17716f` · `amber #a66509` · `green #2f7a35` · `purple #6b3f9f` · `pink #b83c78` · `slate #4a5568`

A player color is passed down as `--player` on a container. It drives:
- the turn board and play area: tinted with the **active** player's color;
- your dock (hand area): your color, **only on your turn** (`.board__dock.is-mine`); neutral otherwise;
- avatars, the turn pill, the timer fill and the VP tally bars.

Tint recipe: `color-mix(in srgb, var(--player) 10%, var(--surface))` for backgrounds, solid `var(--player)` for borders.

---

## 4. Typography

Loaded from Google Fonts in `index.html`.

| Role | Family | Weights | Where |
|---|---|---|---|
| Display | **Bricolage Grotesque** (`--font-display`) | 500–800 | Headings, card names, numbers (coins, counters, counts) |
| Body | **Nunito** (`--font-body`) | 400–900 | Everything else. Base `15px/1.4` |

Scale: `h1` 34px/800 (home title `clamp(44px, 7vw, 76px)`) · dialog title 20px · `h2` 17px/800 · `h3` 15px/800 · body 15px · small 13px · micro 12px (counts, type lines). Headings use `letter-spacing: -0.01em` and `line-height: 1.1`.

UI text is mostly **700–800 weight**: the game is read at a glance, often on a phone. Use 600 for running text (rulebook, banners) and `--muted` for hints.

Long card names (more than 10 characters) get `data-long` and a smaller size instead of hyphenation.

---

## 5. Shape, space and elevation

| Token | Value | Use |
|---|---|---|
| `--r-sm` | 6px | Small chips |
| `--r-md` | 10px | Buttons, cards, piles, inputs, list rows |
| `--r-lg` | 16px | Panels, dialogs, zones |
| pill | `99px` | Chips, coins, counters, tabs, toggles |

Spacing follows a 2px grid with common steps of **4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24**. Panels pad 20px. Mobile pages have a 16px side gutter and never scroll sideways.

| Token | Use |
|---|---|
| `--e1` | Resting: cards, piles, panels |
| `--e2` | Raised: dialogs, hovers, previews, cards in flight |
| `--e3` | The bottom dock (shadow points up) |

Borders are 2px everywhere, 3px on card frames.

---

## 6. Motion

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 120ms | Hovers, presses, overlay fade |
| `--dur-base` | 200ms | Dialog grow, card state changes |
| `--dur-slow` | 320ms | Pops, chips appearing |
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Default for anything entering or travelling |
| `--ease-spring` | `cubic-bezier(0.3, 1.4, 0.5, 1)` | Playful arrivals: turn pill, counters, check marks |

Named keyframes in `styles.css`: `rise`, `fade`, `grow`, `sheet` (phone dialogs), `chipIn`, `pop`, `pulse`, `countDrop`, `countZero`, `lowPulse`.

### Card movement (`src/ui/useCardMotion.ts`)

The engine only sends snapshots, so `src/ui/motion.ts` compares consecutive views to work out what moved. Clones of the cards fly in a fixed `.flights` layer above the page (so scrolling containers can't clip them), using the Web Animations API.

| Move | From → to | Duration | Notes |
|---|---|---|---|
| Draw | your deck → its slot in your hand | 380ms, 70ms stagger | The real card stays hidden until its clone lands |
| Discard | hand or play area → your discard pile | 420ms | Opponents' Clean-up flies to their seat in the header |
| Discard from deck | deck → discard (Vassal, Sentry, Library) | 420ms | Card backs, at most 6 |
| Buy | Supply pile → buyer's discard pile | 650ms | Pops (scale 1.08) then travels. On phones, flies to the Hand tab |
| Clean-up | discards first, draws start at half of 420ms | | "Out with the old, in with the new" |

Rules for new motion:
- Opt elements in with `data-motion` (`hand`, `play`, `deck`, `discard`, `seat-N`, `pile-<id>`, `tab-<id>`). Don't query by class.
- Skip a flight whose start or end has no box (a hidden tab on phones). Never animate to a guessed position.
- `prefers-reduced-motion: reduce` hides `.flights` and stops looping animations (pulses, dots). Background tabs skip card motion entirely.
- Loops are only for "waiting" or "running out" signals (timer low, choosing dots, a low pile). Nothing loops on a resting screen.

---

## 7. Iconography

`src/ui/components/Icon.tsx`: 24×24 stroke icons, `stroke-width: 2`, round caps and joins, `currentColor`. The default size is 18px (`.ico`); 14–15px inside chips and stats.

Set: `coin` `vp` `card` `action` `buy` `hand` `deck` `discard` `trash` `more` `info` `check` `clock` `x` `alert` `trophy` `wifiOff` `refresh` `copy` `shuffle` `door` `play` `book`.

Rule-text chips (`+1 card`, `+1 action`, `+1 buy`, `+$1`) pair an icon with a number. Use them wherever rule text appears outside a card (the rulebook's card list).

---

## 8. Components

Class names are the contract between React and CSS. States use `is-*` modifiers; variants use `--*`.

### Buttons
`button` (surface, 2px border, 44px minimum height: the touch target), `.primary` (accent with a 3px "pressed" bottom shadow), `.danger` (red text), `.danger-fill`, `.ghost`, `.icon` (44×44 square), `.lg` (52px), `.wide`, `.link`. Pressing moves a button down 1px.

### Card (`Card.tsx`, `.card`)
- Sizes: `--normal` 112×176 (hand, prompts), `--small` 84×118 (play area, discard, flights), `--big` 150×226 (hover preview). On phones: 100×164, 76×108 and 150×226.
- Anatomy: cost coin (top left) · art slot with a monogram or treasure value · name · body (chips plus rule text; not on small cards) · type line · optional count, check or order badges.
- States: `is-highlight` (playable: lifts with an accent ring), `is-selected` (accent ring and ✓), `is-dimmed` (not choosable: faded and desaturated), `is-clickable`.

### Supply pile (`Pile.tsx`, `.pile`)
A compact 60px tile: thumb · name (and type line in the kingdom) · cost coin and count. Hovering, or long-pressing on touch, shows the full card (`.pile__preview`).
- `is-highlight` buyable · `is-dimmed` can't afford · `is-selected` / `is-off` in the lobby picker
- **`is-low`: 2 or fewer cards left** (`LOW_PILE`). The border turns `--alert` and the count becomes an `--alert` pill with a slow pulse. On a faded pile, only the thumb, name and coin fade; the low count stays loud.
- `is-empty`: dashed outline, "0" thumb, "empty" label.

### Zones and board
`.zone` panels with a `.zone__head` (h2 and a muted hint). Board areas are `.board__top` (brand, room code, opponents, Rules, host menu), `__supply`, `__log`, `__status` (turn board, active player's tint), `__play`, `__dock` (sticky bottom: turn actions and hand, your tint on your turn). Below 768px the board is one column with Hand / Market / Log tabs (`.board__tabs`) and a sticky turn board.

### Dialogs
All share `.overlay` (dimmed backdrop, centered; a bottom sheet on phones) and `.prompt.panel`.

| Dialog | Class | When | Closes |
|---|---|---|---|
| Prompt | `.prompt` | You must choose (cards, a pile, an option, an order) | By answering |
| Confirm | `.prompt--confirm` | Click guard, End game | Cancel / confirm, backdrop |
| **Waiting for the others** | `.group` | An attack's choices are open and you're not choosing: you played it, you already answered, or you weren't hit | When everyone has answered. "Hide" collapses it into a dock banner with "Show" |
| **Pile ran out** | `.pile-out` | A Supply pile reaches 0 | OK, backdrop, or after 5s. Queued if several |
| **Rulebook** | `.rules` | The Rules button (board header and lobby) | ✕, Esc, backdrop |

The waiting dialog lists each player in the group with their avatar, name and a live status: animated dots and "Choosing…", turning into a green row with ✓ and "Done". It also shows "n of m done" and the 30s response timer when the room has a timer.

The pile-out dialog shows the card; the alert counter drops from its last count to a red **0** while the card greys out and tips over. It then shows "n of 3 piles are empty" and, in danger color, when the game will end.

Only one dialog shows at a time, in this order: your prompt › waiting for the others › pile ran out. The rulebook opens on top of anything.

### Status pieces
- `.banner`: inline status on `--surface-2` (waiting for a player, a hidden waiting dialog). `.banner--info` for explanations.
- `.toast`: refused moves; dark, at the bottom, closes itself after 5s.
- `.turn-pill`: "Your turn" / "X's turn" in the player color.
- `.phases`: Actions › Buys › End of turn, the current phase raised.
- `.ctr`: counters (actions, buys, $).
- `.timer`: track and fill in the player color; pulses red under the low-time threshold.
- `.avatar`: initial on the player color, with an online `.dot`.
- `.lchip`: card-name chips in the log, colored by type.
- `.legend`: the collapsible icon key above the Supply.

---

## 9. Writing

- Every string lives in `src/i18n/pt.ts` and `src/i18n/en.ts` (TypeScript enforces both). Engine prompts carry an `id` and `params`; the UI translates them.
- The rulebook is `src/i18n/rules.ts`. Card names in it are `{id}` placeholders, filled with the themed name. A test keeps the two languages in step.
- Voice: short, direct, second person ("Discard 2 cards", "Your turn"). Say what happens, not why.
- Avoid articles before card names in Portuguese: theme names have mixed genders ("o Rapa", "o Guarda-chuva").
- Numbers that matter are shown as numbers, not words: `×2`, `1 de 3`, `$3`.

---

## 10. Accessibility checklist

- Cards and piles are real `<button>`s with an `aria-label` that includes cost, count (or "Only n left"), types and rule text.
- Dialogs use `role="dialog"` or `role="alertdialog"` with `aria-modal` and a label. The waiting list is `aria-live="polite"`.
- Touch targets are at least 44px (the Rules button and banner actions are 32–40px only inside larger rows).
- Focus is visible (accent ring on inputs, border on buttons). Text meets AA on its surface in both themes.
- Reduced motion: no flights, no loops, transitions cut to 1ms.

---

## 11. Adding something new

1. Reuse a token. If none fits, add it to **both** `:root` blocks and to the table in §3.
2. Reuse a dialog, banner or chip pattern before inventing one.
3. Add strings to both dictionaries.
4. Check light and dark mode, 375px wide, and reduced motion.
5. Update this document.
