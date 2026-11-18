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

## Credits minigame (built): hold the top logo (any page)
Hidden coloring game (`src/components/CreditsGame.tsx` = painting card only; `creditsGameEngine.ts` = all logic, `@ts-nocheck`, imperative canvas; styles `.cg-*`; assets `src/assets/`). Settings are hardcoded in `cfg` at the top of the engine (holdSec 1, inkMult 4, inkUse 3, brush 40, threshold 75, touchOffset 10, glow 12, lightSpeed .6, flight 1, creditsFade 1.4, creditsStay 5).
- Trigger: hold the small header/sidebar `.wordmark`. A thin plain copper ring grows around the logo (SVG rect, drawn by the engine); release early and it retracts. At 100% the painting card (fixed, under the header) pops in with sparks.
- The big logo is NOT shown anymore. All effects play on the top logo through a full-viewport fixed overlay canvas (z 35): the real img is hidden (opacity 0) while a run is active and the canvas redraws the letters, copper light-up per finished letter, outline trace, sparks, dot flight, a small dot that hops to the credits dot and rolls back, the credits (`credits-by-dr-jao.png`) fading in BESIDE the logo (right of it on mobile, beneath it on desktop; ~0.8x/0.6x logo width so the logo stays dominant and never fades), and a small score pill.
- Paint m,a,r,g,i,n one letter at a time; paint can go anywhere (spill = "Over budget"); card header shows "Emergency fund X%" / "Over budget Y%". Ink drains at inkUse× per px; the ring is the ink gauge while playing; the last `reserveFrac` (.2) of ink is the emergency-fund reserve (spent last). Pause (×) then hold only resumes (no refill); running out of ink restarts the run.
- Trophy: after a completed run the ring stays as a thin glowing border whose length = your latest completed run (not the all-time best). NOT persisted: it resets on refresh/reopen. Respects prefers-reduced-motion. No skip/debug buttons (keep it hidden).

## Budgets: periods, groups, Day/Week/Month view
- Each expense category's limit is entered per day, week or month (`Category.limitPeriod/limitAmount`; missing = month, `monthlyLimit`). `monthlyLimitFor(cat, month)` converts (day x days-in-month, week x days/7); `limitInPeriod` gives the day/week/month figure (whole pesos). Always use these, never read `monthlyLimit` directly for totals.
- Optional `Category.group` (e.g. Food): Overview rolls grouped categories into one expandable block; totals still sum the individual limits.
- Overview budget card has a Day / Week / Month toggle (current month only). Week = Monday-Sunday. `monthSummary` / `categoryBreakdown` take `(period, today)`; Day/Week count only transactions in that window and show the month status as a context line.

## Budget wizard + savings goals
- `AppData.goals: SavingsGoal[]` (name, monthlyAmount, target, saved, savedMonths). Goals are tracked by ticking "Save ₱X" on the Overview (`SavingsCard`); they do NOT count as spending or touch balances. Manage them in Budgets → Savings goals (`Savings.tsx`).
- `BudgetWizard.tsx` (modal, 4 steps: income per week/month → savings total + split across goals → suggested spending limits per category → review). Opened from Budgets ("Budget wizard") and the Overview empty state. `A.applyWizard` sets monthly limits, upserts goals by name (keeps progress), remembers income in `prefs.plans[workspaceId]`. Helpers in calc.ts: `monthlyIncome` (weekly x 52/12), `suggestSplit`, `splitSavings`.

## Monster hunt (survivor game)
- Overview card `GameCard` (in `src/components/MonsterGame.tsx`) opens a fullscreen overlay: intro (hero job + stats + chest at stake) → play → result.
- `src/game/profile.ts`: `profileFor` turns real data into a hero. Job by savings rate (Wanderer none, Scout <15%, Knight 15–25%, Paladin ≥25%); HP bonus for staying within budget; damage bonus for savings goals ticked this month; luck and chest tier from savings rate. `chestFor` sets reward (win bumps the tier; gold + win = legendary). Save lives in localStorage `margin:game` (coins, relics, best time, runs).
- `src/game/survivor.ts`: imperative canvas engine (`@ts-nocheck`). Floating-thumb joystick/WASD, auto bolts, XP gems, level-up picks, monsters (slime, bat, goblin, ogre), Ogre King at 50%, Dragon at 90% (killing it wins). Run length 600s; set localStorage `margin:game-test` to a number of seconds for quick tests (`window.__game.debug` is exposed).

### Jobs and Play tab (update)
- Own **Play** tab (`PlayTab` in `MonsterGame.tsx`; Overview `GameCard` is just a shortcut). Player picks a job (saved in `margin:game`): archer (arrows, pierce), mage (slow exploding magic), swordsman (blades orbiting the hero). `profileFor(data, ws, month, job)`.
- Saver rank 1/2/3 (Starter <15%, Steady 15–25%, Super ≥25%, matching the wizard) sets the title (e.g. Archer → Ranger → Skyhunter), +20 HP and +0.1 damage per rank, and the main weapon starts at level = rank (+30% damage for the main weapon). Other weapons come from level-up picks. Bottom nav now has 7 tabs.

### Sprites
- Heroes: “Elementals” Leaf Ranger / Water Priestess / Fire Knight by chierit (CC BY 4.0, credit required, no reselling). Monsters goblin/skeleton/mushroom/flying eye: “Monsters Creatures Fantasy” by Luiz Melo (CC0). Slime, troll, ettin (Ogre King), dragon and the orbiting sword: “32rogues” by Seth Boyles (no redistributing the full pack, no NFT/blockchain, no generative-AI/ML projects).
- Only used frames are packed into `src/assets/anim-sprites.png` (animated strips, sizes in the manifest inside `src/game/sprites.ts`) and `src/assets/game-sprites.png` (32px static tiles). Do not commit the original packs. Credit line lives on the Play tab.
- Heroes look the same at every saver rank; rank shows as a bigger sprite and a ground aura (copper/silver/gold, gold also glows). Effects (arrows, magic, nova) and gems are drawn in code.

### Weapons (levels 1-7)
- Each weapon maxes at level 7 with a signature effect: Arrows = Arrow Storm (wall of 7 parallel arrows, 4x fire rate), Magic = Meteor Rain (5+ meteors on random monsters each cast), Sword = Blade Tempest (second counter-rotating ring). Blades hit along their whole length (segment distance). `Duplicate` upgrade (max 4) adds +1 arrow/bolt/blade/meteor.

## Game v2 (weapons, drops, events)
- Hero carries max 3 weapons (job weapon counts): arrow, magic, sword, potion, lightning, each Lv 1-7 with a per-level effect (`LV` in `src/game/survivor.ts`). Arrows fly the way the hero faces (`P.dir`). Magic = homing bolts that hit one monster only.
- Generic upgrades continue past weapon max: Duplicate (max 3, simultaneous +1), Multishot (max 3, sequential repeat), damage, fire rate (also spins blades faster), speed, HP, magnet. Blades capped at 6 per ring (12 with the L7 second ring).
- Drops (~3% per kill): heart, magnet (vacuums all gems), shield (6s invincible), boots (8s speed). Champion every D/5 drops a chest (weapon, health or upgrade pick). Swarm every 0.3D. Spawn rate/density ramps up late.
- `window.__game.debug` has `lvl, drop, swarm, mini, setT` for headless tests. HUD shows weapon chips and buff timers.
- v2.1: swordsman hero = bare-handed fighter tile (32rogues tile 6), animated by code (bob/tilt) in `sprites.ts`. Magic only fires when a monster is on screen (nearest first, one bolt per monster, cooldown not spent otherwise); a bolt whose target dies flies straight (Archmage re-seeks once). Duplicate and Multishot max 2 and are drawn rarely (weight 0.22). Hearts are rarer. No coloured ground shadow under the hero.
- Relics: `RELIC_FX` in `profile.ts` gives each relic a small passive (dmg, rate, hp, speed, magnet, xp, drops, Phoenix revive). Up to `RELIC_SLOTS` (3) are equipped from the Play tab (`GameSave.equipped`) and passed to the engine as `opts.fx`.
- Difficulty curve: non-boss HP = 0.55+4.5*p^1.6 (early monsters die in 1 hit), damage = 0.8+1.4*p, spawn gap 0.1+1.5*(1-p)^1.5 with 1+floor(8p^2) per wave, cap 320, swarms 30+70p. Bosses keep 1+2.4p HP scaling.
- Boss HP: Ogre King 9000, Dragon 24000 (x(1+2.4p)); champions x40 base HP. Tuned against fully maxed builds.
- Waves: monsters arrive in bursts from one side (gap 1.8+5.5(1-p)^1.3 s, size 3+60p^1.6+4p), no waves counter, next burst doesn't wait. Magic cooldown 2.1s and bolt speed 150; lightning cooldown 3.6s; potion cooldown 3.2s and flasks land on 8 compass slots around the hero without overlapping puddles (tidier ring as level rises).
- v2.3: HP curve 0.5+4p^1.5+9p^3. Potion L7 = clockwise ring sweep (flasks 0.1s apart). Magic L7 = each hit splits into 2 homing shards (no extra rate or damage).
- v2.4: player damage eases off late (x(1-0.35p^1.2)), dmg upgrade +18%; first level-up needs only 3 XP and the first wave is 4 slimes so it triggers level 1; wave gap 1.4+4.5(1-p)^1.3 s, size 4+85p^1.5+6p, cap 380.
- v2.5: HP curve 0.5+4p^1.5+22p^3 (about 26x at the end); player damage x(1-0.5p^1.2), dmg upgrade +12%.
- Lightning targets a monster 50% (Lv1) to 85% (Lv7) of strikes; otherwise a random spot within 190px of the hero.
- v2.6: lightning only hits (and chains to) monsters on screen; damage: upgrade +8%, weapon levels +10% each, late factor x(1-0.65p^1.1).
- v2.7: HP curve 0.5+5p^1.5+45p^3 (about 50x at the end), bosses x(1+4p); player damage x(1-0.75p^1.1), upgrade +6%, weapon levels +7%.
- v2.8: fewer bolts/flasks/strikes: magic, potion, lightning get +1 at L4 and L6 (L7: 4 bolts, 5 flasks, 4 strikes); Duplicate always adds exactly +1 (no doubling at L7); second sword ring ignores Duplicate.
- v2.9: walled arena (`ARENA` 620 each way, copper border); spawns mirror to the far side near walls. No more win by surviving: the run is lost if the Dragon is alive at t >= D (10 min), with a 30s warning banner. Only killing the Dragon wins.
- v3.0: arena is a vertical hallway (AX 270, AY 950). Pickup drop chance 1.4% (2.2% when low HP). Late damage factor x(1-0.68p^1.1), upgrade +7%.
- v3.1: base difficulty is harsh on purpose (HARD: mobs x1.2 HP, x1.3 damage, waves x1.2); relics are strong (about 2x their old size, plus `guard` = damage taken reduction) so collecting them makes runs tolerable. Tune HARD in survivor.ts and RELIC_FX in profile.ts.
- Result screen: tap-to-open chest (wooden/bronze/silver/golden/epic). Lucky upgrade chance 10-25% (by luck) bumps one tier with +50% coins; relic comes from the final tier. Rewards are saved when the run ends.
- v3.2: hallway runs across the map (AX 1000, AY 400). Game overlay blocks text selection, long-press callout and tap highlight (user-select none, selectstart/contextmenu prevented on the canvas).
- v3.3: arena AX 650, AY 330.
- v3.4: arena AX 450, AY 280.
- v3.5: arena AX 800, AY 280.
- v3.6: Ogre King base HP 4500. Magic: +1 bolt at L3 and L5 (L7 = 5), small blast on hit (30px, 35% damage to neighbours), shards have no blast.
- v3.7: magic blast is now an upgrade (L4 small, L6 bigger), L2 = faster homing, max = 4 bolts (+ Duplicate/Multishot).
- v3.8: every level of arrow/sword/potion/lightning does something distinct (see `LV` in survivor.ts); the old flat +7% per weapon level was removed from them.
- v3.9: sword gets blades early: +1 at L2, L3, L6; spin +25% at L4; longer at L5.
- v4.0: weapon damage grows per level via wl(L)=1+0.12(L-1), x1.15 at max (L7 about 2x L1). XP needed per level 8+5L+0.9L^1.7. Late waves x(1+0.8p), gap 1.2+4(1-p)^1.3, swarm every 0.22D (40+90p), cap 450.
- v4.1: sword blade damage x2.4 (was 1.5) and Super nova x4.5 (was 3): melee risks more, so it hits harder.
- v4.2: monster speed x(1+0.7p) (was 0.5p); hearts heal exactly 20% of max HP.
- v4.3: pickup drop chance per kill is divided by 1+5p^1.5 (about 1/6 at the end).
- v4.1b: swordsman hero = animated armored knight from the 'Free Knight' pack (aamatniekss; 120x80 frames cropped to 31x40, run+idle, in src/assets/knight-sprites.png; no license file in the zip, check the itch.io page). Credit added on the Play tab.
- v5.0: new weapons Axe (heavy cleave where you face, knockback with per-monster immunity, stun L4, shockwave L3, L7 Earthsplitter = map-wide wave), Boomerang (curves out and back, L7 figure-eight orbit), Laser (locks on, burns the line; L7 twin spinning beams). Duplicate = +1 swing/boomerang/beam. Weapon pool is now 8 (3 carried).
- v5.1: laser range grows every level (260 to 540) and is both its lock-on range and beam length; targets the nearest monster in range, hits everything along the full beam; L7 beams run to the arena wall.
- v5.2: boomerang ricochets (L4 1 bounce, L6 2, 160px range); L7 Rampage = 3 persistent boomerangs bouncing off arena walls hitting monsters (0.4s per monster). Laser L7 = wider (22px) beam to the wall, 0.7s rest, no spinning.
- v5.3: Rampage boomerangs turn a random +-0.4 rad on every wall bounce.
