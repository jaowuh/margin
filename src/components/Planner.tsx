import { useState } from 'react';
import { CalendarClock, Check, Plus, Repeat } from 'lucide-react';
import type { Scheduled } from '../types';
import * as A from '../lib/actions';
import { monthKeyOf, monthLabel, peso, round2, shortDate, todayStr } from '../lib/format';
import { useActive, useStore } from '../lib/store';
import { EmptyState, MonthSwitcher, useUI } from './ui';
import { ScheduledModal } from './ScheduledModal';

export default function Planner({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const { data, apply } = useStore();
  const { ws, accounts, categories } = useActive();
  const { toast } = useUI();
  const [editing, setEditing] = useState<Scheduled | 'new' | null>(null);
  const today = todayStr();

  const mine = data.scheduled.filter(s => s.workspaceId === ws.id);
  // Unpaid items from earlier months stay visible until handled; paid ones only show in their own month.
  const planned = mine.filter(s => s.status === 'planned' && monthKeyOf(s.dueDate) <= month).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const paid = mine.filter(s => s.status === 'paid' && monthKeyOf(s.dueDate) === month).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const plannedTotal = round2(planned.filter(s => s.type === 'expense' && monthKeyOf(s.dueDate) === month).reduce((t, s) => t + s.amount, 0));
  const paidTotal = round2(paid.filter(s => s.type === 'expense').reduce((t, s) => t + s.amount, 0));

  function pay(s: Scheduled) {
    const acc = accounts.find(a => a.id === s.accountId) ?? accounts.find(a => a.isPrimary) ?? accounts[0];
    if (!acc) return toast('Add an account first (Accounts tab).');
    const before = data;
    apply(d => A.payScheduled(d, s.id, acc.id));
    toast(`${s.title} marked as ${s.type === 'income' ? 'received' : 'paid'} · ${acc.name}`, { label: 'Undo', run: () => apply(() => before) });
  }

  const renderRow = (s: Scheduled) => {
    const d = shortDate(s.dueDate);
    const cat = categories.find(c => c.id === s.categoryId);
    const overdue = s.status === 'planned' && s.dueDate < today && s.type === 'expense';
    return (
      <li key={s.id} className={`upcoming ${s.status === 'paid' ? 'done' : ''}`}>
        <button className="upcoming-main" onClick={() => setEditing(s)} aria-label={`Edit ${s.title}`}>
          <span className="date-tile"><strong>{d.day}</strong><span>{d.mon}</span></span>
          <span className="row-main">
            <span className="row-title">{s.title}{s.repeat === 'monthly' && <Repeat size={12} className="repeat-icon" aria-label="Repeats monthly" />}</span>
            <span className={`row-sub ${overdue ? 'neg' : ''}`}>
              {overdue ? 'Overdue · ' : ''}{s.type === 'income' ? 'Expected income' : 'Expected payment'}{cat ? ` · ${cat.name}` : ''}
            </span>
          </span>
          <strong className="row-amount">{peso(s.amount)}</strong>
        </button>
        {s.status === 'planned'
          ? <button className="btn small" onClick={() => pay(s)}><Check size={14} /> {s.type === 'income' ? 'Got it' : 'Paid'}</button>
          : <span className="pill ok">{s.type === 'income' ? 'Received' : 'Paid'}</span>}
      </li>
    );
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><div className="eyebrow">{ws.name.toUpperCase()}</div><h1>Planner</h1></div>
        <MonthSwitcher month={month} onChange={setMonth} />
      </div>

      <div className="totals">
        <span>Still to pay in {monthLabel(month)}: <strong>{peso(plannedTotal)}</strong></span>
        <span>Paid: <strong>{peso(paidTotal)}</strong></span>
      </div>

      <section className="card">
        <div className="card-head">
          <div><h2>Planned</h2><p>Bills and payments you expect. Tap “Paid” to record them as real expenses.</p></div>
          <button className="btn primary small" onClick={() => setEditing('new')}><Plus size={15} /> Plan</button>
        </div>
        {planned.length === 0 ? (
          <EmptyState title="Nothing planned" action={<button className="btn" onClick={() => setEditing('new')}><CalendarClock size={16} /> Plan a bill</button>}>
            Add rent, loan payments, subscriptions — anything you know is coming.
          </EmptyState>
        ) : <ul className="plain-list">{planned.map(renderRow)}</ul>}
      </section>

      {paid.length > 0 && (
        <section className="card">
          <div className="card-head"><div><h2>Done</h2><p>Paid in {monthLabel(month)}</p></div></div>
          <ul className="plain-list">{paid.map(renderRow)}</ul>
        </section>
      )}

      {editing && <ScheduledModal item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
