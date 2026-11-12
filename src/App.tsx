import { useState } from 'react';
import { CalendarClock, CreditCard, LayoutDashboard, ListOrdered, Plus, Scale, Settings as SettingsIcon, WifiOff, X } from 'lucide-react';
import type { Transaction } from './types';
import * as A from './lib/actions';
import { todayStr } from './lib/format';
import { useActive, useStore } from './lib/store';
import Accounts from './components/Accounts';
import Budgets from './components/Budgets';
import Dashboard from './components/Dashboard';
import Planner from './components/Planner';
import Settings from './components/Settings';
import Transactions from './components/Transactions';
import { TxModal } from './components/TxModal';
import { useOnline } from './components/ui';

export type View = 'overview' | 'transactions' | 'planner' | 'budgets' | 'accounts' | 'settings';

const NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Activity', icon: ListOrdered },
  { id: 'planner', label: 'Planner', icon: CalendarClock },
  { id: 'budgets', label: 'Budgets', icon: Scale },
  { id: 'accounts', label: 'Accounts', icon: CreditCard },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const base = import.meta.env.BASE_URL;
const BACKUP_NAG_DAYS = 30;

export default function App() {
  const { data, apply, notice, dismissNotice, saveError } = useStore();
  const { ws } = useActive();
  const online = useOnline();
  const [view, setView] = useState<View>('overview');
  const [month, setMonth] = useState(() => todayStr().slice(0, 7));
  const [txModal, setTxModal] = useState<{ tx?: Transaction } | null>(null);
  const [nagDismissed, setNagDismissed] = useState(false);

  const daysSinceBackup = data.prefs.lastExportAt ? (Date.now() - new Date(data.prefs.lastExportAt).getTime()) / 86400000 : Infinity;
  const needsBackup = !nagDismissed && data.transactions.length >= 10 && daysSinceBackup > BACKUP_NAG_DAYS;

  const go = (v: View) => { setView(v); window.scrollTo({ top: 0 }); };
  const editTx = (tx: Transaction) => setTxModal({ tx });
  const addTx = () => setTxModal({});

  const wsSelect = (
    <select className="ws-select" value={ws.id} aria-label="Workspace"
      onChange={e => { apply(d => A.setActiveWorkspace(d, e.target.value)); }}>
      {data.workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
    </select>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <img className="wordmark" src={`${base}icons/wordmark.png`} alt="margin." width={150} height={42} />
        <div className="eyebrow ws-label">WORKSPACE</div>
        {wsSelect}
        <nav aria-label="Main">
          {NAV.map(n => (
            <button key={n.id} className={`nav-item ${view === n.id ? 'active' : ''}`} aria-current={view === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
              <n.icon size={18} /> {n.label === 'Activity' ? 'Transactions' : n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">{online ? 'Works offline' : <><WifiOff size={14} /> Offline — all good</>}</div>
      </aside>

      <header className="mobile-top">
        <img className="wordmark" src={`${base}icons/wordmark.png`} alt="margin." width={96} height={27} />
        {!online && <span className="pill neutral"><WifiOff size={12} /> Offline</span>}
        {wsSelect}
      </header>

      <main className="main" id="main">
        {(notice || saveError || needsBackup) && (
          <div className="banners">
            {saveError && <div className="banner danger" role="alert">Margin couldn’t save to this device (storage may be full or blocked). Download a backup from Settings now so you don’t lose recent entries.</div>}
            {notice && <div className="banner" role="status"><span>{notice}</span><button className="icon-btn" onClick={dismissNotice} aria-label="Dismiss"><X size={16} /></button></div>}
            {needsBackup && (
              <div className="banner" role="status">
                <span>Your data only lives on this device. {data.prefs.lastExportAt ? 'It’s been a while since your last backup.' : 'You haven’t made a backup yet.'}</span>
                <button className="link-btn" onClick={() => go('settings')}>Back up now</button>
                <button className="icon-btn" onClick={() => setNagDismissed(true)} aria-label="Dismiss"><X size={16} /></button>
              </div>
            )}
          </div>
        )}

        {view === 'overview' && <Dashboard month={month} setMonth={setMonth} go={go} editTx={editTx} />}
        {view === 'transactions' && <Transactions month={month} setMonth={setMonth} editTx={editTx} addTx={addTx} />}
        {view === 'planner' && <Planner month={month} setMonth={setMonth} />}
        {view === 'budgets' && <Budgets />}
        {view === 'accounts' && <Accounts />}
        {view === 'settings' && <Settings />}
      </main>

      {(view === 'overview' || view === 'transactions') && (
        <button className="fab" onClick={addTx}><Plus size={20} /> Add</button>
      )}

      <nav className="bottom-nav" aria-label="Main">
        {NAV.map(n => (
          <button key={n.id} className={view === n.id ? 'active' : ''} aria-current={view === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
            <n.icon size={20} /><span>{n.label}</span>
          </button>
        ))}
      </nav>

      {txModal && <TxModal tx={txModal.tx} onClose={() => setTxModal(null)} />}
    </div>
  );
}
