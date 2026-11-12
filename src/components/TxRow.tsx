import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import type { AppData, Transaction } from '../types';
import { peso } from '../lib/format';

export function TxRow({ tx, data, onClick }: { tx: Transaction; data: AppData; onClick: () => void }) {
  const cat = data.categories.find(c => c.id === tx.categoryId);
  const acc = data.accounts.find(a => a.id === tx.accountId);
  const to = data.accounts.find(a => a.id === tx.toAccountId);
  const title = tx.note || (tx.type === 'transfer' ? 'Transfer' : cat?.name ?? 'Uncategorized');
  const sub = tx.type === 'transfer'
    ? `${acc?.name ?? '—'} → ${to?.name ?? '—'}`
    : `${cat?.name ?? 'Uncategorized'} · ${acc?.name ?? '—'}`;
  const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : '';
  return (
    <button className="row" onClick={onClick}>
      <span className={`row-icon ${tx.type}`}>
        {tx.type === 'income' ? <ArrowDownLeft size={17} /> : tx.type === 'expense' ? <ArrowUpRight size={17} /> : <ArrowLeftRight size={16} />}
      </span>
      <span className="row-main"><span className="row-title">{title}</span><span className="row-sub">{sub}</span></span>
      <span className={`row-amount ${tx.type}`}>{sign}{peso(tx.amount)}</span>
    </button>
  );
}
