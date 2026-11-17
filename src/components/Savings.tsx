import { useEffect, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import type { SavingsGoal } from '../types';
import * as A from '../lib/actions';
import { peso } from '../lib/format';
import { useActive, useStore } from '../lib/store';
import { ProgressBar, useUI } from './ui';

const num = (s: string) => { const n = Number(s.replace(/[₱,\s]/g, '')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };

/** Overview card: tick off each goal when the money has been set aside this month. */
export function SavingsCard({ month, canTick }: { month: string; canTick: boolean }) {
  const { data, apply } = useStore();
  const { ws } = useActive();
  const goals = data.goals.filter(g => g.workspaceId === ws.id);
  if (goals.length === 0) return null;
  const due = goals.filter(g => g.monthlyAmount > 0);
  const done = due.filter(g => g.savedMonths.includes(month));
  const toSet = due.reduce((s, g) => s + g.monthlyAmount, 0);
  const setAside = done.reduce((s, g) => s + g.monthlyAmount, 0);
  return (
    <section className="card" aria-label="Savings">
      <div className="card-head">
        <div><h2>Savings</h2><p>{due.length > 0 ? `${peso(setAside)} of ${peso(toSet)} set aside this month` : 'Your savings goals'}</p></div>
      </div>
      <ul className="plain-list goal-list">
        {goals.map(g => {
          const ticked = g.savedMonths.includes(month);
          const p = g.target > 0 ? (g.saved / g.target) * 100 : 0;
          return (
            <li key={g.id} className="goal">
              <div className="goal-main">
                <div className="cat-line">
                  <span className="cat-name">{g.name}</span>
                  <span className="cat-amt"><strong>{peso(g.saved)}</strong>{g.target > 0 && <span className="of"> / {peso(g.target)}</span>}</span>
                </div>
                {g.target > 0 && <ProgressBar pct={p} status="ok" label={`${g.name} progress`} />}
                {g.target > 0 && g.saved >= g.target && <div className="cat-foot ok-note">Goal reached</div>}
              </div>
              {g.monthlyAmount > 0 && canTick && (
                <button className={`btn small ${ticked ? 'ticked' : ''}`} onClick={() => apply(d => A.toggleGoalSaved(d, g.id, month))}
                  aria-pressed={ticked} aria-label={`${ticked ? 'Undo' : 'Mark'} ${g.name} saved for this month`}>
                  <Check size={14} /> {ticked ? 'Saved' : `Save ${peso(g.monthlyAmount)}`}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Budgets tab: manage goals. */
export function GoalsEditor() {
  const { data, apply } = useStore();
  const { ws } = useActive();
  const { confirm, toast } = useUI();
  const goals = data.goals.filter(g => g.workspaceId === ws.id);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  async function remove(g: SavingsGoal) {
    const ok = await confirm({ title: `Delete “${g.name}”?`, message: g.saved > 0 ? `You’ve tracked ${peso(g.saved)} saved here. That record will be removed.` : 'This goal has no saved amount yet.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    const before = data;
    apply(d => A.deleteGoal(d, g.id));
    toast(`“${g.name}” deleted`, { label: 'Undo', run: () => apply(() => before) });
  }
  function add() {
    if (!name.trim()) return;
    apply(d => A.addGoal(d, ws.id, name, num(amount)));
    setName(''); setAmount('');
  }

  return (
    <section className="card">
      <div className="card-head"><div><h2>Savings goals</h2><p>Money you set aside each month. Tick it off on the Overview when it’s done.</p></div></div>
      {goals.length === 0 && <p className="muted-text small">No goals yet. Add one below, or use the budget wizard.</p>}
      <ul className="plain-list">{goals.map(g => <GoalRow key={g.id} goal={g} onDelete={() => remove(g)} />)}</ul>
      <form className="add-row" onSubmit={e => { e.preventDefault(); add(); }}>
        <div className="field"><span className="field-label">New goal</span>
          <input className="input" maxLength={40} placeholder="e.g. Travel fund" value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="field"><span className="field-label">Per month</span>
          <input className="input" inputMode="decimal" placeholder="Optional" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        <button type="submit" className="btn" disabled={!name.trim()}><Plus size={16} /> Add</button>
      </form>
    </section>
  );
}

function GoalRow({ goal, onDelete }: { goal: SavingsGoal; onDelete: () => void }) {
  const { apply } = useStore();
  const [name, setName] = useState(goal.name);
  const [amt, setAmt] = useState(goal.monthlyAmount ? String(goal.monthlyAmount) : '');
  const [target, setTarget] = useState(goal.target ? String(goal.target) : '');
  useEffect(() => setName(goal.name), [goal.name]);
  useEffect(() => setAmt(goal.monthlyAmount ? String(goal.monthlyAmount) : ''), [goal.monthlyAmount]);
  useEffect(() => setTarget(goal.target ? String(goal.target) : ''), [goal.target]);
  const blur = (e: React.KeyboardEvent) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); };
  return (
    <li className="cat-edit expense">
      <input className="input" value={name} maxLength={40} aria-label="Goal name" onChange={e => setName(e.target.value)} onKeyDown={blur}
        onBlur={() => (name.trim() && name.trim() !== goal.name ? apply(d => A.updateGoal(d, goal.id, { name })) : setName(goal.name))} />
      <button className="icon-btn" onClick={onDelete} aria-label={`Delete ${goal.name}`}><Trash2 size={16} /></button>
      <div className="cat-sub">
        <div className="limit-box"><input className="input" inputMode="decimal" placeholder="Per month" value={amt} aria-label={`${goal.name} per month`}
          onChange={e => setAmt(e.target.value)} onKeyDown={blur}
          onBlur={() => { const v = num(amt); setAmt(v ? String(v) : ''); if (v !== goal.monthlyAmount) apply(d => A.updateGoal(d, goal.id, { monthlyAmount: v })); }} /></div>
        <div className="limit-box"><input className="input" inputMode="decimal" placeholder="Target (optional)" value={target} aria-label={`${goal.name} target`}
          onChange={e => setTarget(e.target.value)} onKeyDown={blur}
          onBlur={() => { const v = num(target); setTarget(v ? String(v) : ''); if (v !== goal.target) apply(d => A.updateGoal(d, goal.id, { target: v })); }} /></div>
        {goal.saved > 0 && <small className="cat-note">{peso(goal.saved)} saved so far</small>}
      </div>
    </li>
  );
}
