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

## Credits minigame (built): Settings → About
Hidden coloring game on the big logo (`src/components/CreditsGame.tsx` + `creditsGameEngine.ts`, styles `.cg-*` in styles.css, assets in `src/assets/`). Engine is plain imperative canvas code (`@ts-nocheck`), ported from a tuned preview; settings are hardcoded in `cfg` at the top of the engine (holdSec 1, inkMult 4, inkUse 3, brush 40, threshold 75, touchOffset 10, idle dot-hop every 4s, glow 12, lightSpeed .6, flight 1, creditsFade 1.4, creditsStay 5).
- Hold the logo: a copper line grows from the dot down the right edge and around a hidden play area; release early and it retracts. When full (100%), the play area pops in.
- Paint the letters m,a,r,g,i,n one at a time. Paint can go anywhere; spill = "Over budget". Header shows only "Emergency fund X%" / "Over budget Y%". Ink drains at inkUse× per px; the stem (dot→border) is the reserve, spent last. Pausing (×) then holding only resumes (no refill); running out of ink restarts the run.
- Each finished letter outlines + lights up in the logo. After 6: credits (`credits-by-dr-jao.png`) fade in, dot flies to the "by Dr.Jao" dot, then rolls back; run resets.
- Trophy = copper border around the logo; its length = best Emergency fund. Shown only after a completed run. Saved in localStorage `margin:credits-game` ({best, played}); "Replay credits" link appears after first completion. Respects prefers-reduced-motion.
- No skip/debug buttons on purpose (keep it hidden).
