'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavTab {
  href: string;
  label: string;
  icon: string;
  matchExact?: boolean;
}

interface SettingsNavProps {
  equipmentLabel: string;
}

export function SettingsNav({ equipmentLabel }: SettingsNavProps) {
  const pathname = usePathname();

  const tabs: NavTab[] = [
    { href: '/settings', label: 'פרטי החברה', icon: '🏢', matchExact: true },
    { href: '/settings/pricing', label: 'תמחור', icon: '💰' },
    {
      href: '/settings/equipment-types',
      label: `סוגי ${equipmentLabel}`,
      icon: '🔧',
    },
    { href: '/settings/users', label: 'משתמשים', icon: '👥' },
    { href: '/settings/clients', label: 'לקוחות', icon: '🤝' },
  ];

  return (
    <nav
      className="md:w-56 md:shrink-0 md:sticky md:top-[76px] md:self-start"
      aria-label="ניווט הגדרות"
    >
      <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0 -mx-1 px-1 md:mx-0 md:px-0">
        {tabs.map((tab) => {
          const active = tab.matchExact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-[rgba(245,158,11,0.15)] text-[#92400e] font-semibold border-r-[3px] border-[#f59e0b]'
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
