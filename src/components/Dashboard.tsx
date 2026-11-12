import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Check, Scale, Wallet } from 'lucide-react';
import type { BalanceView, Transaction } from '../types';
import * as A from '../lib/actions';
import { categoryBreakdown, monthElapsedPct, monthSummary, upcomingItems, workspaceBalance } from '../lib/calc';
import { daysInMonth, monthKeyOf, monthLabel, pct, peso, shortDate, todayStr } from '../lib/format';
import { useActive, useStore } from '../lib/store';
import type { View } from '../App';
import { Donut, EmptyState, MonthSwitcher, ProgressBar, StatusPill, useUI } from './ui';
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

  const today = todayStr();
  const sum = monthSummary(data, ws.id, month);
  const rows = categoryBreakdown(data, ws.id, month);
  const elapsed = monthElapsedPct(month, today);
  const upcoming = upcomingItems(data, ws.id, month);
  const recent = [...data.transactions].reverse()
    .filter(t => t.workspaceId === ws.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const view: BalanceView = data.prefs.balanceView[ws.id] ?? 'all';
  const selected = (data.prefs.selectedAccountIds[ws.id] ?? []).filter(id => accounts.some(a => a.id === id));
  const balance = workspaceBalance(data, ws.id, view, selected);
  const balanceCaption =
    view === 'all' ? `All active accounts` : view === 'primary' ? 'Primary account only'
      : selected.length === 0 ? 'No accounts selected' : `${selected.length} selected account${selected.length > 1 ? 's' : ''}`;

  const paceAhead = elapsed != null && sum.budget > 0 && sum.usedPct > elapsed + 10;
  const incomeLabel = isBusiness ? 'Sales' : 'Income';
  const netLabel = isBusiness ? 'Profit' : 'Net';
  const daysLeft = elapsed != null ? daysInMonth(month) - Number(today.slice(8, 10)) : null;

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

      {/* ---- Budget used ---- */}
      <section className="card hero" aria-label="Budget used">
        <div className="hero-top">
          <span className="eyebrow">BUDGET USED · {monthLabel(month).toUpperCase()}</span>
          <StatusPill status={sum.status} ahead={paceAhead} />
        </div>
        {sum.budget > 0 ? (
          <>
            <div className="hero-figure">
              <span className={`hero-pct ${sum.status}`}>{pct(sum.usedPct)}</span>
              <span className="hero-of"><strong>{peso(sum.spent)}</strong> of {peso(sum.budget)}</span>
            </div>
            <ProgressBar pct={sum.usedPct} status={sum.status} marker={elapsed} label="Budget used" />
            <div className="bar-legend">
              <span>{sum.remaining >= 0 ? `${peso(sum.remaining)} left` : `${peso(-sum.remaining)} over`}</span>
              {elapsed != null && <span>Day {Number(today.slice(8, 10))} of {daysInMonth(month)} · {daysLeft} day{daysLeft === 1 ? '' : 's'} left</span>}
            </div>
            <div className="hero-stats">
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
            </div>
          </>
        ) : (
          <EmptyState
            title="Set your monthly budget"
            action={<button className="btn primary" onClick={() => go('budgets')}><Scale size={16} /> Set category limits</button>}
          >
            Give each spending category a monthly limit and this card will show how much of your budget you’ve used.
            {sum.spent > 0 && <> So far this month you’ve spent <strong>{peso(sum.spent)}</strong>.</>}
          </EmptyState>
        )}
      </section>

      {/* ---- Income / spent / net ---- */}
      <section className="metrics">
        <Metric icon={<ArrowDownLeft size={17} />} tone="green" title={`${incomeLabel} this month`} value={peso(sum.income)} />
        <Metric icon={<ArrowUpRight size={17} />} tone="copper" title="Spent" value={peso(sum.spent)} />
        <Metric icon={<Scale size={17} />} tone="neutral" title={netLabel} value={peso(sum.net)} negative={sum.net < 0} />
      </section>

      {/* ---- Balance ---- */}
      <section className="card balance" aria-label="Available balance">
        <div className="balance-row">
          <div>
            <div className="eyebrow">AVAILABLE BALANCE</div>
            <div className="balance-value">{peso(balance)}</div>
            <div className="muted-text small">{balanceCaption} · {ws.name}</div>
          </div>
          <span className="balance-icon"><Wallet size={22} /></span>
        </div>
        {accounts.length > 0 && (
          <div className="balance-controls">
            <div className="segmented" role="group" aria-label="Balance view">
              {(['all', 'selected', 'primary'] as BalanceView[]).map(v => (
                <button key={v} className={view === v ? 'chosen' : ''} aria-pressed={view === v}
                  onClick={() => { apply(d => A.setBalanceView(d, ws.id, v)); if (v === 'selected') setShowPicker(true); }}>
                  {v === 'all' ? 'All accounts' : v === 'selected' ? 'Selected' : 'Primary'}
                </button>
              ))}
            </div>
            <button className="link-btn" onClick={() => setShowPicker(s => !s)}>{showPicker ? 'Hide accounts' : 'Choose accounts'}</button>
          </div>
        )}
        {showPicker && (
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
            <div><h2>Spending by category</h2><p>{monthLabel(month)}</p></div>
            <button className="link-btn" onClick={() => go('budgets')}>Edit limits</button>
          </div>
          {sum.spent === 0 && rows.every(r => r.limit === 0) ? (
            <EmptyState title="Nothing spent yet">Expenses you add will show up here, by category.</EmptyState>
          ) : (
            <div className="cat-wrap">
              <Donut rows={rows} total={sum.spent} />
              <ul className="cat-list">
                {rows.map(r => (
                  <li key={r.id ?? 'none'}>
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
                ))}
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

function Metric({ icon, tone, title, value, negative }: { icon: React.ReactNode; tone: string; title: string; value: string; negative?: boolean }) {
  return (
    <div className="card metric">
      <span className={`metric-icon ${tone}`}>{icon}</span>
      <span className="metric-title">{title}</span>
      <strong className={`metric-value ${negative ? 'neg' : ''}`}>{value}</strong>
    </div>
  );
}
