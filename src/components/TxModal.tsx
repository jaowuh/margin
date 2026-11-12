import { useState } from 'react';
import type { Transaction, TxType } from '../types';
import * as A from '../lib/actions';
import { dayLabel, todayStr } from '../lib/format';
import { useActive, useStore } from '../lib/store';
import { Field, Modal, parseAmount, useUI } from './ui';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function TxModal({ tx, onClose }: { tx?: Transaction; onClose: () => void }) {
  const { data, apply } = useStore();
  const { ws, isBusiness, accounts, categories } = useActive();
  const { toast } = useUI();

  const primary = accounts.find(a => a.isPrimary) ?? accounts[0];
  const [type, setType] = useState<TxType>(tx?.type ?? 'expense');
  const [amount, setAmount] = useState(tx ? String(tx.amount) : '');
  const [date, setDate] = useState(tx?.date ?? todayStr());
  const [accountId, setAccountId] = useState(tx?.accountId ?? primary?.id ?? '');
  const [toAccountId, setToAccountId] = useState(tx?.toAccountId ?? '');
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? '');
  const [note, setNote] = useState(tx?.note ?? '');
  const [error, setError] = useState('');

  // Keep an archived account selectable when editing an old transaction.
  const accountOptions = [...accounts];
  for (const id of [tx?.accountId, tx?.toAccountId]) {
    const extra = data.accounts.find(a => a.id === id);
    if (extra && !accountOptions.some(a => a.id === extra.id)) accountOptions.push(extra);
  }
  const catOptions = categories.filter(c => c.kind === type);
  const incomeWord = isBusiness ? 'Sale' : 'Income';

  function switchType(next: TxType) {
    setType(next);
    setError('');
    if (!categories.some(c => c.id === categoryId && c.kind === next)) setCategoryId('');
    if (next === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      setToAccountId(accountOptions.find(a => a.id !== accountId)?.id ?? '');
    }
  }

  function save() {
    const amt = parseAmount(amount);
    if (!amt) return setError('Enter an amount greater than zero.');
    if (!accountId) return setError('Add an account first (Accounts tab).');
    if (!DATE_RE.test(date)) return setError('Pick a date.');
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) return setError('Choose two different accounts for a transfer.');
    const payload = {
      workspaceId: ws.id, type, amount: amt, date, accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      categoryId: type === 'transfer' ? null : categoryId || null,
      note: note.trim(),
    };
    if (tx) apply(d => A.updateTransaction(d, { ...payload, id: tx.id }));
    else apply(d => A.addTransaction(d, payload));
    toast(`${tx ? 'Updated' : 'Added'} · ${dayLabel(date)}`);
    onClose();
  }

  function remove() {
    if (!tx) return;
    const before = data;
    apply(d => A.deleteTransaction(d, tx.id));
    toast('Transaction deleted', { label: 'Undo', run: () => apply(() => before) });
    onClose();
  }

  return (
    <Modal title={tx ? 'Edit transaction' : 'New transaction'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); save(); }}>
        <div className="segmented wide" role="tablist" aria-label="Transaction type">
          {(['expense', 'income', 'transfer'] as TxType[]).map(t => (
            <button type="button" key={t} role="tab" aria-selected={type === t} className={type === t ? 'chosen' : ''} onClick={() => switchType(t)}>
              {t === 'expense' ? 'Expense' : t === 'income' ? incomeWord : 'Transfer'}
            </button>
          ))}
        </div>

        <Field label="Amount">
          <input className="input amount" autoFocus inputMode="decimal" placeholder="₱ 0.00" value={amount} onChange={e => setAmount(e.target.value)} />
        </Field>

        {type !== 'transfer' && (
          <Field label="Category">
            <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {catOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}

        <div className="two-col">
          <Field label={type === 'transfer' ? 'From account' : 'Account'}>
            <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)}>
              {accountOptions.map(a => <option key={a.id} value={a.id}>{a.name}{a.isActive ? '' : ' (archived)'}</option>)}
            </select>
          </Field>
          {type === 'transfer' ? (
            <Field label="To account">
              <select className="input" value={toAccountId} onChange={e => setToAccountId(e.target.value)}>
                <option value="">Choose…</option>
                {accountOptions.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Date">
              <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
          )}
        </div>
        {type === 'transfer' && (
          <Field label="Date"><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        )}

        <Field label="Note (optional)">
          <input className="input" maxLength={120} placeholder={type === 'expense' ? 'e.g. Groceries' : 'e.g. Weekend sales'} value={note} onChange={e => setNote(e.target.value)} />
        </Field>

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          {tx && <button type="button" className="btn danger-ghost" onClick={remove}>Delete</button>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}
