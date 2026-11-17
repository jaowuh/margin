import type { Account, AppData, BalanceView, Category, LimitPeriod, Scheduled, Transaction } from '../types';
import { daysInMonth, monthKeyOf, round2, todayStr } from './format';

export type BudgetStatus = 'none' | 'ok' | 'warn' | 'over';

/** < 80% ok, 80-100% warn, > 100% over. */
export function statusFor(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return 'none';
  const ratio = spent / limit;
  if (ratio > 1) return 'over';
  if (ratio >= 0.8) return 'warn';
  return 'ok';
}

export function inWorkspace<T extends { workspaceId: string }>(items: T[], workspaceId: string): T[] {
  return items.filter(i => i.workspaceId === workspaceId);
}

export function accountBalance(data: AppData, account: Account): number {
  let bal = account.openingBalance;
  for (const t of data.transactions) {
    if (t.workspaceId !== account.workspaceId) continue;
    if (t.type === 'income' && t.accountId === account.id) bal += t.amount;
    else if (t.type === 'expense' && t.accountId === account.id) bal -= t.amount;
    else if (t.type === 'transfer') {
      if (t.accountId === account.id) bal -= t.amount;
      if (t.toAccountId === account.id) bal += t.amount;
    }
  }
  return round2(bal);
}

export function workspaceBalance(data: AppData, workspaceId: string, view: BalanceView, selectedIds: string[]): number {
  const accounts = inWorkspace(data.accounts, workspaceId).filter(a => a.isActive);
  const picked = accounts.filter(a => {
    if (view === 'all') return true;
    if (view === 'primary') return a.isPrimary;
    return selectedIds.includes(a.id);
  });
  return round2(picked.reduce((sum, a) => sum + accountBalance(data, a), 0));
}

/** A category's limit expressed per month (day/week limits scale with the month's length). */
export function monthlyLimitFor(c: Category, month: string): number {
  if (!c.limitPeriod || c.limitPeriod === 'month') return c.monthlyLimit;
  const amt = c.limitAmount ?? 0;
  const dim = daysInMonth(month);
  return round2(c.limitPeriod === 'day' ? amt * dim : (amt * dim) / 7);
}

/** The same limit for a day, a week (7 days) or the month. */
export function limitInPeriod(c: Category, month: string, period: LimitPeriod): number {
  const m = monthlyLimitFor(c, month);
  if (period === 'month') return m;
  const dim = daysInMonth(month);
  return Math.round(period === 'day' ? m / dim : (m * 7) / dim); // whole pesos
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Inclusive date window for a view. Weeks run Monday to Sunday. */
export function periodWindow(period: LimitPeriod, month: string, today: string): { start: string; end: string } {
  if (period === 'month') return { start: `${month}-01`, end: `${month}-${String(daysInMonth(month)).padStart(2, '0')}` };
  if (period === 'day') return { start: today, end: today };
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const back = (dt.getDay() + 6) % 7; // Monday = 0
  const start = new Date(y, m - 1, d - back);
  const end = new Date(y, m - 1, d - back + 6);
  return { start: ymd(start), end: ymd(end) };
}

/** 1-7, Monday = 1. */
export function dayOfWeekMon(today: string): number {
  const [y, m, d] = today.split('-').map(Number);
  return ((new Date(y, m - 1, d).getDay() + 6) % 7) + 1;
}

export function monthTransactions(data: AppData, workspaceId: string, month: string): Transaction[] {
  return data.transactions.filter(t => t.workspaceId === workspaceId && monthKeyOf(t.date) === month);
}

export interface CategoryRow {
  id: string | null;
  name: string;
  color: string;
  spent: number;
  limit: number;
  /** spent / limit * 100, or 0 when there's no limit */
  pct: number;
  status: BudgetStatus;
  group?: string;
}

export const UNCATEGORIZED_COLOR = '#78716C';

/** Spending per expense category for a month, plus an "Uncategorized" row if needed. */
export function categoryBreakdown(data: AppData, workspaceId: string, month: string, period: LimitPeriod = 'month', today = todayStr()): CategoryRow[] {
  const cats = inWorkspace(data.categories, workspaceId).filter(c => c.kind === 'expense');
  const txs = txsInPeriod(data, workspaceId, month, period, today).filter(t => t.type === 'expense');
  const rows: CategoryRow[] = cats.map(c => {
    const spent = round2(txs.filter(t => t.categoryId === c.id).reduce((s, t) => s + t.amount, 0));
    return { ...rowFor(c.id, c.name, c.color, spent, limitInPeriod(c, month, period)), group: c.group || undefined };
  });
  const knownIds = new Set(cats.map(c => c.id));
  const loose = round2(txs.filter(t => !t.categoryId || !knownIds.has(t.categoryId)).reduce((s, t) => s + t.amount, 0));
  if (loose > 0) rows.push(rowFor(null, 'Uncategorized', UNCATEGORIZED_COLOR, loose, 0));
  return rows.sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name));
}

/** Transactions in the month, or in today's day/week window for the Day and Week views. */
export function txsInPeriod(data: AppData, workspaceId: string, month: string, period: LimitPeriod, today: string): Transaction[] {
  if (period === 'month') return monthTransactions(data, workspaceId, month);
  const w = periodWindow(period, month, today);
  return data.transactions.filter(t => t.workspaceId === workspaceId && t.date >= w.start && t.date <= w.end);
}

function rowFor(id: string | null, name: string, color: string, spent: number, limit: number): CategoryRow {
  return { id, name, color, spent, limit, pct: limit > 0 ? (spent / limit) * 100 : 0, status: statusFor(spent, limit) };
}

export interface MonthSummary {
  income: number;
  spent: number;
  net: number;
  /** Sum of all monthly category limits */
  budget: number;
  remaining: number;
  usedPct: number;
  status: BudgetStatus;
  /** Spending in categories that have no limit (incl. uncategorized) */
  unbudgetedSpent: number;
  /** Planned-but-unpaid expenses due in this month */
  upcomingExpenses: number;
  /** budget - spent - upcoming planned bills */
  leftAfterUpcoming: number;
}

export function monthSummary(data: AppData, workspaceId: string, month: string, period: LimitPeriod = 'month', today = todayStr()): MonthSummary {
  const txs = txsInPeriod(data, workspaceId, month, period, today);
  const income = round2(txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
  const spent = round2(txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
  const rows = categoryBreakdown(data, workspaceId, month, period, today);
  const budget = round2(rows.reduce((s, r) => s + r.limit, 0));
  const unbudgetedSpent = round2(rows.filter(r => r.limit <= 0).reduce((s, r) => s + r.spent, 0));
  const upcomingExpenses = round2(
    data.scheduled
      .filter(s => s.workspaceId === workspaceId && s.status === 'planned' && s.type === 'expense' && monthKeyOf(s.dueDate) === month)
      .reduce((sum, s) => sum + s.amount, 0),
  );
  return {
    income,
    spent,
    net: round2(income - spent),
    budget,
    remaining: round2(budget - spent),
    usedPct: budget > 0 ? (spent / budget) * 100 : 0,
    status: statusFor(spent, budget),
    unbudgetedSpent,
    upcomingExpenses,
    leftAfterUpcoming: round2(budget - spent - upcomingExpenses),
  };
}

/** How far through the month we are (0-100). Only meaningful for the current month. */
export function monthElapsedPct(month: string, today: string): number | null {
  const cur = monthKeyOf(today);
  if (month !== cur) return null;
  const day = Number(today.slice(8, 10));
  return (day / daysInMonth(month)) * 100;
}

/** Planned items to show as "upcoming": unpaid, due this month or earlier (overdue). */
export function upcomingItems(data: AppData, workspaceId: string, month: string): Scheduled[] {
  return data.scheduled
    .filter(s => s.workspaceId === workspaceId && s.status === 'planned' && monthKeyOf(s.dueDate) <= month)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function categoryById(categories: Category[], id: string | null | undefined): Category | undefined {
  return id ? categories.find(c => c.id === id) : undefined;
}

// ---------- budget wizard helpers ----------
/** Income entered per week or per month, as a monthly figure (52 weeks / 12 months). */
export function monthlyIncome(amount: number, period: 'week' | 'month'): number {
  return Math.round(period === 'week' ? (amount * 52) / 12 : amount);
}

const WEIGHTS: Record<string, number> = {
  household: 25, food: 25, transport: 12, bills: 20, daughter: 8, 'personal & other': 10,
  ingredients: 35, supplies: 8, utilities: 8, staff: 25, rent: 15, maintenance: 4, 'other expenses': 5,
};

/** Split `total` across names using sensible default weights (equal-ish for unknown names). Whole pesos, sums to total. */
export function suggestSplit(names: string[], total: number): number[] {
  if (names.length === 0 || total <= 0) return names.map(() => 0);
  const w = names.map(n => WEIGHTS[n.trim().toLowerCase()] ?? 10);
  const sum = w.reduce((a, b) => a + b, 0);
  const raw = w.map(x => Math.floor((total * x) / sum / 10) * 10); // nearest lower 10
  let rest = Math.round(total - raw.reduce((a, b) => a + b, 0));
  const order = w.map((x, i) => [x, i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length) { const add = Math.min(10, rest); raw[order[k][1]] += add; rest -= add; }
  return raw;
}

/** Split a monthly savings total across goals (default 50 / 30 / 20 for the first three, then equal). */
export function splitSavings(count: number, total: number): number[] {
  if (count <= 0 || total <= 0) return Array(Math.max(0, count)).fill(0);
  const base = count === 1 ? [1] : count === 2 ? [0.6, 0.4] : [0.5, 0.3, 0.2, ...Array(Math.max(0, count - 3)).fill(0.1)];
  const sum = base.reduce((a, b) => a + b, 0);
  const out = base.slice(0, count).map(x => Math.floor((total * x) / sum / 10) * 10);
  out[0] += Math.round(total - out.reduce((a, b) => a + b, 0));
  return out;
}
