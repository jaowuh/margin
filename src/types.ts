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
  color: string;
}

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

export interface Prefs {
  activeWorkspaceId: string;
  balanceView: Record<string, BalanceView>;
  selectedAccountIds: Record<string, string[]>;
  lastExportAt: string | null;
}

export interface AppData {
  version: 1;
  workspaces: Workspace[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  scheduled: Scheduled[];
  prefs: Prefs;
}
