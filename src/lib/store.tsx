import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppData } from '../types';
import { loadData, saveData } from './storage';

interface Store {
  data: AppData;
  /** Apply a pure update function to the data; it is saved to this device automatically. */
  apply: (fn: (d: AppData) => AppData) => void;
  notice: string | null;
  dismissNotice: () => void;
  saveError: boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadData);
  const [data, setData] = useState<AppData>(initial.data);
  const [notice, setNotice] = useState<string | null>(initial.notice);
  const [saveError, setSaveError] = useState(false);

  const apply = useCallback((fn: (d: AppData) => AppData) => setData(prev => fn(prev)), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    setSaveError(!saveData(data));
  }, [data]);

  // Ask the browser not to evict our data when storage is tight.
  useEffect(() => {
    try { void navigator.storage?.persist?.(); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({ data, apply, notice, dismissNotice, saveError }), [data, apply, notice, dismissNotice, saveError]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

/** The active workspace plus its accounts and categories. */
export function useActive() {
  const { data } = useStore();
  return useMemo(() => {
    const ws = data.workspaces.find(w => w.id === data.prefs.activeWorkspaceId) ?? data.workspaces[0];
    const allAccounts = data.accounts.filter(a => a.workspaceId === ws.id);
    return {
      ws,
      isBusiness: ws.type === 'business',
      allAccounts,
      accounts: allAccounts.filter(a => a.isActive),
      categories: data.categories.filter(c => c.workspaceId === ws.id),
    };
  }, [data]);
}
