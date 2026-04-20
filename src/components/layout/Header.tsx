'use client';

import { toggleSidebar } from './sidebar-state';

interface HeaderProps {
  username: string;
}

export function Header({ username }: HeaderProps) {
  return (
    <header className="h-[60px] bg-white shadow-sm flex items-center px-4 md:px-6 sticky top-0 z-20 print:hidden">
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="פתח תפריט"
        className="md:hidden p-2 rounded-md hover:bg-gray-100 text-gray-700"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <div className="ms-auto text-sm text-gray-600 truncate">{username}</div>
    </header>
  );
}
