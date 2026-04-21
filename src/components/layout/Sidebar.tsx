'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { closeSidebar, useSidebarOpen } from './sidebar-state';

interface SidebarProps {
  userRole: string;
  username: string;
  companyName?: string;
  equipmentLabel?: string;
  alertsCount?: number;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

function navSlug(href: string): string {
  if (href === '/') return 'dashboard';
  return href.slice(1).replace(/\//g, '-');
}

function buildNavItems(equipmentLabel: string): NavItem[] {
  return [
    { href: '/', label: 'ראשי', icon: '🏠' },
    { href: '/daily-log', label: 'יומן עבודה', icon: '📋' },
    { href: '/equipment', label: equipmentLabel, icon: '🔧' },
    { href: '/vehicles', label: 'רכבים', icon: '🚗' },
    { href: '/workers', label: 'עובדים', icon: '👷' },
    { href: '/fuel', label: 'דלק', icon: '⛽' },
    { href: '/expenses', label: 'הוצאות', icon: '💰' },
    { href: '/invoices', label: 'חשבוניות', icon: '📄' },
    { href: '/budget', label: 'תקציב', icon: '📊' },
    { href: '/finance', label: 'כספים', icon: '🏦' },
    { href: '/reports', label: 'דוחות', icon: '📈' },
    { href: '/settings', label: 'הגדרות', icon: '⚙️' },
    { href: '/help', label: 'עזרה', icon: '❓' },
  ];
}

export function Sidebar({
  userRole,
  username,
  companyName,
  equipmentLabel,
  alertsCount = 0,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isOpen = useSidebarOpen();
  const items = buildNavItems(equipmentLabel || 'ציוד');

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="סגור תפריט"
          onClick={closeSidebar}
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
        />
      )}

      <aside
        data-testid="sidebar"
        className={`fixed top-0 right-0 h-screen w-[260px] bg-[#1a1a2e] text-white z-40 flex flex-col transform transition-transform duration-200 md:translate-x-0 print:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-2xl font-bold text-[#f59e0b]">ניהול חכם</h2>
          {companyName ? (
            <p className="mt-1 text-xs text-gray-400 truncate">{companyName}</p>
          ) : null}
        </div>

        <div className="mx-6 border-t border-[#f59e0b]/40" />

        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {items.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`sidebar-link-${navSlug(item.href)}`}
                onClick={closeSidebar}
                title={item.label}
                aria-label={item.label}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-[rgba(245,158,11,0.15)] border-r-[3px] border-[#f59e0b]'
                    : 'hover:bg-white/5'
                }`}
              >
                <span aria-hidden className="text-lg leading-none">
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.href === '/' && alertsCount > 0 && (
                  <span className="ms-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold">
                    {alertsCount > 99 ? '99+' : alertsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <p className="text-sm font-medium truncate">{username}</p>
          <p className="text-xs text-gray-400 mb-3">{userRole}</p>
          <button
            type="button"
            data-testid="logout-button"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              router.push('/login');
              router.refresh();
            }}
            className="w-full py-2 rounded-md bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
          >
            יציאה
          </button>
          <p
            data-testid="sidebar-version"
            className="mt-3 text-[10px] text-gray-500 text-center"
          >
            ניהול חכם v1.0.0
          </p>
        </div>
      </aside>
    </>
  );
}
