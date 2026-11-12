import { useState } from 'react';
import { Archive, Pencil, Plus, RotateCcw, Star, Trash2 } from 'lucide-react';
import type { Account } from '../types';
import * as A from '../lib/actions';
import { accountBalance, workspaceBalance } from '../lib/calc';
import { peso } from '../lib/format';
import { useActive, useStore } from '../lib/store';
import { AccountModal, ACCOUNT_TYPES } from './AccountModal';
import { useUI } from './ui';

export default function Accounts() {
  const { data, apply } = useStore();
  const { ws, accounts, allAccounts } = useActive();
  const { confirm, toast } = useUI();
  const [editing, setEditing] = useState<Account | 'new' | null>(null);
  const archived = allAccounts.filter(a => !a.isActive);
  const total = workspaceBalance(data, ws.id, 'all', []);

  async function remove(a: Account) {
    const hasHistory = A.accountHasActivity(data, a.id);
    const ok = await confirm({
      title: hasHistory ? `Archive “${a.name}”?` : `Delete “${a.name}”?`,
      message: hasHistory
        ? 'It has transactions, so it will be archived: hidden from balances and menus, but its history is kept. You can restore it any time.'
        : 'This account has no transactions and will be removed.',
      confirmLabel: hasHistory ? 'Archive' : 'Delete', danger: !hasHistory,
    });
    if (!ok) return;
    const before = data;
    apply(d => A.removeAccount(d, a.id));
    toast(hasHistory ? `“${a.name}” archived` : `“${a.name}” deleted`, { label: 'Undo', run: () => apply(() => before) });
  }

  return (
    <div className="page narrow">
      <div className="page-head">
        <div><div className="eyebrow">{ws.name.toUpperCase()}</div><h1>Accounts</h1></div>
        <button className="btn primary" onClick={() => setEditing('new')}><Plus size={16} /> Add account</button>
      </div>

      <div className="totals"><span>Total across active accounts</span><strong>{peso(total)}</strong></div>

      <section className="card">
        {accounts.length === 0 ? (
          <p className="muted-text">No accounts yet. Add your cash, bank, or e-wallet to track balances.</p>
        ) : (
          <ul className="plain-list">
            {accounts.map(a => (
              <li key={a.id} className="account">
                <span className="row-main">
                  <span className="row-title">{a.name}{a.isPrimary && <span className="pill ok">Primary</span>}</span>
                  <span className="row-sub">{ACCOUNT_TYPES[a.type]}</span>
                </span>
                <strong className={`row-amount ${accountBalance(data, a) < 0 ? 'neg' : ''}`}>{peso(accountBalance(data, a))}</strong>
                <span className="actions">
                  {!a.isPrimary && <button className="icon-btn" onClick={() => apply(d => A.setPrimaryAccount(d, a.id))} aria-label={`Make ${a.name} primary`} title="Make primary"><Star size={16} /></button>}
                  <button className="icon-btn" onClick={() => setEditing(a)} aria-label={`Edit ${a.name}`} title="Edit"><Pencil size={16} /></button>
                  <button className="icon-btn" onClick={() => remove(a)} aria-label={`Remove ${a.name}`} title="Archive or delete">
                    {A.accountHasActivity(data, a.id) ? <Archive size={16} /> : <Trash2 size={16} />}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {archived.length > 0 && (
        <section className="card">
          <div className="card-head"><div><h2>Archived</h2><p>Hidden from balances. History is kept.</p></div></div>
          <ul className="plain-list">
            {archived.map(a => (
              <li key={a.id} className="account done">
                <span className="row-main"><span className="row-title">{a.name}</span><span className="row-sub">{ACCOUNT_TYPES[a.type]} · {peso(accountBalance(data, a))}</span></span>
                <button className="btn small" onClick={() => apply(d => A.restoreAccount(d, a.id))}><RotateCcw size={14} /> Restore</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && <AccountModal account={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
