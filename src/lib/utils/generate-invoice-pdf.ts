'use client';

export function printInvoice(): void {
  if (typeof window === 'undefined') return;
  window.print();
}
