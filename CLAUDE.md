# Margin — notes for Claude

Margin is a budget-monitoring PWA. Its core question: **"Am I still within budget this month?"**
It is hosted on GitHub Pages (branch `main`, folder `/docs`) and works offline. All data lives on the user's device — there is no backend.

## Commands
```bash
npm install
npm run dev        # local dev server
npm test           # vitest — unit tests for the budget maths (src/lib/calc.test.ts)
npm run build      # type-check + build into docs/
```
**The live site is whatever is committed in `docs/`.** After any code change: run `npm test`, run `npm run build`, and commit the updated `docs/` together with the source. Never hand-edit `docs/`.

## Stack and layout
Vite + React + TypeScript, hand-written CSS (`src/styles.css`), self-hosted Nunito Sans (`@fontsource`). No Tailwind, no Supabase (an earlier ChatGPT foundation used Supabase; it was deliberately replaced by on-device storage so the app works offline).

| Path | Purpose |
|---|---|
| `src/lib/calc.ts` | Every dashboard number (budget used, balances, category breakdown) |
| `src/lib/actions.ts` | All data changes as pure functions `(data, ...args) => newData` |
| `src/lib/storage.ts` | localStorage (`margin:v1`), validation of loaded/imported data |
| `src/lib/store.tsx` | React context; calls `apply(fn)` and auto-saves |
| `src/lib/backup.ts` | JSON backup/restore, CSV export |
| `src/components/` | Screens: Dashboard, Transactions, Planner, Budgets, Accounts, Settings + modals |
| `src/sw-template.js` + `vite.config.ts` | Service worker; the build injects the file list so the whole app is cached offline |
| `public/` | manifest + icons (`scripts/make_icons.py` regenerates icons/wordmark from `brand/`) |
| `brand/` | Logo sources: wordmark, brand board, and the "by Dr.Jao" credits lettering |

`vite.config.ts` uses `base: './'` so the app works from any GitHub Pages sub-path. Keep every URL relative.

## Product decisions (keep consistent)
- **Workspaces:** *Personal* and *Hillside Cafe* are fully separate data sets. The business workspace says "Sales / Profit" instead of "Income / Net".
- **Budget used** = spent this month ÷ sum of category monthly limits. Status: under 80% on track, 80–100% close, over 100% over. Limits repeat every month (no per-month limits yet). Categories with no limit are tracked but excluded from the budget total ("Not in any budget").
- **After upcoming bills** = total budget − spent − planned-unpaid expenses due this month.
- **Planner:** "Paid" creates a real transaction (idempotent); monthly items roll over to next month.
- **Balances** = opening balance + income − expenses ± transfers. Views: all / selected / primary.
- Currency is PHP; amounts are plain numbers rounded to 2 decimals; dates are local `YYYY-MM-DD` strings.
- Dark theme only (brand default). Brand: copper `#B9684D`, light copper `#DCA289`, dark copper `#8F4E3B`, background `#171717`, surface `#292524`, border `#3F3A37`, text `#F5F5F4`, secondary text `#A8A29E`.
- Data is per device (no sync). Settings has JSON backup/restore and a 30-day backup reminder.
- Not built: savings goals, light theme, per-month limits, non-monthly recurring bills, multi-device sync / staff access (would need an online database).

## In progress: credits minigame (NOT built yet — still designing)
Goal: a hidden minigame played on the big logo in **Settings → About**. Finishing it reveals the credits: `brand/credits-by-dr-jao.png` ("by Dr.Jao", same rounded lettering with a copper dot). The source image has a grey smudgy background and dark halo; it must be cut out onto transparency before use (cream letters + copper dot).

Agreed so far:
- It must play **in place on the logo** (no zoom, no new screen), be simple, and be about **balance / staying within your margin**.
- Ending idea: the copper dot "hands off" into the dot between "Dr." and "Jao", and "by Dr.Jao" fades in.
- Candidate mechanic the owner proposed: **hold on the logo** → the dot grows into a triangle fulcrum, a lever line appears with the word "margin" on the left arm, and copper liquid fills the letters while held (more fill = heavier). Release, then **tap** to drop coins on the right arm to balance. Proposed refinement: win when the coin side ends *slightly heavier*, inside a small shaded "margin" tolerance band; overshooting shows "over budget!" and resets the coins, not the fill.
- The owner then asked for a mechanic that **rewards not spending too much** (a larger leftover margin = a better reveal). Candidates discussed, no final pick: budget jar (limited pour supply, leftover = margin), resist-the-sale, receipt strike-through, plug-the-leaks, and the lever with a limited purse of coins.

Proposed defaults (not yet confirmed by the owner): everyone sees the credits regardless of score; ending flourish scales with the margin; best margin and "Replay credits" are saved on-device; soft haptics on phones, no sound; respect `prefers-reduced-motion` and offer a "Skip to credits" link; disable the browser's long-press menu on the logo.

Process agreed: first build a **preview page (artifact) with sliders** for the animation variables (fill speed, coin weight, tolerance band, etc.) and a "Copy settings" button; the owner tunes it, sends the settings back, and only then is it implemented in the real app.
