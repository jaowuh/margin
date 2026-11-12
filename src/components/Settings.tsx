import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Plus, Trash2, Upload } from 'lucide-react';
import type { WorkspaceType } from '../types';
import * as A from '../lib/actions';
import { exportBackup, exportCsv, readBackupFile } from '../lib/backup';
import { useActive, useStore } from '../lib/store';
import { clearStoredData } from '../lib/storage';
import { createInitialData } from '../lib/seed';
import { Field, useUI } from './ui';

interface InstallEvent extends Event { prompt: () => Promise<void> }

export default function Settings() {
  const { data, apply } = useStore();
  const { ws } = useActive();
  const { confirm, toast } = useUI();
  const fileRef = useRef<HTMLInputElement>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<WorkspaceType>('business');
  const [installEvt, setInstallEvt] = useState<InstallEvent | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e as InstallEvent); };
    window.addEventListener('beforeinstallprompt', h);
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const txCount = data.transactions.length;
  const last = data.prefs.lastExportAt ? new Date(data.prefs.lastExportAt).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : null;

  function backup() {
    exportBackup(data);
    apply(A.markExported);
    toast('Backup downloaded. Keep the file somewhere safe (Drive, email, USB).');
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    try {
      const { data: incoming, dropped } = await readBackupFile(file);
      const ok = await confirm({
        title: 'Replace everything with this backup?',
        message: `This will replace ALL data on this device with the backup (${incoming.workspaces.length} workspace${incoming.workspaces.length > 1 ? 's' : ''}, ${incoming.transactions.length} transactions).${dropped ? ` ${dropped} unreadable record(s) will be skipped.` : ''} Tip: download a backup of the current data first.`,
        confirmLabel: 'Replace', danger: true,
      });
      if (ok) { apply(() => incoming); toast('Backup restored.'); }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeWorkspace(id: string, name: string) {
    const ok = await confirm({
      title: `Delete “${name}”?`,
      message: 'Its accounts, categories, transactions and planned items will be permanently deleted. Download a backup first if you might need them.',
      confirmLabel: 'Delete workspace', danger: true,
    });
    if (ok) apply(d => A.deleteWorkspace(d, id));
  }

  async function clearWorkspace() {
    const ok = await confirm({
      title: `Clear all transactions in ${ws.name}?`,
      message: 'All transactions and planned items in this workspace will be deleted. Accounts, categories and budgets are kept.',
      confirmLabel: 'Clear', danger: true,
    });
    if (!ok) return;
    const before = data;
    apply(d => A.clearWorkspaceTransactions(d, ws.id));
    toast('Transactions cleared', { label: 'Undo', run: () => apply(() => before) });
  }

  async function eraseAll() {
    const ok = await confirm({
      title: 'Erase everything on this device?',
      message: 'This permanently deletes every workspace, account and transaction from this device and starts fresh. This cannot be undone unless you have a backup file.',
      confirmLabel: 'Erase everything', danger: true,
    });
    if (ok) { clearStoredData(); apply(() => createInitialData()); toast('All data erased.'); }
  }

  return (
    <div className="page narrow">
      <div className="page-head"><div><div className="eyebrow">MARGIN</div><h1>Settings</h1></div></div>

      <section className="card">
        <div className="card-head"><div><h2>Workspaces</h2><p>Keep personal money and your business completely separate.</p></div></div>
        <ul className="plain-list">
          {data.workspaces.map(w => (
            <WorkspaceRow key={w.id} id={w.id} name={w.name} type={w.type} active={w.id === ws.id}
              canDelete={data.workspaces.length > 1} onDelete={() => removeWorkspace(w.id, w.name)} />
          ))}
        </ul>
        <form className="add-row" onSubmit={e => { e.preventDefault(); if (newName.trim()) { apply(d => A.addWorkspace(d, newName, newType)); setNewName(''); toast('Workspace added'); } }}>
          <Field label="New workspace"><input className="input" maxLength={40} placeholder="e.g. Side business" value={newName} onChange={e => setNewName(e.target.value)} /></Field>
          <Field label="Type">
            <select className="input" value={newType} onChange={e => setNewType(e.target.value as WorkspaceType)}>
              <option value="business">Business (sales + profit)</option>
              <option value="personal">Personal</option>
            </select>
          </Field>
          <button className="btn" type="submit" disabled={!newName.trim()}><Plus size={16} /> Add</button>
        </form>
      </section>

      <section className="card">
        <div className="card-head"><div><h2>Back up & restore</h2><p>Your data lives only on this device. A backup file protects you if you lose or reset your phone.</p></div></div>
        <p className="muted-text small">{last ? `Last backup: ${last}.` : 'You haven’t made a backup yet.'} {txCount} transactions stored.</p>
        <div className="btn-row">
          <button className="btn primary" onClick={backup}><Download size={16} /> Download backup</button>
          <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} /> Restore from backup</button>
          <button className="btn" onClick={() => exportCsv(data, ws.id)}><FileSpreadsheet size={16} /> Export {ws.name} to CSV</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => onImport(e.target.files?.[0])} aria-label="Choose backup file" />
        <p className="muted-text small">
          {persisted === true ? 'This browser has marked Margin’s storage as persistent.' : persisted === false ? 'Tip: installing Margin to your home screen makes it much less likely that the browser clears your data.' : ''}
        </p>
      </section>

      <section className="card">
        <div className="card-head"><div><h2>Install the app</h2><p>Opens full-screen from your home screen and works offline.</p></div></div>
        {installEvt ? (
          <button className="btn primary" onClick={async () => { await installEvt.prompt(); setInstallEvt(null); }}>Install Margin</button>
        ) : (
          <p className="muted-text small">
            <strong>iPhone/iPad (Safari):</strong> Share → Add to Home Screen. <strong>Android (Chrome):</strong> ⋮ menu → Install app / Add to Home screen. <strong>Computer (Chrome/Edge):</strong> install icon in the address bar.
          </p>
        )}
      </section>

      <section className="card">
        <div className="card-head"><div><h2>Try it out</h2><p>Sample data for “{ws.name}” so you can see how the dashboard works.</p></div></div>
        <div className="btn-row">
          <button className="btn" disabled={data.transactions.some(t => t.workspaceId === ws.id)}
            onClick={() => { apply(d => A.addSampleData(d, ws.id)); toast('Sample data added. Clear it any time below.'); }}>Add sample data</button>
          <button className="btn danger-ghost" onClick={clearWorkspace}>Clear transactions in {ws.name}</button>
        </div>
      </section>

      <section className="card danger-zone">
        <div className="card-head"><div><h2>Erase everything</h2><p>Deletes all workspaces and data on this device.</p></div></div>
        <button className="btn danger" onClick={eraseAll}><Trash2 size={16} /> Erase all data</button>
      </section>

      <p className="muted-text small center">Margin v1.0 · Data stays on this device · No account, no tracking</p>
    </div>
  );
}

function WorkspaceRow({ id, name, type, active, canDelete, onDelete }: { id: string; name: string; type: WorkspaceType; active: boolean; canDelete: boolean; onDelete: () => void }) {
  const { apply } = useStore();
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const commit = () => { if (draft.trim() && draft.trim() !== name) apply(d => A.renameWorkspace(d, id, draft)); else setDraft(name); };
  return (
    <li className="cat-edit">
      <input className="input" value={draft} maxLength={40} aria-label="Workspace name"
        onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      <span className="pill neutral">{type === 'business' ? 'Business' : 'Personal'}{active ? ' · open' : ''}</span>
      <button className="icon-btn" onClick={onDelete} disabled={!canDelete} aria-label={`Delete ${name}`} title={canDelete ? 'Delete workspace' : 'You need at least one workspace'}><Trash2 size={16} /></button>
    </li>
  );
}
