import type { AppData } from '../types';
import { normalizeData, type NormalizeResult } from './storage';

function download(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportBackup(data: AppData) {
  download(`margin-backup-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

const csvCell = (v: string | number) => {
  let s = String(v);
  // Stop spreadsheet apps from treating text as a formula.
  if (/^[=+\-@]/.test(s) && typeof v === 'string') s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCsv(data: AppData, workspaceId: string) {
  const ws = data.workspaces.find(w => w.id === workspaceId);
  const accName = (id?: string) => data.accounts.find(a => a.id === id)?.name ?? '';
  const catName = (id: string | null) => data.categories.find(c => c.id === id)?.name ?? '';
  const rows = data.transactions
    .filter(t => t.workspaceId === workspaceId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(t => [t.date, t.type, t.amount, catName(t.categoryId), accName(t.accountId), accName(t.toAccountId), t.note].map(csvCell).join(','));
  const csv = ['Date,Type,Amount,Category,Account,To account,Note', ...rows].join('\n');
  download(`margin-${(ws?.name ?? 'workspace').toLowerCase().replace(/\W+/g, '-')}-${stamp()}.csv`, '﻿' + csv, 'text/csv');
}

export async function readBackupFile(file: File): Promise<NormalizeResult> {
  const text = await file.text();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('That file is not a valid Margin backup.'); }
  const res = normalizeData(parsed);
  if (!res) throw new Error('That file is not a valid Margin backup.');
  return res;
}
