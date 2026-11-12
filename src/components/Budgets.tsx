import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Category } from '../types';
import * as A from '../lib/actions';
import { categoryBreakdown } from '../lib/calc';
import { monthLabel, peso, todayStr } from '../lib/format';
import { useActive, useStore } from '../lib/store';
import { Field, useUI } from './ui';

export default function Budgets() {
  const { data, apply } = useStore();
  const { ws, isBusiness, categories } = useActive();
  const { confirm, toast } = useUI();
  const expense = categories.filter(c => c.kind === 'expense');
  const income = categories.filter(c => c.kind === 'income');
  const total = expense.reduce((s, c) => s + c.monthlyLimit, 0);
  const month = todayStr().slice(0, 7);
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
      </div>

      <section className="card">
        <div className="card-head">
          <div><h2>Monthly spending limits</h2><p>These repeat every month. Leave a limit blank to track a category without one.</p></div>
          <div className="total-chip"><span>Total / month</span><strong>{peso(total)}</strong></div>
        </div>
        {expense.length === 0 && <p className="muted-text small">No expense categories yet. Add one below.</p>}
        <ul className="plain-list">
          {expense.map(c => <CategoryEditor key={c.id} cat={c} spent={spentById.get(c.id) ?? 0} onDelete={() => remove(c)} />)}
        </ul>
        <AddCategory kind="expense" workspaceId={ws.id} />
        <p className="muted-text small">“Spent” shows {monthLabel(month)}.</p>
      </section>

      <section className="card">
        <div className="card-head"><div><h2>{isBusiness ? 'Sales & income categories' : 'Income categories'}</h2><p>Used to label money coming in. No limits needed.</p></div></div>
        <ul className="plain-list">
          {income.map(c => <CategoryEditor key={c.id} cat={c} spent={0} onDelete={() => remove(c)} />)}
        </ul>
        <AddCategory kind="income" workspaceId={ws.id} />
      </section>
    </div>
  );
}

function CategoryEditor({ cat, spent, onDelete }: { cat: Category; spent: number; onDelete: () => void }) {
  const { apply } = useStore();
  const [name, setName] = useState(cat.name);
  const [limit, setLimit] = useState(cat.monthlyLimit ? String(cat.monthlyLimit) : '');
  const isExpense = cat.kind === 'expense';

  // Keep the fields in sync if the data changes elsewhere (e.g. Undo).
  useEffect(() => setName(cat.name), [cat.name]);
  useEffect(() => setLimit(cat.monthlyLimit ? String(cat.monthlyLimit) : ''), [cat.monthlyLimit]);

  const commitName = () => {
    if (name.trim() && name.trim() !== cat.name) apply(d => A.updateCategory(d, cat.id, { name }));
    else setName(cat.name);
  };
  const commitLimit = () => {
    const n = Number(limit.replace(/[₱,\s]/g, ''));
    const v = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : cat.monthlyLimit;
    setLimit(v ? String(v) : '');
    if (v !== cat.monthlyLimit) apply(d => A.updateCategory(d, cat.id, { monthlyLimit: v }));
  };

  return (
    <li className="cat-edit">
      <span className="dot" style={{ background: cat.color }} />
      <input className="input" value={name} maxLength={40} aria-label="Category name"
        onChange={e => setName(e.target.value)} onBlur={commitName} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      {isExpense && (
        <div className="limit-box">
          <input className="input" inputMode="decimal" placeholder="No limit" value={limit} aria-label={`Monthly limit for ${cat.name}`}
            onChange={e => setLimit(e.target.value)} onBlur={commitLimit} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
          {spent > 0 && <small>{peso(spent)} spent</small>}
        </div>
      )}
      <button className="icon-btn" onClick={onDelete} aria-label={`Delete ${cat.name}`}><Trash2 size={16} /></button>
    </li>
  );
}

function AddCategory({ kind, workspaceId }: { kind: 'income' | 'expense'; workspaceId: string }) {
  const { apply } = useStore();
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const submit = () => {
    if (!name.trim()) return;
    const n = Number(limit.replace(/[₱,\s]/g, ''));
    apply(d => A.addCategory(d, workspaceId, name, kind, Number.isFinite(n) && n > 0 ? n : 0));
    setName(''); setLimit('');
  };
  return (
    <form className="add-row" onSubmit={e => { e.preventDefault(); submit(); }}>
      <Field label={kind === 'expense' ? 'New expense category' : 'New income category'}>
        <input className="input" maxLength={40} placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
      </Field>
      {kind === 'expense' && (
        <Field label="Monthly limit">
          <input className="input" inputMode="decimal" placeholder="Optional" value={limit} onChange={e => setLimit(e.target.value)} />
        </Field>
      )}
      <button type="submit" className="btn" disabled={!name.trim()}><Plus size={16} /> Add</button>
    </form>
  );
}
