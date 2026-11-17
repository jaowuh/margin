import { useEffect, useState } from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import type { Category, LimitPeriod } from '../types';
import * as A from '../lib/actions';
import { categoryBreakdown, monthlyLimitFor } from '../lib/calc';
import { monthLabel, peso, todayStr } from '../lib/format';
import { useActive, useStore } from '../lib/store';
import { Field, useUI } from './ui';
import BudgetWizard from './BudgetWizard';
import { GoalsEditor } from './Savings';

export default function Budgets() {
  const { data, apply } = useStore();
  const { ws, isBusiness, categories } = useActive();
  const { confirm, toast } = useUI();
  const [wizard, setWizard] = useState(false);
  const expense = categories.filter(c => c.kind === 'expense');
  const income = categories.filter(c => c.kind === 'income');
  const month = todayStr().slice(0, 7);
  const total = expense.reduce((s, c) => s + monthlyLimitFor(c, month), 0);
  const groups = [...new Set(expense.map(c => c.group).filter((g): g is string => !!g))];
  const spentById = new Map(categoryBreakdown(data, ws.id, month).map(r => [r.id, r.spent]));

  async function remove(c: Category) {
    const used = data.transactions.filter(t => t.categoryId === c.id).length;
    const ok = await confirm({
      title: `Delete “${c.name}”?`,
      message: used > 0
        ? `${used} transaction${used > 1 ? 's' : ''} use this category. They’ll be kept and shown as Uncategorized.`
        : 'This category has no transactions.',
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    const before = data;
    apply(d => A.deleteCategory(d, c.id));
    toast(`“${c.name}” deleted`, { label: 'Undo', run: () => apply(() => before) });
  }

  return (
    <div className="page narrow">
      <div className="page-head">
        <div><div className="eyebrow">{ws.name.toUpperCase()}</div><h1>Budgets</h1></div>
        <button className="btn" onClick={() => setWizard(true)}><Wand2 size={16} /> Budget wizard</button>
      </div>
      {wizard && <BudgetWizard onClose={() => setWizard(false)} />}

      <section className="card">
        <div className="card-head">
          <div><h2>Spending limits</h2><p>Set each limit per day, week or month. They repeat, and Margin works out the rest. Leave blank to track without a limit.</p></div>
          <div className="total-chip"><span>Total / month</span><strong>{peso(total)}</strong></div>
        </div>
        {expense.length === 0 && <p className="muted-text small">No expense categories yet. Add one below.</p>}
        <ul className="plain-list">
          {expense.map(c => <CategoryEditor key={c.id} cat={c} month={month} groups={groups} spent={spentById.get(c.id) ?? 0} onDelete={() => remove(c)} />)}
        </ul>
        <AddCategory kind="expense" workspaceId={ws.id} groups={groups} />
        <p className="muted-text small">“Spent” shows {monthLabel(month)}.</p>
      </section>

      <GoalsEditor />

      <section className="card">
        <div className="card-head"><div><h2>{isBusiness ? 'Sales & income categories' : 'Income categories'}</h2><p>Used to label money coming in. No limits needed.</p></div></div>
        <ul className="plain-list">
          {income.map(c => <CategoryEditor key={c.id} cat={c} month={month} groups={groups} spent={0} onDelete={() => remove(c)} />)}
        </ul>
        <AddCategory kind="income" workspaceId={ws.id} groups={groups} />
      </section>
    </div>
  );
}

const PERIODS: { id: LimitPeriod; label: string }[] = [{ id: 'day', label: 'per day' }, { id: 'week', label: 'per week' }, { id: 'month', label: 'per month' }];

function CategoryEditor({ cat, month, groups, spent, onDelete }: { cat: Category; month: string; groups: string[]; spent: number; onDelete: () => void }) {
  const { apply } = useStore();
  const period: LimitPeriod = cat.limitPeriod ?? 'month';
  const amount = period === 'month' ? cat.monthlyLimit : (cat.limitAmount ?? 0);
  const [name, setName] = useState(cat.name);
  const [limit, setLimit] = useState(amount ? String(amount) : '');
  const [group, setGroup] = useState(cat.group ?? '');
  const isExpense = cat.kind === 'expense';

  // Keep the fields in sync if the data changes elsewhere (e.g. Undo).
  useEffect(() => setName(cat.name), [cat.name]);
  useEffect(() => setLimit(amount ? String(amount) : ''), [amount]);
  useEffect(() => setGroup(cat.group ?? ''), [cat.group]);

  const commitName = () => {
    if (name.trim() && name.trim() !== cat.name) apply(d => A.updateCategory(d, cat.id, { name }));
    else setName(cat.name);
  };
  const commitLimit = () => {
    const n = Number(limit.replace(/[₱,\s]/g, ''));
    const v = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : amount;
    setLimit(v ? String(v) : '');
    if (v !== amount) apply(d => A.setCategoryLimit(d, cat.id, v, period));
  };
  const commitGroup = () => { if (group.trim() !== (cat.group ?? '')) apply(d => A.setCategoryGroup(d, cat.id, group)); };
  const monthly = monthlyLimitFor(cat, month);

  return (
    <li className={`cat-edit ${isExpense ? 'expense' : ''}`}>
      <span className="dot" style={{ background: cat.color }} />
      <input className="input" value={name} maxLength={40} aria-label="Category name"
        onChange={e => setName(e.target.value)} onBlur={commitName} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      <button className="icon-btn" onClick={onDelete} aria-label={`Delete ${cat.name}`}><Trash2 size={16} /></button>
      {isExpense && (
        <div className="cat-sub">
          <div className="limit-box">
            <input className="input" inputMode="decimal" placeholder="No limit" value={limit} aria-label={`Limit for ${cat.name}`}
              onChange={e => setLimit(e.target.value)} onBlur={commitLimit} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
          </div>
          <select className="input period-select" value={period} aria-label={`Limit period for ${cat.name}`}
            onChange={e => apply(d => A.setCategoryLimit(d, cat.id, amount, e.target.value as LimitPeriod))}>
            {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <input className="input group-input" list="cg-groups" placeholder="Group (optional)" maxLength={30} value={group} aria-label={`Group for ${cat.name}`}
            onChange={e => setGroup(e.target.value)} onBlur={commitGroup} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
          <datalist id="cg-groups">{groups.map(g => <option key={g} value={g} />)}</datalist>
          {(period !== 'month' && amount > 0) || spent > 0 ? (
            <small className="cat-note">
              {period !== 'month' && amount > 0 ? `≈ ${peso(monthly)} / month` : ''}{period !== 'month' && amount > 0 && spent > 0 ? ' · ' : ''}{spent > 0 ? `${peso(spent)} spent this month` : ''}
            </small>
          ) : null}
        </div>
      )}
    </li>
  );
}

function AddCategory({ kind, workspaceId, groups }: { kind: 'income' | 'expense'; workspaceId: string; groups: string[] }) {
  const { apply } = useStore();
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [period, setPeriod] = useState<LimitPeriod>('month');
  const [group, setGroup] = useState('');
  const submit = () => {
    if (!name.trim()) return;
    const n = Number(limit.replace(/[₱,\s]/g, ''));
    apply(d => A.addCategory(d, workspaceId, name, kind, Number.isFinite(n) && n > 0 ? n : 0, period, group));
    setName(''); setLimit(''); setGroup('');
  };
  return (
    <form className="add-row" onSubmit={e => { e.preventDefault(); submit(); }}>
      <Field label={kind === 'expense' ? 'New expense category' : 'New income category'}>
        <input className="input" maxLength={40} placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
      </Field>
      {kind === 'expense' && (
        <>
          <Field label="Limit">
            <input className="input" inputMode="decimal" placeholder="Optional" value={limit} onChange={e => setLimit(e.target.value)} />
          </Field>
          <Field label="Per">
            <select className="input" value={period} onChange={e => setPeriod(e.target.value as LimitPeriod)}>
              {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label.replace('per ', '')}</option>)}
            </select>
          </Field>
          <Field label="Group">
            <input className="input" list="cg-groups" maxLength={30} placeholder="Optional, e.g. Food" value={group} onChange={e => setGroup(e.target.value)} />
          </Field>
          <datalist id="cg-groups">{groups.map(g => <option key={g} value={g} />)}</datalist>
        </>
      )}
      <button type="submit" className="btn" disabled={!name.trim()}><Plus size={16} /> Add</button>
    </form>
  );
}
