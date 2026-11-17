import { useState } from 'react';
import { CalendarClock, Check, Scale } from 'lucide-react';
import type { BalanceView, LimitPeriod, Transaction } from '../types';
import * as A from '../lib/actions';
import { categoryBreakdown, dayOfWeekMon, monthElapsedPct, monthSummary, statusFor, upcomingItems, workspaceBalance } from '../lib/calc';
import type { CategoryRow } from '../lib/calc';
import { daysInMonth, monthKeyOf, monthLabel, pct, peso, shortDate, todayStr } from '../lib/format';
import { useActive, useStore } from '../lib/store';
import type { View } from '../App';
import { Donut, EmptyState, MonthSwitcher, ProgressBar, useUI } from './ui';
import { TxRow } from './TxRow';

interface Props {
  month: string;
  setMonth: (m: string) => void;
  go: (v: View) => void;
  editTx: (t: Transaction) => void;
}

export default function Dashboard({ month, setMonth, go, editTx }: Props) {
  const { data, apply } = useStore();
  const { ws, isBusiness, accounts } = useActive();
  const { toast } = useUI();
  const [showPicker, setShowPicker] = useState(false);
  const [period, setPeriod] = useState<LimitPeriod>('month');

  const today = todayStr();
  const elapsed = monthElapsedPct(month, today);
  const monthSum = monthSummary(data, ws.id, month);
  // Day and Week views only make sense for the current month.
  const eff: LimitPeriod = elapsed != null ? period : 'month';
  const sum = eff === 'month' ? monthSum : monthSummary(data, ws.id, month, eff, today);
  const rows = categoryBreakdown(data, ws.id, month, eff, today);
  const dow = dayOfWeekMon(today);
  const upcoming = upcomingItems(data, ws.id, month);
  const recent = [...data.transactions].reverse()
    .filter(t => t.workspaceId === ws.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const entries = buildEntries(rows);
  const view: BalanceView = data.prefs.balanceView[ws.id] ?? 'all';
  const selected = (data.prefs.selectedAccountIds[ws.id] ?? []).filter(id => accounts.some(a => a.id === id));
  const balance = workspaceBalance(data, ws.id, view, selected);
  const balanceCaption =
    view === 'all' ? `All active accounts` : view === 'primary' ? 'Primary account only'
      : selected.length === 0 ? 'No accounts selected' : `${selected.length} selected account${selected.length > 1 ? 's' : ''}`;

  const paceAhead = eff === 'month' && elapsed != null && sum.budget > 0 && sum.usedPct > elapsed + 10;
  const incomeLabel = isBusiness ? 'Sales' : 'Income';
  const netLabel = isBusiness ? 'Profit' : 'Net';
  const daysLeft = elapsed != null ? daysInMonth(month) - Number(today.slice(8, 10)) : null;

  const budgetWord = eff === 'month' ? 'budget' : `${eff === 'day' ? 'today’s' : 'this week’s'} budget`;
  const verdict = sum.status === 'over' ? `You’re over ${budgetWord}`
    : sum.status === 'warn' ? 'Close to your limit'
      : paceAhead ? 'Within budget, but spending fast' : `You’re within ${budgetWord}`;
  const verdictTone = sum.status === 'ok' && paceAhead ? 'warn' : sum.status;
  const perDay = eff === 'month' && elapsed != null && daysLeft != null && sum.remaining > 0 ? Math.round(sum.remaining / Math.max(1, daysLeft + 1)) : null;

  function quickPay(id: string) {
    const item = data.scheduled.find(s => s.id === id);
    if (!item) return;
    const acc = accounts.find(a => a.id === item.accountId) ?? accounts.find(a => a.isPrimary) ?? accounts[0];
    if (!acc) return toast('Add an account first (Accounts tab).');
    const before = data;
    apply(d => A.payScheduled(d, id, acc.id));
    toast(`${item.title} marked as paid`, { label: 'Undo', run: () => apply(() => before) });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{ws.name.toUpperCase()}</div>
          <h1>Overview</h1>
        </div>
        <MonthSwitcher month={month} onChange={setMonth} />
      </div>

      {/* ---- Am I within budget? ---- */}
      <section className={`card hero ${sum.budget > 0 ? sum.status : ''}`} aria-label="Budget status">
        <div className="hero-top">
          <div className="eyebrow">BUDGET · {(eff === 'day' ? 'TODAY' : eff === 'week' ? 'THIS WEEK' : monthLabel(month)).toUpperCase()}</div>
          {elapsed != null && monthSum.budget > 0 && (
            <div className="segmented mini" role="group" aria-label="Budget period">
              {(['day', 'week', 'month'] as LimitPeriod[]).map(v => (
                <button key={v} className={eff === v ? 'chosen' : ''} aria-pressed={eff === v} onClick={() => setPeriod(v)}>
                  {v === 'day' ? 'Day' : v === 'week' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
          )}
        </div>
        {sum.budget > 0 ? (
          <>
            <h2 className={`verdict ${verdictTone}`}>{verdict}</h2>
            <div className="hero-figure">
              <span className={`hero-pct ${sum.status}`}>{sum.remaining >= 0 ? peso(sum.remaining) : peso(-sum.remaining)}</span>
              <span className="hero-word">{sum.remaining >= 0 ? 'left' : 'over'}</span>
            </div>
            <div className="hero-of"><strong>{peso(sum.spent)}</strong> spent of {peso(sum.budget)} · {pct(sum.usedPct)} used</div>
            <ProgressBar pct={sum.usedPct} status={sum.status} marker={eff === 'month' ? elapsed : eff === 'week' ? (dow / 7) * 100 : null} label="Budget used" />
            <div className="bar-legend">
              {eff === 'month' && elapsed != null && daysLeft != null
                ? <span>Day {Number(today.slice(8, 10))} of {daysInMonth(month)} · {daysLeft} day{daysLeft === 1 ? '' : 's'} left</span>
                : eff === 'week' ? <span>Day {dow} of 7 · {7 - dow} day{7 - dow === 1 ? '' : 's'} left in the week</span>
                  : eff === 'day' ? <span>Resets at midnight</span> : <span />}
              {perDay != null && <span>≈ {peso(perDay)} a day to stay within</span>}
            </div>
            {eff !== 'month' && (
              <div className={`month-ctx ${monthSum.status}`}>
                Month: {monthSum.remaining >= 0 ? `${peso(monthSum.remaining)} left` : `${peso(-monthSum.remaining)} over`} · {pct(monthSum.usedPct)} used
              </div>
            )}
            {eff === 'month' && <div className="hero-stats">
              <div>
                <span className="stat-label">After upcoming bills</span>
                <strong className={sum.leftAfterUpcoming < 0 ? 'neg' : ''}>
                  {sum.leftAfterUpcoming >= 0 ? peso(sum.leftAfterUpcoming) : `${peso(-sum.leftAfterUpcoming)} short`}
                </strong>
                <small>{sum.upcomingExpenses > 0 ? `${peso(sum.upcomingExpenses)} still planned` : 'Nothing planned'}</small>
              </div>
              {sum.unbudgetedSpent > 0 && (
                <div>
                  <span className="stat-label">Not in any budget</span>
                  <strong>{peso(sum.unbudgetedSpent)}</strong>
                  <small>Spent in categories without a limit</small>
                </div>
              )}
            </div>}
          </>
        ) : (
          <EmptyState
            title="Set your monthly budget"
            action={<button className="btn primary" onClick={() => go('budgets')}><Scale size={16} /> Set category limits</button>}
          >
            Give each spending category a monthly limit and this card will tell you whether you’re still within budget.
            {sum.spent > 0 && <> So far this month you’ve spent <strong>{peso(sum.spent)}</strong>.</>}
          </EmptyState>
        )}
      </section>

      {/* ---- In / out, one slim line ---- */}
      <section className="card strip" aria-label="This month">
        <div><span>{incomeLabel}{eff === 'day' ? ' today' : eff === 'week' ? ' this week' : ''}</span><strong>{peso(sum.income)}</strong></div>
        <div><span>Spent{eff === 'day' ? ' today' : eff === 'week' ? ' this week' : ''}</span><strong>{peso(sum.spent)}</strong></div>
        <div><span>{netLabel}</span><strong className={sum.net < 0 ? 'neg' : ''}>{peso(sum.net)}</strong></div>
      </section>

      {/* ---- Balance ---- */}
      <section className="card balance" aria-label="Available balance">
        <div className="balance-row">
          <div>
            <div className="eyebrow">AVAILABLE BALANCE</div>
            <div className="balance-value">{peso(balance)}</div>
            <div className="muted-text small">{balanceCaption} · {ws.name}</div>
          </div>
          {accounts.length > 0 && <button className="link-btn" onClick={() => setShowPicker(x => !x)}>{showPicker ? 'Done' : 'Change view'}</button>}
        </div>
        {accounts.length > 0 && showPicker && (
          <div className="balance-controls">
            <div className="segmented" role="group" aria-label="Balance view">
              {(['all', 'selected', 'primary'] as BalanceView[]).map(v => (
                <button key={v} className={view === v ? 'chosen' : ''} aria-pressed={view === v}
                  onClick={() => { apply(d => A.setBalanceView(d, ws.id, v)); if (v === 'selected') setShowPicker(true); }}>
                  {v === 'all' ? 'All accounts' : v === 'selected' ? 'Selected' : 'Primary'}
                </button>
              ))}
            </div>
          </div>
        )}
        {showPicker && view === 'selected' && (
          <div className="picker">
            {accounts.map(a => {
              const on = selected.includes(a.id);
              return (
                <label key={a.id}>
                  <input type="checkbox" checked={on}
                    onChange={e => apply(d => A.setSelectedAccounts(d, ws.id, e.target.checked ? [...selected, a.id] : selected.filter(id => id !== a.id)))} />
                  <span>{a.name}{a.isPrimary ? ' · Primary' : ''}</span>
                  <strong>{peso(workspaceBalance(data, ws.id, 'selected', [a.id]))}</strong>
                </label>
              );
            })}
          </div>
        )}
        {accounts.length === 0 && (
          <p className="muted-text small">No accounts yet. <button className="link-btn" onClick={() => go('accounts')}>Add one</button> to track your balance.</p>
        )}
      </section>

      <div className="grid-2">
        {/* ---- Spending by category ---- */}
        <section className="card" aria-label="Spending by category">
          <div className="card-head">
            <div><h2>Spending by category</h2><p>{eff === 'day' ? 'Today' : eff === 'week' ? 'This week' : monthLabel(month)}</p></div>
            <button className="link-btn" onClick={() => go('budgets')}>Edit limits</button>
          </div>
          {sum.spent === 0 && rows.every(r => r.limit === 0) ? (
            <EmptyState title="Nothing spent yet">Expenses you add will show up here, by category.</EmptyState>
          ) : (
            <div className="cat-wrap">
              <Donut rows={rows} total={sum.spent} />
              <ul className="cat-list">
                {entries.map(en => en.kind === 'group'
                  ? <GroupBlock key={`g-${en.name}`} g={en} />
                  : <CatItem key={en.row.id ?? 'none'} r={en.row} />)}
              </ul>
            </div>
          )}
        </section>

        <div className="stack">
          {/* ---- Upcoming ---- */}
          <section className="card" aria-label="Upcoming expenses">
            <div className="card-head">
              <div><h2>Upcoming</h2><p>Planned bills and expected income</p></div>
              <button className="link-btn" onClick={() => go('planner')}>Open planner</button>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState title="Nothing planned" action={<button className="btn" onClick={() => go('planner')}><CalendarClock size={16} /> Plan a bill</button>}>
                Add bills or loan payments you expect so Margin can show what’s left after them.
              </EmptyState>
            ) : (
              <ul className="plain-list">
                {upcoming.slice(0, 5).map(s => {
                  const d = shortDate(s.dueDate);
                  const overdue = s.dueDate < today && monthKeyOf(s.dueDate) <= month && s.type === 'expense';
                  return (
                    <li key={s.id} className="upcoming">
                      <span className="date-tile"><strong>{d.day}</strong><span>{d.mon}</span></span>
                      <span className="row-main">
                        <span className="row-title">{s.title}</span>
                        <span className={`row-sub ${overdue ? 'neg' : ''}`}>{overdue ? 'Overdue' : s.type === 'income' ? 'Expected income' : 'Expected payment'}</span>
                      </span>
                      <strong className="row-amount">{peso(s.amount)}</strong>
                      <button className="btn small" onClick={() => quickPay(s.id)} aria-label={`Mark ${s.title} as ${s.type === 'income' ? 'received' : 'paid'}`}>
                        <Check size={14} /> {s.type === 'income' ? 'Got it' : 'Paid'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ---- Recent ---- */}
          <section className="card" aria-label="Recent transactions">
            <div className="card-head">
              <div><h2>Recent</h2><p>Latest transactions</p></div>
              <button className="link-btn" onClick={() => go('transactions')}>See all</button>
            </div>
            {recent.length === 0 ? (
              <EmptyState title="No transactions yet">Tap “Add” to record your first one.</EmptyState>
            ) : (
              <div className="rows">{recent.map(t => <TxRow key={t.id} tx={t} data={data} onClick={() => editTx(t)} />)}</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

type Entry = { kind: 'row'; row: CategoryRow; spent: number } | { kind: 'group'; name: string; rows: CategoryRow[]; spent: number; limit: number };

/** Rows that share a group collapse into one entry; everything is ordered by spend. */
function buildEntries(rows: CategoryRow[]): Entry[] {
  const out: Entry[] = [];
  const groups = new Map<string, Extract<Entry, { kind: 'group' }>>();
  for (const r of rows) {
    if (!r.group) { out.push({ kind: 'row', row: r, spent: r.spent }); continue; }
    let g = groups.get(r.group);
    if (!g) { g = { kind: 'group', name: r.group, rows: [], spent: 0, limit: 0 }; groups.set(r.group, g); out.push(g); }
    g.rows.push(r); g.spent += r.spent; g.limit += r.limit;
  }
  return out.sort((a, b) => b.spent - a.spent);
}

function CatItem({ r, nested }: { r: CategoryRow; nested?: boolean }) {
  return (
    <li className={nested ? 'nested' : ''}>
      <div className="cat-line">
        <span className="dot" style={{ background: r.color }} />
        <span className="cat-name">{r.name}</span>
        <span className="cat-amt">
          <strong className={r.status === 'over' ? 'neg' : ''}>{peso(r.spent)}</strong>
          {r.limit > 0 ? <span className="of"> / {peso(r.limit)}</span> : <span className="of"> · no limit</span>}
        </span>
      </div>
      {r.limit > 0 && (
        <>
          <ProgressBar pct={r.pct} status={r.status} label={`${r.name} budget used`} />
          <div className={`cat-foot ${r.status}`}>
            {r.status === 'over' ? `${peso(r.spent - r.limit)} over` : `${peso(r.limit - r.spent)} left`} · {pct(r.pct)}
          </div>
        </>
      )}
    </li>
  );
}

function GroupBlock({ g }: { g: Extract<Entry, { kind: 'group' }> }) {
  const status = statusFor(g.spent, g.limit);
  const p = g.limit > 0 ? (g.spent / g.limit) * 100 : 0;
  return (
    <li className="group-block">
      <details open>
        <summary>
          <div className="cat-line">
            <span className="cat-name group-name">{g.name}</span>
            <span className="cat-amt">
              <strong className={status === 'over' ? 'neg' : ''}>{peso(g.spent)}</strong>
              {g.limit > 0 ? <span className="of"> / {peso(g.limit)}</span> : <span className="of"> · no limit</span>}
            </span>
          </div>
          {g.limit > 0 && (
            <>
              <ProgressBar pct={p} status={status} label={`${g.name} budget used`} />
              <div className={`cat-foot ${status}`}>
                {status === 'over' ? `${peso(g.spent - g.limit)} over` : `${peso(g.limit - g.spent)} left`} · {pct(p)}
              </div>
            </>
          )}
        </summary>
        <ul className="group-kids">{g.rows.map(r => <CatItem key={r.id ?? 'none'} r={r} nested />)}</ul>
      </details>
    </li>
  );
}
