import type {
  Account, AppData, BalanceView, Category, LimitPeriod, SavingsGoal, Scheduled, Transaction, Workspace, WorkspaceType,
} from '../types';
import { nextMonthlyDate, todayStr, uid } from './format';
import { CATEGORY_COLORS, starterFor } from './seed';

/** All state changes are pure functions: (data, ...args) => newData. */

// ---------- workspaces ----------
export function addWorkspace(d: AppData, name: string, type: WorkspaceType): AppData {
  const ws: Workspace = { id: uid(), name: name.trim() || 'Untitled', type };
  const starter = starterFor(ws.id, type);
  return {
    ...d,
    workspaces: [...d.workspaces, ws],
    accounts: [...d.accounts, ...starter.accounts],
    categories: [...d.categories, ...starter.categories],
    prefs: { ...d.prefs, activeWorkspaceId: ws.id },
  };
}

export function renameWorkspace(d: AppData, id: string, name: string): AppData {
  const clean = name.trim();
  if (!clean) return d;
  return { ...d, workspaces: d.workspaces.map(w => (w.id === id ? { ...w, name: clean } : w)) };
}

export function deleteWorkspace(d: AppData, id: string): AppData {
  if (d.workspaces.length <= 1) return d;
  const workspaces = d.workspaces.filter(w => w.id !== id);
  const { [id]: _v, ...balanceView } = d.prefs.balanceView;
  const { [id]: _s, ...selectedAccountIds } = d.prefs.selectedAccountIds;
  return {
    ...d,
    workspaces,
    accounts: d.accounts.filter(a => a.workspaceId !== id),
    categories: d.categories.filter(c => c.workspaceId !== id),
    transactions: d.transactions.filter(t => t.workspaceId !== id),
    scheduled: d.scheduled.filter(s => s.workspaceId !== id),
    goals: d.goals.filter(g => g.workspaceId !== id),
    prefs: {
      ...d.prefs,
      activeWorkspaceId: d.prefs.activeWorkspaceId === id ? workspaces[0].id : d.prefs.activeWorkspaceId,
      balanceView,
      selectedAccountIds,
    },
  };
}

export function setActiveWorkspace(d: AppData, id: string): AppData {
  if (!d.workspaces.some(w => w.id === id)) return d;
  return { ...d, prefs: { ...d.prefs, activeWorkspaceId: id } };
}

// ---------- accounts ----------
export function addAccount(d: AppData, a: Omit<Account, 'id' | 'isPrimary' | 'isActive'>): AppData {
  const hasPrimary = d.accounts.some(x => x.workspaceId === a.workspaceId && x.isPrimary && x.isActive);
  const acc: Account = { ...a, id: uid(), isPrimary: !hasPrimary, isActive: true };
  return { ...d, accounts: [...d.accounts, acc] };
}

export function updateAccount(d: AppData, id: string, patch: Partial<Pick<Account, 'name' | 'type' | 'openingBalance'>>): AppData {
  return { ...d, accounts: d.accounts.map(a => (a.id === id ? { ...a, ...patch } : a)) };
}

export function setPrimaryAccount(d: AppData, id: string): AppData {
  const target = d.accounts.find(a => a.id === id);
  if (!target || !target.isActive) return d;
  return {
    ...d,
    accounts: d.accounts.map(a => (a.workspaceId === target.workspaceId ? { ...a, isPrimary: a.id === id } : a)),
  };
}

export function accountHasActivity(d: AppData, id: string): boolean {
  return d.transactions.some(t => t.accountId === id || t.toAccountId === id);
}

/** Accounts with history are archived (hidden, balance kept in history); empty ones are removed. */
export function removeAccount(d: AppData, id: string): AppData {
  const target = d.accounts.find(a => a.id === id);
  if (!target) return d;
  let accounts: Account[];
  if (accountHasActivity(d, id)) accounts = d.accounts.map(a => (a.id === id ? { ...a, isActive: false, isPrimary: false } : a));
  else accounts = d.accounts.filter(a => a.id !== id);
  // Make sure the workspace still has a primary among its active accounts.
  const stillPrimary = accounts.some(a => a.workspaceId === target.workspaceId && a.isPrimary && a.isActive);
  if (!stillPrimary) {
    const first = accounts.find(a => a.workspaceId === target.workspaceId && a.isActive);
    if (first) accounts = accounts.map(a => (a.id === first.id ? { ...a, isPrimary: true } : a));
  }
  const prefs = {
    ...d.prefs,
    selectedAccountIds: Object.fromEntries(
      Object.entries(d.prefs.selectedAccountIds).map(([k, ids]) => [k, ids.filter(x => x !== id)]),
    ),
  };
  return {
    ...d,
    accounts,
    scheduled: d.scheduled.map(s => (s.accountId === id ? { ...s, accountId: null } : s)),
    prefs,
  };
}

export function restoreAccount(d: AppData, id: string): AppData {
  return { ...d, accounts: d.accounts.map(a => (a.id === id ? { ...a, isActive: true } : a)) };
}

// ---------- categories ----------
export function addCategory(d: AppData, workspaceId: string, name: string, kind: Category['kind'], limit = 0, period: LimitPeriod = 'month', group = ''): AppData {
  const clean = name.trim();
  if (!clean) return d;
  const used = d.categories.filter(c => c.workspaceId === workspaceId && c.kind === 'expense').length;
  const cat: Category = {
    id: uid(), workspaceId, name: clean, kind, monthlyLimit: 0,
    color: kind === 'expense' ? CATEGORY_COLORS[used % CATEGORY_COLORS.length] : '#6F8F7F',
  };
  let out: AppData = { ...d, categories: [...d.categories, cat] };
  if (kind === 'expense') {
    if (limit > 0) out = setCategoryLimit(out, cat.id, limit, period);
    if (group.trim()) out = setCategoryGroup(out, cat.id, group);
  }
  return out;
}

/** Set a limit entered per day, week or month. */
export function setCategoryLimit(d: AppData, id: string, amount: number, period: LimitPeriod): AppData {
  const v = Math.max(0, Math.round((amount || 0) * 100) / 100);
  return {
    ...d,
    categories: d.categories.map(c => {
      if (c.id !== id) return c;
      if (period === 'month') { const { limitAmount: _a, ...rest } = c; return { ...rest, monthlyLimit: v, limitPeriod: 'month' as const }; }
      return { ...c, limitPeriod: period, limitAmount: v, monthlyLimit: Math.round(v * (period === 'day' ? 30 : 30 / 7) * 100) / 100 };
    }),
  };
}

export function setCategoryGroup(d: AppData, id: string, group: string): AppData {
  const g = group.trim().slice(0, 30);
  return { ...d, categories: d.categories.map(c => {
    if (c.id !== id) return c;
    if (!g) { const { group: _g, ...rest } = c; return rest; }
    return { ...c, group: g };
  }) };
}

export function updateCategory(d: AppData, id: string, patch: Partial<Pick<Category, 'name' | 'monthlyLimit'>>): AppData {
  const p = { ...patch };
  if (p.name !== undefined && !p.name.trim()) delete p.name;
  if (p.name !== undefined) p.name = p.name.trim();
  if (p.monthlyLimit !== undefined) p.monthlyLimit = Math.max(0, p.monthlyLimit || 0);
  return { ...d, categories: d.categories.map(c => (c.id === id ? { ...c, ...p } : c)) };
}

export function deleteCategory(d: AppData, id: string): AppData {
  return {
    ...d,
    categories: d.categories.filter(c => c.id !== id),
    transactions: d.transactions.map(t => (t.categoryId === id ? { ...t, categoryId: null } : t)),
    scheduled: d.scheduled.map(s => (s.categoryId === id ? { ...s, categoryId: null } : s)),
  };
}

// ---------- transactions ----------
export function addTransaction(d: AppData, t: Omit<Transaction, 'id'>): AppData {
  return { ...d, transactions: [...d.transactions, { ...t, id: uid() }] };
}

export function updateTransaction(d: AppData, t: Transaction): AppData {
  return { ...d, transactions: d.transactions.map(x => (x.id === t.id ? t : x)) };
}

export function deleteTransaction(d: AppData, id: string): AppData {
  return {
    ...d,
    transactions: d.transactions.filter(t => t.id !== id),
    // A bill paid by this transaction goes back to "planned" (unless it already rolled over to next month).
    scheduled: d.scheduled.map(s =>
      s.transactionId === id
        ? s.repeat === 'none'
          ? { ...s, status: 'planned' as const, transactionId: undefined }
          : { ...s, transactionId: undefined }
        : s,
    ),
  };
}

// ---------- planner ----------
export function addScheduled(d: AppData, s: Omit<Scheduled, 'id' | 'status'>): AppData {
  return { ...d, scheduled: [...d.scheduled, { ...s, id: uid(), status: 'planned' }] };
}

export function updateScheduled(d: AppData, s: Scheduled): AppData {
  return { ...d, scheduled: d.scheduled.map(x => (x.id === s.id ? s : x)) };
}

export function deleteScheduled(d: AppData, id: string): AppData {
  return { ...d, scheduled: d.scheduled.filter(s => s.id !== id) };
}

/** Marks a planned item as paid: records the transaction and, if monthly, plans next month's. Idempotent. */
export function payScheduled(d: AppData, id: string, accountId: string, date = todayStr()): AppData {
  const item = d.scheduled.find(s => s.id === id);
  if (!item || item.status === 'paid') return d;
  const txId = uid();
  const tx: Transaction = {
    id: txId, workspaceId: item.workspaceId, type: item.type, amount: item.amount, date,
    accountId, categoryId: item.categoryId, note: item.title,
  };
  const paid: Scheduled = { ...item, status: 'paid', transactionId: txId, accountId };
  const scheduled = d.scheduled.map(s => (s.id === id ? paid : s));
  if (item.repeat === 'monthly') {
    scheduled.push({ ...item, id: uid(), dueDate: nextMonthlyDate(item.dueDate), status: 'planned', transactionId: undefined });
  }
  return { ...d, transactions: [...d.transactions, tx], scheduled };
}

// ---------- preferences ----------
export function setBalanceView(d: AppData, workspaceId: string, view: BalanceView): AppData {
  return { ...d, prefs: { ...d.prefs, balanceView: { ...d.prefs.balanceView, [workspaceId]: view } } };
}

export function setSelectedAccounts(d: AppData, workspaceId: string, ids: string[]): AppData {
  return { ...d, prefs: { ...d.prefs, selectedAccountIds: { ...d.prefs.selectedAccountIds, [workspaceId]: ids } } };
}

export function markExported(d: AppData): AppData {
  return { ...d, prefs: { ...d.prefs, lastExportAt: new Date().toISOString() } };
}

// ---------- bulk ----------
export function clearWorkspaceTransactions(d: AppData, workspaceId: string): AppData {
  return {
    ...d,
    transactions: d.transactions.filter(t => t.workspaceId !== workspaceId),
    scheduled: d.scheduled.filter(s => s.workspaceId !== workspaceId),
  };
}

/** Fills the workspace with example data so you can see how the dashboard behaves. */
export function addSampleData(d: AppData, workspaceId: string, today = todayStr()): AppData {
  const ws = d.workspaces.find(w => w.id === workspaceId);
  if (!ws) return d;
  const cats = d.categories.filter(c => c.workspaceId === workspaceId);
  const accs = d.accounts.filter(a => a.workspaceId === workspaceId && a.isActive);
  const acc = accs.find(a => a.isPrimary) ?? accs[0];
  if (!acc) return d;
  const byName = (n: string) => cats.find(c => c.name === n)?.id ?? null;
  const ym = today.slice(0, 7);
  const day = (n: number) => `${ym}-${String(Math.min(n, Number(today.slice(8, 10)))).padStart(2, '0')}`;
  const limits: Record<string, number> = ws.type === 'business'
    ? { Ingredients: 30000, Supplies: 6000, Utilities: 8000, Staff: 25000, Rent: 12000, Maintenance: 3000, 'Other expenses': 2000 }
    : { Household: 8000, Food: 9000, Transport: 3500, Bills: 5000, Daughter: 4000, 'Personal & other': 3000 };
  const sample: Array<[string, string, number, number, 'income' | 'expense']> = ws.type === 'business'
    ? [
        ['Dine-in sales', 'Weekend sales', 1, 18500, 'income'], ['Takeout & delivery', 'Delivery orders', 2, 6400, 'income'],
        ['Dine-in sales', 'Weekday sales', 5, 14200, 'income'], ['Ingredients', 'Coffee beans & milk', 2, 9800, 'expense'],
        ['Ingredients', 'Pastry supplies', 4, 5600, 'expense'], ['Staff', 'Weekly wages', 6, 7500, 'expense'],
        ['Utilities', 'Electricity', 3, 3200, 'expense'], ['Supplies', 'Cups & packaging', 4, 2100, 'expense'],
      ]
    : [
        ['Salary', 'Salary', 1, 42000, 'income'], ['Household', 'Groceries', 2, 3200, 'expense'],
        ['Food', 'Eating out', 3, 1800, 'expense'], ['Transport', 'Fuel', 4, 1500, 'expense'],
        ['Daughter', 'School activities', 5, 2000, 'expense'], ['Bills', 'Internet', 6, 1500, 'expense'],
        ['Personal & other', 'Coffee & misc', 7, 900, 'expense'],
      ];
  const categories = d.categories.map(c =>
    c.workspaceId === workspaceId && c.kind === 'expense' && c.monthlyLimit === 0 && limits[c.name] ? { ...c, monthlyLimit: limits[c.name] } : c,
  );
  const transactions = sample.map(([cat, note, n, amount, type]) => ({
    id: uid(), workspaceId, type, amount, date: day(n), accountId: acc.id, categoryId: byName(cat), note,
  } as Transaction));
  const dueDay = (n: number) => `${ym}-${String(n).padStart(2, '0')}`;
  const bills: Array<[string, string, number]> = ws.type === 'business'
    ? [['Rent', 'Rent', 28], ['Utilities', 'Water bill', 25]]
    : [['Bills', 'Loan contribution', 28], ['Bills', 'Electric bill', 24]];
  const scheduled: Scheduled[] = bills.map(([cat, title, n]) => ({
    id: uid(), workspaceId, type: 'expense', title, amount: title === 'Rent' ? 12000 : title === 'Water bill' ? 900 : title === 'Loan contribution' ? 5000 : 2200,
    dueDate: dueDay(n), categoryId: byName(cat), accountId: null, repeat: 'monthly', status: 'planned',
  }));
  return { ...d, categories, transactions: [...d.transactions, ...transactions], scheduled: [...d.scheduled, ...scheduled] };
}

// ---------- savings goals & budget wizard ----------
export function addGoal(d: AppData, workspaceId: string, name: string, monthlyAmount = 0, target = 0): AppData {
  const clean = name.trim();
  if (!clean) return d;
  const g: SavingsGoal = { id: uid(), workspaceId, name: clean.slice(0, 40), monthlyAmount: Math.max(0, monthlyAmount || 0), target: Math.max(0, target || 0), saved: 0, savedMonths: [] };
  return { ...d, goals: [...d.goals, g] };
}

export function updateGoal(d: AppData, id: string, patch: Partial<Pick<SavingsGoal, 'name' | 'monthlyAmount' | 'target'>>): AppData {
  const p = { ...patch };
  if (p.name !== undefined) { p.name = p.name.trim().slice(0, 40); if (!p.name) delete p.name; }
  if (p.monthlyAmount !== undefined) p.monthlyAmount = Math.max(0, p.monthlyAmount || 0);
  if (p.target !== undefined) p.target = Math.max(0, p.target || 0);
  return { ...d, goals: d.goals.map(g => (g.id === id ? { ...g, ...p } : g)) };
}

export function deleteGoal(d: AppData, id: string): AppData {
  return { ...d, goals: d.goals.filter(g => g.id !== id) };
}

/** Tick a goal off for a month (adds this month's amount to what's saved); ticking again undoes it. */
export function toggleGoalSaved(d: AppData, id: string, month: string): AppData {
  return {
    ...d,
    goals: d.goals.map(g => {
      if (g.id !== id) return g;
      if (g.savedMonths.includes(month)) {
        return { ...g, savedMonths: g.savedMonths.filter(m => m !== month), saved: Math.max(0, Math.round((g.saved - g.monthlyAmount) * 100) / 100) };
      }
      return { ...g, savedMonths: [...g.savedMonths, month], saved: Math.round((g.saved + g.monthlyAmount) * 100) / 100 };
    }),
  };
}

export interface WizardResult {
  income: number;
  incomePeriod: 'week' | 'month';
  goals: Array<{ name: string; monthlyAmount: number; target: number }>;
  /** Monthly limit per expense category id. 0 = no limit. */
  limits: Record<string, number>;
}

/** Applies the wizard: sets monthly limits, upserts savings goals by name (keeping progress), remembers the income. */
export function applyWizard(d: AppData, workspaceId: string, r: WizardResult): AppData {
  let out = d;
  for (const [id, amount] of Object.entries(r.limits)) out = setCategoryLimit(out, id, amount, 'month');
  const wanted = new Set(r.goals.map(g => g.name.trim().toLowerCase()));
  // goals the user switched off in the wizard are removed
  out = { ...out, goals: out.goals.filter(g => g.workspaceId !== workspaceId || wanted.has(g.name.trim().toLowerCase())) };
  for (const g of r.goals) {
    const existing = out.goals.find(x => x.workspaceId === workspaceId && x.name.trim().toLowerCase() === g.name.trim().toLowerCase());
    out = existing ? updateGoal(out, existing.id, { monthlyAmount: g.monthlyAmount, target: g.target }) : addGoal(out, workspaceId, g.name, g.monthlyAmount, g.target);
  }
  return { ...out, prefs: { ...out.prefs, plans: { ...(out.prefs.plans ?? {}), [workspaceId]: { income: r.income, incomePeriod: r.incomePeriod } } } };
}
