'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavTab {
  href: string;
  label: string;
  icon: string;
  matchExact?: boolean;
}

const TABS: NavTab[] = [
  { href: '/finance', label: 'חשבונות בנק', icon: '🏦', matchExact: true },
  { href: '/finance/credit-cards', label: 'כרטיסי אשראי', icon: '💳' },
  { href: '/finance/checks', label: 'שיקים', icon: '📝' },
  {
    href: '/finance/standing-orders',
    label: 'הוראות קבע',
    icon: '🔄',
  },
  { href: '/finance/transactions', label: 'תנועות', icon: '📊' },
  { href: '/finance/cash-flow', label: 'תזרים מזומנים', icon: '💹' },
  { href: '/finance/debts', label: 'חובות והלוואות', icon: '💸' },
  { href: '/finance/reconciliation', label: 'התאמת בנק', icon: '🔍' },
];

export function FinanceNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
      <ul className="flex items-center gap-1 p-1 min-w-max">
        {TABS.map((tab) => {
          const active = tab.matchExact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-[rgba(245,158,11,0.15)] text-[#92400e] font-semibold'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span aria-hidden className="text-base leading-none">
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
