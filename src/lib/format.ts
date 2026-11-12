const pesoFmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const pesoFmtCents = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Whole pesos for dashboards; shows centavos only when they exist. */
export function peso(value: number): string {
  const v = Math.round(value * 100) / 100;
  return Number.isInteger(v) ? pesoFmt.format(v) : pesoFmtCents.format(v);
}

export function pct(value: number): string {
  return `${Math.round(value)}%`;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Today as a local YYYY-MM-DD string (not UTC). */
export function todayStr(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function shortDate(date: string): { day: string; mon: string } {
  const [y, m, d] = date.split('-').map(Number);
  return {
    day: String(d),
    mon: new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'short' }),
  };
}

/** Same day next month, clamped to the end of shorter months (Jan 31 -> Feb 28). */
export function nextMonthlyDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(y, m, 1); // first of next month
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(d, last);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
