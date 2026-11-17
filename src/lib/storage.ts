import type { AppData } from '../types';
import { createInitialData } from './seed';

const KEY = 'margin:v1';
const CORRUPT_KEY = 'margin:v1:corrupt-backup';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export interface NormalizeResult { data: AppData; dropped: number }

/**
 * Validates data loaded from storage or a backup file. Returns null if it isn't a Margin backup at all;
 * individual malformed rows are dropped (and counted) instead of crashing the app.
 */
export function normalizeData(raw: unknown): NormalizeResult | null {
  if (!isObj(raw) || raw.version !== 1) return null;
  const arr = (k: string): Record<string, unknown>[] => (Array.isArray(raw[k]) ? (raw[k] as unknown[]).filter(isObj) : []);
  let dropped = 0;
  const keep = <T,>(rows: Record<string, unknown>[], ok: (r: Record<string, unknown>) => boolean): T[] =>
    rows.filter(r => (ok(r) ? true : (dropped++, false))) as unknown as T[];

  const workspaces = keep<AppData['workspaces'][number]>(arr('workspaces'), r => isStr(r.id) && isStr(r.name) && (r.type === 'personal' || r.type === 'business'));
  if (workspaces.length === 0) return null;
  const wsIds = new Set(workspaces.map(w => w.id));
  const inWs = (r: Record<string, unknown>) => isStr(r.workspaceId) && wsIds.has(r.workspaceId);

  const accounts = keep<AppData['accounts'][number]>(arr('accounts'), r => isStr(r.id) && inWs(r) && isStr(r.name) && isNum(r.openingBalance));
  const categories = keep<AppData['categories'][number]>(arr('categories'), r => isStr(r.id) && inWs(r) && isStr(r.name) && (r.kind === 'income' || r.kind === 'expense') && isNum(r.monthlyLimit));
  const accIds = new Set(accounts.map(a => a.id));
  const transactions = keep<AppData['transactions'][number]>(arr('transactions'), r =>
    isStr(r.id) && inWs(r) && isNum(r.amount) && r.amount > 0 && isStr(r.date) && DATE_RE.test(r.date)
    && (r.type === 'income' || r.type === 'expense' || r.type === 'transfer') && isStr(r.accountId) && accIds.has(r.accountId)
    && (r.type !== 'transfer' || (isStr(r.toAccountId) && accIds.has(r.toAccountId))));
  const scheduled = keep<AppData['scheduled'][number]>(arr('scheduled'), r =>
    isStr(r.id) && inWs(r) && isNum(r.amount) && r.amount > 0 && isStr(r.dueDate) && DATE_RE.test(r.dueDate)
    && (r.type === 'income' || r.type === 'expense') && isStr(r.title) && (r.status === 'planned' || r.status === 'paid'));

  const p = isObj(raw.prefs) ? raw.prefs : {};
  const active = isStr(p.activeWorkspaceId) && wsIds.has(p.activeWorkspaceId) ? p.activeWorkspaceId : workspaces[0].id;
  const data: AppData = {
    version: 1,
    workspaces,
    accounts: accounts.map(a => ({ ...a, isPrimary: !!a.isPrimary, isActive: a.isActive !== false })),
    categories: categories.map(c => {
      const per = c.limitPeriod === 'day' || c.limitPeriod === 'week' ? c.limitPeriod : undefined;
      const { limitPeriod: _p, limitAmount: _a, group: _g, ...rest } = c;
      return {
        ...rest, color: isStr(c.color) ? c.color : '#A8A29E',
        ...(per && isNum(c.limitAmount) && c.limitAmount >= 0 ? { limitPeriod: per, limitAmount: c.limitAmount } : {}),
        ...(isStr(c.group) && c.group.trim() ? { group: c.group.trim().slice(0, 30) } : {}),
      };
    }),
    transactions: transactions.map(t => ({ ...t, note: isStr(t.note) ? t.note : '', categoryId: isStr(t.categoryId) ? t.categoryId : null })),
    scheduled: scheduled.map(s => ({
      ...s, categoryId: isStr(s.categoryId) ? s.categoryId : null, accountId: isStr(s.accountId) ? s.accountId : null,
      repeat: s.repeat === 'monthly' ? 'monthly' : 'none',
    })),
    prefs: {
      activeWorkspaceId: active,
      balanceView: isObj(p.balanceView) ? (p.balanceView as AppData['prefs']['balanceView']) : {},
      selectedAccountIds: isObj(p.selectedAccountIds) ? (p.selectedAccountIds as AppData['prefs']['selectedAccountIds']) : {},
      lastExportAt: isStr(p.lastExportAt) ? p.lastExportAt : null,
    },
  };
  return { data, dropped };
}

export interface LoadResult { data: AppData; notice: string | null }

export function loadData(): LoadResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return { data: createInitialData(), notice: 'Storage is blocked in this browser, so nothing will be saved. Try opening Margin in a normal (non-private) tab.' };
  }
  if (!raw) return { data: createInitialData(), notice: null };
  try {
    const res = normalizeData(JSON.parse(raw));
    if (res) {
      return { data: res.data, notice: res.dropped > 0 ? `${res.dropped} unreadable record(s) were skipped while loading.` : null };
    }
  } catch { /* fall through */ }
  // Never silently overwrite data we couldn't read: keep a copy.
  try { localStorage.setItem(CORRUPT_KEY, raw); } catch { /* ignore */ }
  return { data: createInitialData(), notice: 'Your saved data could not be read. A copy was kept on this device; you may restore from a backup file.' };
}

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function hasStoredData(): boolean {
  try { return localStorage.getItem(KEY) !== null; } catch { return false; }
}

export function clearStoredData(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
