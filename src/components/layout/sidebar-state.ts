'use client';

import { useSyncExternalStore } from 'react';

let isOpen = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function toggleSidebar(): void {
  isOpen = !isOpen;
  emit();
}

export function closeSidebar(): void {
  if (!isOpen) return;
  isOpen = false;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSidebarOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isOpen,
    () => false,
  );
}
