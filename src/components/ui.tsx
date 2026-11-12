import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { CategoryRow, BudgetStatus } from '../lib/calc';
import { addMonths, monthLabel, peso, todayStr } from '../lib/format';

// ---------- Modal ----------
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

// ---------- Toast + confirm ----------
interface ToastAction { label: string; run: () => void }
interface ConfirmOpts { title: string; message: string; confirmLabel?: string; danger?: boolean }
interface UI {
  toast: (message: string, action?: ToastAction) => void;
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
}
const UICtx = createContext<UI | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [toastState, setToast] = useState<{ message: string; action?: ToastAction; key: number } | null>(null);
  const [confirmState, setConfirm] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const toast = useCallback((message: string, action?: ToastAction) => {
    window.clearTimeout(timer.current);
    setToast({ message, action, key: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), action ? 7000 : 3200);
  }, []);

  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>(resolve => setConfirm({ ...opts, resolve })), []);
  const close = (v: boolean) => { confirmState?.resolve(v); setConfirm(null); };

  return (
    <UICtx.Provider value={{ toast, confirm }}>
      {children}
      {toastState && (
        <div className="toast" role="status" key={toastState.key}>
          <span>{toastState.message}</span>
          {toastState.action && (
            <button onClick={() => { toastState.action?.run(); setToast(null); }}>{toastState.action.label}</button>
          )}
        </div>
      )}
      {confirmState && (
        <Modal title={confirmState.title} onClose={() => close(false)}>
          <p className="muted-text">{confirmState.message}</p>
          <div className="modal-actions">
            <button className="btn" onClick={() => close(false)}>Cancel</button>
            <button className={confirmState.danger ? 'btn danger' : 'btn primary'} onClick={() => close(true)}>
              {confirmState.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </Modal>
      )}
    </UICtx.Provider>
  );
}

export function useUI(): UI {
  const c = useContext(UICtx);
  if (!c) throw new Error('useUI must be used inside UIProvider');
  return c;
}

// ---------- Month switcher ----------
export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const current = todayStr().slice(0, 7);
  return (
    <div className="month-switch">
      <button className="icon-btn" onClick={() => onChange(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
      <span className="month-name" aria-live="polite">{monthLabel(month)}</span>
      <button className="icon-btn" onClick={() => onChange(addMonths(month, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
      {month !== current && <button className="link-btn" onClick={() => onChange(current)}>Today</button>}
    </div>
  );
}

// ---------- Progress bar ----------
export function ProgressBar({ pct, status, marker, label }: { pct: number; status: BudgetStatus; marker?: number | null; label: string }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(width)}>
      <div className={`bar-fill ${status}`} style={{ width: `${width}%` }} />
      {marker != null && <div className="bar-marker" style={{ left: `${Math.min(100, marker)}%` }} title="Where you are in the month" />}
    </div>
  );
}

export function StatusPill({ status, ahead }: { status: BudgetStatus; ahead?: boolean }) {
  if (status === 'none') return null;
  const text = status === 'over' ? 'Over budget' : status === 'warn' ? 'Close to limit' : ahead ? 'Ahead of pace' : 'On track';
  const tone = status === 'ok' && ahead ? 'warn' : status;
  return <span className={`pill ${tone}`}>{text}</span>;
}

// ---------- Donut ----------
export function Donut({ rows, total }: { rows: CategoryRow[]; total: number }) {
  const parts = rows.filter(r => r.spent > 0);
  let offset = 25; // start at 12 o'clock
  return (
    <div className="donut" aria-hidden="true">
      <svg viewBox="0 0 42 42">
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--border)" strokeWidth="5" />
        {parts.map(r => {
          const len = total > 0 ? (r.spent / total) * 100 : 0;
          const seg = (
            <circle key={r.id ?? 'none'} cx="21" cy="21" r="15.9155" fill="none" stroke={r.color} strokeWidth="5"
              strokeDasharray={`${Math.max(0, len - (parts.length > 1 ? 0.8 : 0))} ${100 - Math.max(0, len - (parts.length > 1 ? 0.8 : 0))}`}
              strokeDashoffset={offset} />
          );
          offset -= len;
          return seg;
        })}
      </svg>
      <div className="donut-center"><strong>{peso(total)}</strong><span>spent</span></div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

/** Parses what a person types into an amount field ("1,250.5", "₱ 300"). Returns null if not a positive amount. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[₱,\s]/g, '');
  if (!/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0 || n > 1e10) return null;
  return Math.round(n * 100) / 100;
}
