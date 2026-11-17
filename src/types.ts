export type WorkspaceType = 'personal' | 'business';
export type AccountType = 'bank' | 'cash' | 'e_wallet' | 'credit_card' | 'other';
export type TxType = 'income' | 'expense' | 'transfer';
export type CategoryKind = 'income' | 'expense';
export type BalanceView = 'all' | 'selected' | 'primary';
export type Repeat = 'none' | 'monthly';

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
}

export interface Account {
  id: string;
  workspaceId: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  isPrimary: boolean;
  isActive: boolean;
}

export interface Category {
  id: string;
  workspaceId: string;
  name: string;
  kind: CategoryKind;
  /** Monthly budget limit in pesos. 0 = no limit set. Only used for expense categories. */
  monthlyLimit: number;
  /** How the limit was entered. Missing = 'month'. For 'day'/'week', the amount is limitAmount. */
  limitPeriod?: LimitPeriod;
  limitAmount?: number;
  /** Optional group name (e.g. Food) so related budgets roll up together. */
  group?: string;
  color: string;
}

export type LimitPeriod = 'day' | 'week' | 'month';

export interface Transaction {
  id: string;
  workspaceId: string;
  type: TxType;
  amount: number;
  /** YYYY-MM-DD (local date) */
  date: string;
  accountId: string;
  /** Only for transfers: the destination account */
  toAccountId?: string;
  categoryId: string | null;
  note: string;
}

/** A planned (expected) income or expense — bills, loan payments, etc. */
export interface Scheduled {
  id: string;
  workspaceId: string;
  type: 'income' | 'expense';
  title: string;
  amount: number;
  dueDate: string;
  categoryId: string | null;
  accountId: string | null;
  repeat: Repeat;
  status: 'planned' | 'paid';
  transactionId?: string;
}

/** Something you set money aside for each month (emergency fund, travel, ...). Tracked by ticking it off. */
export interface SavingsGoal {
  id: string;
  workspaceId: string;
  name: string;
  /** How much to set aside each month. */
  monthlyAmount: number;
  /** Optional goal total. 0 = no target. */
  target: number;
  /** Total set aside so far. */
  saved: number;
  /** Months (YYYY-MM) already ticked off. */
  savedMonths: string[];
}

/** What the budget wizard last used, so it can be re-opened with the same numbers. */
export interface BudgetPlan {
  income: number;
  incomePeriod: 'week' | 'month';
}

export interface Prefs {
  activeWorkspaceId: string;
  balanceView: Record<string, BalanceView>;
  selectedAccountIds: Record<string, string[]>;
  lastExportAt: string | null;
  plans?: Record<string, BudgetPlan>;
}

export interface AppData {
  version: 1;
  workspaces: Workspace[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  scheduled: Scheduled[];
  goals: SavingsGoal[];
  prefs: Prefs;
}
