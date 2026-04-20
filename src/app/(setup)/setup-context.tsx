'use client';

import {
  type ReactNode,
  createContext,
  useContext,
  useMemo,
} from 'react';

interface SetupSession {
  userId: string;
  tenantId: string;
}

const SetupContext = createContext<SetupSession | null>(null);

interface SetupProviderProps extends SetupSession {
  children: ReactNode;
}

export function SetupProvider({
  userId,
  tenantId,
  children,
}: SetupProviderProps) {
  const value = useMemo(() => ({ userId, tenantId }), [userId, tenantId]);
  return (
    <SetupContext.Provider value={value}>{children}</SetupContext.Provider>
  );
}

export function useSetupSession(): SetupSession {
  const ctx = useContext(SetupContext);
  if (!ctx) {
    throw new Error('useSetupSession must be used inside <SetupProvider>');
  }
  return ctx;
}
