import type { Account, AppData, BalanceView, Category, Scheduled, Transaction } from '../types';
import { daysInMonth, monthKeyOf, round2 } from './format';

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
}

export const UNCATEGORIZED_COLOR = '#78716C';

/** Spending per expense category for a month, plus an "Uncategorized" row if needed. */
export function categoryBreakdown(data: AppData, workspaceId: string, month: string): CategoryRow[] {
  const cats = inWorkspace(data.categories, workspaceId).filter(c => c.kind === 'expense');
  const txs = monthTransactions(data, workspaceId, month).filter(t => t.type === 'expense');
  const rows: CategoryRow[] = cats.map(c => {
    const spent = round2(txs.filter(t => t.categoryId === c.id).reduce((s, t) => s + t.amount, 0));
    return rowFor(c.id, c.name, c.color, spent, c.monthlyLimit);
  });
  const knownIds = new Set(cats.map(c => c.id));
  const loose = round2(txs.filter(t => !t.categoryId || !knownIds.has(t.categoryId)).reduce((s, t) => s + t.amount, 0));
  if (loose > 0) rows.push(rowFor(null, 'Uncategorized', UNCATEGORIZED_COLOR, loose, 0));
  return rows.sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name));
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

export function monthSummary(data: AppData, workspaceId: string, month: string): MonthSummary {
  const txs = monthTransactions(data, workspaceId, month);
  const income = round2(txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
  const spent = round2(txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
  const rows = categoryBreakdown(data, workspaceId, month);
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
