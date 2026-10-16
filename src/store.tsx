import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppState } from '../shared/api';
import type { Role } from '../shared/types';
import { getState, postAction } from './transport';

export interface ActResult<T = unknown> {
  ok: boolean;
  result?: T;
  error?: string;
}

interface Store {
  state: AppState | null;
  role: Role;
  setRole: (r: Role) => void;
  act: <T = unknown>(name: string, body?: Record<string, unknown>) => Promise<ActResult<T>>;
  refresh: () => Promise<void>;
  busy: boolean;
  toast: { kind: 'error' | 'ok'; text: string } | null;
  say: (text: string, kind?: 'error' | 'ok') => void;
  /** Client ms when the state arrived, to tick the demo clock between fetches. */
  fetchedAt: number;
}

const Ctx = createContext<Store | null>(null);

function loadRole(): Role {
  try {
    const r = localStorage.getItem('cureloom.role');
    if (r === 'nurse' || r === 'physician' || r === 'manager') return r;
  } catch {
    /* storage unavailable */
  }
  return 'nurse';
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [role, setRoleState] = useState<Role>(loadRole);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Store['toast']>(null);
  const pending = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);

  const say = useCallback((text: string, kind: 'error' | 'ok' = 'error') => {
    setToast({ kind, text });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 6000 : 3000);
  }, []);

  const accept = useCallback((s: AppState) => {
    setState(s);
    setFetchedAt(Date.now());
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await getState();
      if (pending.current === 0) accept(s);
    } catch {
      /* server restarting; next poll retries */
    }
  }, [accept]);

  const act = useCallback(
    async <T,>(name: string, body: Record<string, unknown> = {}): Promise<ActResult<T>> => {
      pending.current += 1;
      setBusy(true);
      try {
        const r = await postAction(name, role, body);
        const j = r.body;
        if (r.status !== 200) {
          say(j.error ?? 'Something went wrong.');
          return { ok: false, error: j.error };
        }
        accept(j.state);
        return { ok: true, result: j.result as T };
      } catch {
        say('Could not reach the server.');
        return { ok: false, error: 'network' };
      } finally {
        pending.current -= 1;
        setBusy(pending.current > 0);
      }
    },
    [role, accept, say],
  );

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    try {
      localStorage.setItem('cureloom.role', r);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 3000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const value = useMemo(
    () => ({ state, role, setRole, act, refresh, busy, toast, say, fetchedAt }),
    [state, role, setRole, act, refresh, busy, toast, say, fetchedAt],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store & { state: AppState } {
  const s = useContext(Ctx);
  if (!s || !s.state) throw new Error('Store not ready');
  return s as Store & { state: AppState };
}

export function useStoreMaybe(): Store | null {
  return useContext(Ctx);
}

/** Re-render every `ms` milliseconds. */
export function useTick(ms = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

/** The demo clock, ticking between server fetches the same way the server does. */
export function useDemoNowMs(): number {
  const { state, fetchedAt } = useStore();
  const now = useTick(1000);
  const c = state.clock;
  const elapsed = Math.max(0, now - fetchedAt);
  return c.demoNowMs + Math.min(elapsed, Math.max(0, c.capMs - c.demoNowMs));
}

/** Server-real-clock ms, for timers that started on the server. */
export function useServerRealMs(): number {
  const { state, fetchedAt } = useStore();
  const now = useTick(250);
  return state.clock.serverRealMs + (now - fetchedAt);
}
