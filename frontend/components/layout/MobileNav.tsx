'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Activity, MapPin, Database } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Health', icon: Activity },
  { href: '/locations', label: 'Locations', icon: MapPin },
  { href: '/my-data', label: 'My Data', icon: Database },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-md border-t border-border-soft md:hidden">
      <div className="flex items-center justify-around py-2 px-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-[var(--radius-md)]
                transition-colors
                ${isActive
                  ? 'text-accent bg-accent-soft'
                  : 'text-text-tertiary hover:text-text-secondary'
                }
              `}
            >
              <Icon size={20} />
              <span className="text-[0.6875rem] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
