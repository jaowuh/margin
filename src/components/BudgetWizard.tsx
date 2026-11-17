import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import * as A from '../lib/actions';
import { monthlyIncome, monthlyLimitFor, splitSavings, suggestSplit } from '../lib/calc';
import { peso, todayStr } from '../lib/format';
import { useActive, useStore } from '../lib/store';
import { Field, Modal, useUI } from './ui';

interface GoalRow { key: string; name: string; on: boolean; amount: string; touched: boolean; target: string }

const num = (s: string) => { const n = Number(s.replace(/[₱,\s]/g, '')); return Number.isFinite(n) && n > 0 ? n : 0; };
const SAVERS = [
  { name: 'Starter saver', pct: 10, blurb: 'Easing in. Small, steady and easy to keep up.' },
  { name: 'Steady saver', pct: 20, blurb: 'The classic. A solid cushion without feeling tight.' },
  { name: 'Super saver', pct: 30, blurb: 'All in. Builds your funds fast, with less left to spend.' },
];
const DEFAULT_GOALS = ['Emergency fund', 'Savings', 'Travel fund'];

/** Spread `total` over the goals that are on and not hand-edited. */
function redistribute(goals: GoalRow[], total: number): GoalRow[] {
  const fixed = goals.filter(g => g.on && g.touched).reduce((s, g) => s + num(g.amount), 0);
  const auto = goals.filter(g => g.on && !g.touched);
  const split = splitSavings(auto.length, Math.max(0, total - fixed));
  let i = 0;
  return goals.map(g => (g.on && !g.touched ? { ...g, amount: split[i++] ? String(split[i - 1]) : '' } : g));
}

export default function BudgetWizard({ onClose }: { onClose: () => void }) {
  const { data, apply } = useStore();
  const { ws, categories } = useActive();
  const { toast } = useUI();
  const month = todayStr().slice(0, 7);
  const expense = categories.filter(c => c.kind === 'expense');
  const plan = data.prefs.plans?.[ws.id];
  const existing = data.goals.filter(g => g.workspaceId === ws.id);

  const [step, setStep] = useState(0);
  const [incomeStr, setIncomeStr] = useState(plan ? String(plan.income) : '');
  const [period, setPeriod] = useState<'week' | 'month'>(plan?.incomePeriod ?? 'month');
  const [saveStr, setSaveStr] = useState(() => (existing.length ? String(Math.round(existing.reduce((s, g) => s + g.monthlyAmount, 0))) : ''));
  const [goals, setGoals] = useState<GoalRow[]>(() => {
    const rows: GoalRow[] = existing.map(g => ({ key: g.id, name: g.name, on: true, amount: g.monthlyAmount ? String(g.monthlyAmount) : '', touched: true, target: g.target ? String(g.target) : '' }));
    for (const n of DEFAULT_GOALS) {
      if (!rows.some(r => r.name.toLowerCase() === n.toLowerCase())) rows.push({ key: `d-${n}`, name: n, on: existing.length === 0, amount: '', touched: false, target: '' });
    }
    return rows;
  });
  const [newGoal, setNewGoal] = useState('');
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [limitsReady, setLimitsReady] = useState(false);

  const income = monthlyIncome(num(incomeStr), period);
  const saveTotal = num(saveStr);
  const allocated = goals.filter(g => g.on).reduce((s, g) => s + num(g.amount), 0);
  const savings = goals.some(g => g.on) ? allocated : saveTotal;
  const available = Math.max(0, income - savings);
  const assigned = expense.reduce((s, c) => s + num(limits[c.id] ?? ''), 0);
  const left = available - assigned;
  const hasLimits = useMemo(() => expense.some(c => monthlyLimitFor(c, month) > 0), [expense, month]);

  function setSavingsTotal(v: number) {
    setSaveStr(v ? String(v) : '');
    setGoals(g => redistribute(g, v));
  }
  function toStep(n: number) {
    if (n === 1 && !saveStr && income > 0) setSavingsTotal(Math.round((income * 0.2) / 100) * 100);
    if (n === 2 && !limitsReady) {
      const s = suggestSplit(expense.map(c => c.name), available);
      const next: Record<string, string> = {};
      expense.forEach((c, i) => { next[c.id] = s[i] ? String(s[i]) : ''; });
      setLimits(next); setLimitsReady(true);
    }
    setStep(n);
  }
  function addCustom() {
    const name = newGoal.trim();
    if (!name || goals.some(g => g.name.toLowerCase() === name.toLowerCase())) return;
    setGoals(g => redistribute([...g, { key: `n-${Date.now()}`, name, on: true, amount: '', touched: false, target: '' }], saveTotal));
    setNewGoal('');
  }
  function finish() {
    const chosen = goals.filter(g => g.on && g.name.trim());
    const lim: Record<string, number> = {};
    for (const c of expense) lim[c.id] = num(limits[c.id] ?? '');
    apply(d => A.applyWizard(d, ws.id, {
      income: num(incomeStr), incomePeriod: period,
      goals: chosen.map(g => ({ name: g.name, monthlyAmount: num(g.amount), target: num(g.target) })),
      limits: lim,
    }));
    toast('Budget created. You can fine-tune it any time in Budgets.');
    onClose();
  }

  const canNext = step === 0 ? income > 0 : step === 1 ? (saveTotal === 0 || saveTotal < income) : true;
  const titles = ['Your income', 'Your savings', 'Your spending', 'Review'];

  return (
    <Modal title="Create your budget" onClose={onClose}>
      <div className="wiz-steps" aria-label={`Step ${step + 1} of 4`}>
        {titles.map((t, i) => <span key={t} className={i === step ? 'on' : i < step ? 'done' : ''} />)}
        <small>Step {step + 1} of 4 · {titles[step]}</small>
      </div>

      {step === 0 && (
        <>
          <p className="muted-text small">How much money comes in? Include your usual pay and any regular income.</p>
          <div className="segmented wide" role="group" aria-label="Income period">
            <button type="button" className={period === 'month' ? 'chosen' : ''} onClick={() => setPeriod('month')}>Per month</button>
            <button type="button" className={period === 'week' ? 'chosen' : ''} onClick={() => setPeriod('week')}>Per week</button>
          </div>
          <Field label={period === 'week' ? 'Income per week' : 'Income per month'} hint={period === 'week' && income > 0 ? `About ${peso(income)} a month` : undefined}>
            <input className="input amount" autoFocus inputMode="decimal" placeholder="₱ 0" value={incomeStr} onChange={e => setIncomeStr(e.target.value)} />
          </Field>
        </>
      )}

      {step === 1 && (
        <>
          <p className="muted-text small">Pay yourself first. Pick the kind of saver you want to be, or type your own amount. Income: <strong>{peso(income)}</strong> a month.</p>
          <div className="saver-cards" role="group" aria-label="Choose a saver type">
            {SAVERS.map(sv => {
              const v = Math.round((income * sv.pct) / 100 / 10) * 10;
              return (
                <button type="button" key={sv.name} className={saveTotal === v ? 'chosen' : ''} aria-pressed={saveTotal === v} onClick={() => setSavingsTotal(v)}>
                  <span className="saver-top"><strong>{sv.name}</strong><em>{sv.pct}%</em></span>
                  <span className="saver-amt">{peso(v)} a month</span>
                  <small>{sv.blurb}</small>
                </button>
              );
            })}
          </div>
          <Field label="Or choose your own amount per month" hint={saveTotal >= income && income > 0 ? 'That’s all of your income. Choose a smaller amount.' : undefined}>
            <input className="input amount" inputMode="decimal" placeholder="₱ 0" value={saveStr} onChange={e => setSavingsTotal(num(e.target.value))} />
          </Field>
          <div className="wiz-goals">
            <div className="eyebrow">WHERE IT GOES</div>
            {goals.map(g => (
              <div key={g.key} className={`wiz-goal ${g.on ? '' : 'off'}`}>
                <label className="wiz-check">
                  <input type="checkbox" checked={g.on} onChange={e => setGoals(gs => redistribute(gs.map(x => (x.key === g.key ? { ...x, on: e.target.checked, touched: false } : x)), saveTotal))} />
                  <span>{g.name}</span>
                </label>
                {g.on && (
                  <div className="wiz-goal-in">
                    <input className="input" inputMode="decimal" placeholder="₱ / month" aria-label={`${g.name} per month`} value={g.amount}
                      onChange={e => setGoals(gs => gs.map(x => (x.key === g.key ? { ...x, amount: e.target.value, touched: true } : x)))} />
                    <input className="input" inputMode="decimal" placeholder="Target (optional)" aria-label={`${g.name} target`} value={g.target}
                      onChange={e => setGoals(gs => gs.map(x => (x.key === g.key ? { ...x, target: e.target.value } : x)))} />
                  </div>
                )}
              </div>
            ))}
            <div className="add-row tight">
              <input className="input" maxLength={40} placeholder="Another goal, e.g. New phone" value={newGoal} onChange={e => setNewGoal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
              <button type="button" className="btn" disabled={!newGoal.trim()} onClick={addCustom}><Plus size={16} /> Add</button>
            </div>
            {saveTotal > 0 && goals.some(g => g.on) && (
              <p className={`wiz-note ${allocated > saveTotal ? 'neg' : ''}`}>
                {allocated === saveTotal ? 'All of your savings is assigned.' : allocated < saveTotal ? `${peso(saveTotal - allocated)} not assigned yet.` : `${peso(allocated - saveTotal)} more than your savings amount.`}
              </p>
            )}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p className="muted-text small">After {peso(savings)} of savings you have <strong>{peso(available)}</strong> a month to spend. We suggested amounts. Change anything you like.</p>
          <div className="wiz-rows">
            {expense.map(c => (
              <div key={c.id} className="wiz-row">
                <span className="dot" style={{ background: c.color }} />
                <span className="wiz-name">{c.name}</span>
                <input className="input" inputMode="decimal" placeholder="₱ / month" aria-label={`${c.name} per month`} value={limits[c.id] ?? ''}
                  onChange={e => setLimits(l => ({ ...l, [c.id]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className={`wiz-left ${left < 0 ? 'neg' : ''}`}>
            <span>{left >= 0 ? 'Left to assign' : 'Over by'}</span><strong>{peso(Math.abs(left))}</strong>
          </div>
        </>
      )}

      {step === 3 && (
        <div className="wiz-review">
          <div className="wiz-sum"><span>Income</span><strong>{peso(income)} / month</strong></div>
          <div className="wiz-sum"><span>Savings</span><strong>{peso(savings)} / month</strong></div>
          {goals.filter(g => g.on && num(g.amount) > 0).map(g => <div key={g.key} className="wiz-sum sub"><span>{g.name}</span><strong>{peso(num(g.amount))}</strong></div>)}
          <div className="wiz-sum"><span>Spending budget</span><strong>{peso(assigned)} / month</strong></div>
          <div className="wiz-sum"><span>Left over</span><strong className={income - savings - assigned < 0 ? 'neg' : ''}>{peso(income - savings - assigned)}</strong></div>
          {hasLimits && <p className="wiz-note">This replaces your current spending limits.</p>}
          {income - savings - assigned < 0 && <p className="wiz-note neg">Your plan spends more than you earn. You can still create it, or go back and adjust.</p>}
        </div>
      )}

      <div className="modal-actions">
        {step > 0 && <button type="button" className="btn" onClick={() => toStep(step - 1)}>Back</button>}
        <span className="spacer" />
        {step < 3
          ? <button type="button" className="btn primary" disabled={!canNext} onClick={() => toStep(step + 1)}>Next</button>
          : <button type="button" className="btn primary" onClick={finish}>Create budget</button>}
      </div>
    </Modal>
  );
}
