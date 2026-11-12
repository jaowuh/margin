import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Transaction, TxType } from '../types';
import { monthTransactions } from '../lib/calc';
import { dayLabel, monthLabel, peso, round2 } from '../lib/format';
import { useActive, useStore } from '../lib/store';
import { EmptyState, MonthSwitcher } from './ui';
import { TxRow } from './TxRow';

export default function Transactions({ month, setMonth, editTx, addTx }: { month: string; setMonth: (m: string) => void; editTx: (t: Transaction) => void; addTx: () => void }) {
  const { data } = useStore();
  const { ws, isBusiness, categories } = useActive();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | TxType>('all');
  const [categoryId, setCategoryId] = useState('');

  const all = useMemo(() => monthTransactions(data, ws.id, month), [data, ws.id, month]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...all].reverse() // newest-added first within a day
      .filter(t => type === 'all' || t.type === type)
      .filter(t => !categoryId || (categoryId === 'none' ? !t.categoryId : t.categoryId === categoryId))
      .filter(t => {
        if (!q) return true;
        const cat = categories.find(c => c.id === t.categoryId)?.name ?? '';
        return `${t.note} ${cat}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [all, type, categoryId, query, categories]);

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of filtered) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [filtered]);

  const totalIn = round2(filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
  const totalOut = round2(filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
  const filtering = type !== 'all' || !!categoryId || !!query.trim();

  return (
    <div className="page">
      <div className="page-head">
        <div><div className="eyebrow">{ws.name.toUpperCase()}</div><h1>Transactions</h1></div>
        <MonthSwitcher month={month} onChange={setMonth} />
      </div>

      <div className="card filters">
        <div className="search">
          <Search size={16} />
          <input className="input" placeholder="Search notes or categories" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search transactions" />
        </div>
        <div className="chips" role="group" aria-label="Filter by type">
          {(['all', 'expense', 'income', 'transfer'] as const).map(t => (
            <button key={t} className={`chip ${type === t ? 'chosen' : ''}`} aria-pressed={type === t} onClick={() => setType(t)}>
              {t === 'all' ? 'All' : t === 'expense' ? 'Expenses' : t === 'income' ? (isBusiness ? 'Sales' : 'Income') : 'Transfers'}
            </button>
          ))}
        </div>
        <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          <option value="none">Uncategorized</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {filtered.length > 0 && (
        <div className="totals">
          <span>{filtered.length} transaction{filtered.length === 1 ? '' : 's'}{filtering ? ' (filtered)' : ''}</span>
          <span><span className="pos">+{peso(totalIn)}</span> · <span>−{peso(totalOut)}</span></span>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card">
          <EmptyState title={filtering ? 'No matches' : `No transactions in ${monthLabel(month)}`}
            action={!filtering ? <button className="btn primary" onClick={addTx}>Add transaction</button> : undefined}>
            {filtering ? 'Try clearing the search or filters.' : 'Record income and expenses as they happen.'}
          </EmptyState>
        </div>
      ) : (
        groups.map(([date, txs]) => (
          <section key={date} className="day-group">
            <h3>{dayLabel(date)}</h3>
            <div className="card rows">{txs.map(t => <TxRow key={t.id} tx={t} data={data} onClick={() => editTx(t)} />)}</div>
          </section>
        ))
      )}
    </div>
  );
}
