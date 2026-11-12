# margin.

Budget monitoring that answers one question fast: **am I still within budget?**

- **Dashboard** — how much of this month's budget you've used (with a "where you should be by today" marker), what's left after upcoming bills, and spending in every category against its limit.
- **Personal + Business workspaces** — e.g. *Personal* and *Hillside Cafe*, completely separate. The business workspace says *Sales / Profit* instead of *Income / Net*.
- **Accounts** — cash, bank, e-wallet; balances calculated from your entries; transfers between accounts.
- **Planner** — bills you expect (rent, loans, internet…). Tap **Paid** and it becomes a real expense. Monthly bills repeat automatically.
- **Works offline** and installs on your phone like an app. Your data stays **on your device** — no account, no server.
- **Backup / restore** (JSON) and **CSV export** in Settings.

---

## Put it on GitHub Pages (about 5 minutes)

The `docs/` folder already contains the finished, ready-to-run app.

1. Create a new repository on github.com (for example `margin`). **Free GitHub accounts need the repository to be Public for Pages.** That only makes the *app's code* public — your budget data never leaves your own device.
2. Upload everything in this folder to the repository (drag & drop in the browser works; or use `git push`).
3. In the repo go to **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, branch **main**, folder **/docs**, then **Save**.
4. After a minute your app is live at `https://YOUR-USERNAME.github.io/margin/`.

### Use it on your phone
- Open the link once **while online** (this saves the app to your phone for offline use).
- **iPhone (Safari):** Share → *Add to Home Screen*.
- **Android (Chrome):** ⋮ menu → *Install app*.
- After that it opens from your home screen, full-screen, even with no signal.

### Important to know
- Data is stored **on each device separately** (phone and laptop will not sync). Use **Settings → Download backup** regularly — Margin will remind you after 30 days.
- Clearing the browser's site data or uninstalling the app removes the data. Restore from a backup file any time.

---

## For development

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests for the budget maths
npm run build      # type-check + build into docs/
```

The offline support is a service worker generated at build time (`vite.config.ts` + `src/sw-template.js`). After changing code, run `npm run build` and commit the updated `docs/` folder.

Project layout:

| Path | What it is |
|---|---|
| `src/lib/calc.ts` | Budget / balance calculations (all the dashboard numbers) |
| `src/lib/actions.ts` | Every data change as a pure function |
| `src/lib/storage.ts` | Saving to the device + validating loaded/imported data |
| `src/components/` | Screens (Dashboard, Transactions, Planner, Budgets, Accounts, Settings) |
| `brand/` , `scripts/make_icons.py` | Logo sources and the script that generates the app icons |

Brand: copper `#B9684D`, charcoal `#171717` / `#292524`, Nunito Sans, dark mode by default.
