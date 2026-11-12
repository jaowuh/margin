import { useState } from 'react';
import type { Scheduled } from '../types';
import * as A from '../lib/actions';
import { todayStr } from '../lib/format';
import { useActive, useStore } from '../lib/store';
import { Field, Modal, parseAmount, useUI } from './ui';

export function ScheduledModal({ item, onClose }: { item?: Scheduled; onClose: () => void }) {
  const { data, apply } = useStore();
  const { ws, isBusiness, accounts, categories } = useActive();
  const { toast } = useUI();

  const [type, setType] = useState<'expense' | 'income'>(item?.type ?? 'expense');
  const [title, setTitle] = useState(item?.title ?? '');
  const [amount, setAmount] = useState(item ? String(item.amount) : '');
  const [dueDate, setDueDate] = useState(item?.dueDate ?? todayStr());
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '');
  const [accountId, setAccountId] = useState(item?.accountId ?? '');
  const [repeat, setRepeat] = useState(item?.repeat === 'monthly');
  const [error, setError] = useState('');
  const paid = item?.status === 'paid';

  function save() {
    const amt = parseAmount(amount);
    if (!title.trim()) return setError('Give it a name, like "Internet bill".');
    if (!amt) return setError('Enter an amount greater than zero.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return setError('Pick a due date.');
    const base = {
      workspaceId: ws.id, type, title: title.trim(), amount: amt, dueDate,
      categoryId: categoryId || null, accountId: accountId || null, repeat: repeat ? ('monthly' as const) : ('none' as const),
    };
    if (item) apply(d => A.updateScheduled(d, { ...item, ...base }));
    else apply(d => A.addScheduled(d, base));
    onClose();
  }

  function remove() {
    if (!item) return;
    const before = data;
    apply(d => A.deleteScheduled(d, item.id));
    toast('Planned item removed', { label: 'Undo', run: () => apply(() => before) });
    onClose();
  }

  return (
    <Modal title={item ? 'Edit planned item' : 'Plan an expected expense'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); save(); }}>
        <div className="segmented wide">
          <button type="button" className={type === 'expense' ? 'chosen' : ''} onClick={() => { setType('expense'); setCategoryId(''); }}>Expense</button>
          <button type="button" className={type === 'income' ? 'chosen' : ''} onClick={() => { setType('income'); setCategoryId(''); }}>{isBusiness ? 'Sale' : 'Income'}</button>
        </div>
        <Field label="What is it?"><input className="input" autoFocus maxLength={80} placeholder="e.g. Internet bill" value={title} onChange={e => setTitle(e.target.value)} /></Field>
        <div className="two-col">
          <Field label="Amount"><input className="input" inputMode="decimal" placeholder="₱ 0.00" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
          <Field label="Due date"><input className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></Field>
        </div>
        <Field label="Category">
          <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">Uncategorized</option>
            {categories.filter(c => c.kind === type).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label={type === 'expense' ? 'Pay from' : 'Deposit to'} hint="Used when you tap “Mark paid”. Leave on default to use your primary account.">
          <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="">Primary account</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <label className="check">
          <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} />
          <span>Repeats every month</span>
        </label>
        {paid && <p className="muted-text small">This item is already marked as paid. Editing it won’t change the recorded transaction.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          {item && <button type="button" className="btn danger-ghost" onClick={remove}>Delete</button>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}
