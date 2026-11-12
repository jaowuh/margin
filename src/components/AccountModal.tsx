import { useState } from 'react';
import type { Account, AccountType } from '../types';
import * as A from '../lib/actions';
import { useActive, useStore } from '../lib/store';
import { Field, Modal } from './ui';

export const ACCOUNT_TYPES: Record<AccountType, string> = {
  cash: 'Cash', bank: 'Bank account', e_wallet: 'E-wallet (GCash, Maya…)', credit_card: 'Credit card', other: 'Other',
};

export function AccountModal({ account, onClose }: { account?: Account; onClose: () => void }) {
  const { apply } = useStore();
  const { ws } = useActive();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'cash');
  const [opening, setOpening] = useState(account ? String(account.openingBalance) : '0');
  const [error, setError] = useState('');

  function save() {
    const clean = name.trim();
    const bal = Number(opening.replace(/[₱,\s]/g, ''));
    if (!clean) return setError('Give the account a name.');
    if (!Number.isFinite(bal) || Math.abs(bal) > 1e10) return setError('Enter a valid opening balance (negative is OK for a credit card).');
    const openingBalance = Math.round(bal * 100) / 100;
    if (account) apply(d => A.updateAccount(d, account.id, { name: clean, type, openingBalance }));
    else apply(d => A.addAccount(d, { workspaceId: ws.id, name: clean, type, openingBalance }));
    onClose();
  }

  return (
    <Modal title={account ? 'Edit account' : 'New account'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); save(); }}>
        <Field label="Name"><input className="input" autoFocus maxLength={40} placeholder="e.g. BPI Savings" value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Type">
          <select className="input" value={type} onChange={e => setType(e.target.value as AccountType)}>
            {Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Opening balance" hint="What was in this account when you started using Margin. Later income, expenses and transfers adjust it automatically.">
          <input className="input" inputMode="decimal" value={opening} onChange={e => setOpening(e.target.value)} />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}
