'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  clearManusApiKeyFromStorage,
  hasStoredManusApiKey,
  loadManusApiKeyFromStorage,
  saveManusApiKeyToStorage,
} from '@/lib/manus-key-storage';

export type ManusApiKeyContextValue = {
  /** Decrypted key for API calls; null if none stored (server may still use MANUS_API_KEY). */
  apiKey: string | null;
  /** Initial decrypt finished — safe to attach headers. */
  ready: boolean;
  /** Encrypted blob exists in localStorage. */
  hasStoredKey: boolean;
  saveKey: (plain: string) => Promise<void>;
  clearKey: () => void;
};

const ManusApiKeyContext = createContext<ManusApiKeyContextValue | null>(null);

export function ManusApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHasStoredKey(hasStoredManusApiKey());
    void loadManusApiKeyFromStorage().then((k) => {
      if (!cancelled) {
        setApiKey(k);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveKey = useCallback(async (plain: string) => {
    await saveManusApiKeyToStorage(plain);
    const t = plain.trim();
    setHasStoredKey(!!t);
    setApiKey(t || null);
  }, []);

  const clearKey = useCallback(() => {
    clearManusApiKeyFromStorage();
    setHasStoredKey(false);
    setApiKey(null);
  }, []);

  const value = useMemo(
    () => ({ apiKey, ready, hasStoredKey, saveKey, clearKey }),
    [apiKey, ready, hasStoredKey, saveKey, clearKey]
  );

  return <ManusApiKeyContext.Provider value={value}>{children}</ManusApiKeyContext.Provider>;
}

export function useManusApiKey(): ManusApiKeyContextValue {
  const ctx = useContext(ManusApiKeyContext);
  if (!ctx) {
    throw new Error('useManusApiKey must be used within ManusApiKeyProvider');
  }
  return ctx;
}
