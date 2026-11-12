import type { Account, AccountType, AppData, Category, CategoryKind, Workspace, WorkspaceType } from '../types';
import { uid } from './format';

export const CATEGORY_COLORS = ['#B9684D', '#DCA289', '#D6A15D', '#8B9A9A', '#8F4E3B', '#C98B6B', '#6F8F7F', '#9C7A97', '#A8A29E'];

interface StarterAccount { name: string; type: AccountType }
interface StarterCategory { name: string; kind: CategoryKind }

const PERSONAL_ACCOUNTS: StarterAccount[] = [
  { name: 'Cash', type: 'cash' },
  { name: 'Bank account', type: 'bank' },
  { name: 'GCash', type: 'e_wallet' },
];
const PERSONAL_CATEGORIES: StarterCategory[] = [
  { name: 'Household', kind: 'expense' },
  { name: 'Food', kind: 'expense' },
  { name: 'Transport', kind: 'expense' },
  { name: 'Bills', kind: 'expense' },
  { name: 'Daughter', kind: 'expense' },
  { name: 'Personal & other', kind: 'expense' },
  { name: 'Salary', kind: 'income' },
  { name: 'Other income', kind: 'income' },
];

const BUSINESS_ACCOUNTS: StarterAccount[] = [
  { name: 'Cash drawer', type: 'cash' },
  { name: 'Bank / GCash', type: 'bank' },
];
const BUSINESS_CATEGORIES: StarterCategory[] = [
  { name: 'Ingredients', kind: 'expense' },
  { name: 'Supplies', kind: 'expense' },
  { name: 'Utilities', kind: 'expense' },
  { name: 'Staff', kind: 'expense' },
  { name: 'Rent', kind: 'expense' },
  { name: 'Maintenance', kind: 'expense' },
  { name: 'Other expenses', kind: 'expense' },
  { name: 'Dine-in sales', kind: 'income' },
  { name: 'Takeout & delivery', kind: 'income' },
  { name: 'Other income', kind: 'income' },
];

export function starterFor(workspaceId: string, type: WorkspaceType): { accounts: Account[]; categories: Category[] } {
  const accs = type === 'business' ? BUSINESS_ACCOUNTS : PERSONAL_ACCOUNTS;
  const cats = type === 'business' ? BUSINESS_CATEGORIES : PERSONAL_CATEGORIES;
  let expenseIdx = 0;
  return {
    accounts: accs.map((a, i) => ({
      id: uid(), workspaceId, name: a.name, type: a.type, openingBalance: 0, isPrimary: i === 0, isActive: true,
    })),
    categories: cats.map(c => ({
      id: uid(), workspaceId, name: c.name, kind: c.kind, monthlyLimit: 0,
      color: c.kind === 'expense' ? CATEGORY_COLORS[expenseIdx++ % CATEGORY_COLORS.length] : '#6F8F7F',
    })),
  };
}

export function createInitialData(): AppData {
  const personal: Workspace = { id: uid(), name: 'Personal', type: 'personal' };
  const cafe: Workspace = { id: uid(), name: 'Hillside Cafe', type: 'business' };
  const p = starterFor(personal.id, 'personal');
  const b = starterFor(cafe.id, 'business');
  return {
    version: 1,
    workspaces: [personal, cafe],
    accounts: [...p.accounts, ...b.accounts],
    categories: [...p.categories, ...b.categories],
    transactions: [],
    scheduled: [],
    prefs: { activeWorkspaceId: personal.id, balanceView: {}, selectedAccountIds: {}, lastExportAt: null },
  };
}
