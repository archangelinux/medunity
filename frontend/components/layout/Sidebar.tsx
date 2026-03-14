'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Activity, MapPin, Database, LogOut } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/lib/auth';

const navItems = [
  { href: '/dashboard', label: 'Health', icon: Activity },
  { href: '/locations', label: 'Locations', icon: MapPin },
  { href: '/my-data', label: 'My Data', icon: Database },
];

function getInitials(name: string | undefined, email: string | undefined): string {
  if (name) {
    const parts = name.split(' ');
    return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
  }
  if (email) return email[0].toUpperCase();
  return '?';
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  return (
    <aside className="hidden md:flex flex-col w-[220px] flex-shrink-0 h-screen sticky top-0 bg-surface border-r border-border-soft">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border-soft">
        <Image
          src="/assets/medunity-logo.png"
          alt="Medunity"
          width={140}
          height={32}
          className="h-8 w-auto"
          priority
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-[0.875rem] font-medium transition-all duration-150 ${isActive ? 'bg-accent-soft text-accent shadow-sm' : 'text-text-secondary hover:bg-surface-soft hover:text-text-primary'}`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-border-soft">
        {loading ? (
          <div className="px-3 py-2">
            <div className="skeleton h-7 w-full rounded-[var(--radius-sm)]" />
          </div>
        ) : user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-3 py-2">
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt=""
                  className="w-7 h-7 rounded-[var(--radius-md)] object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Avatar initials={getInitials(user.user_metadata?.full_name, user.email)} size="sm" />
              )}
              <div className="min-w-0">
                <p className="text-[0.8125rem] font-medium text-text-primary truncate">
                  {user.user_metadata?.full_name || user.email?.split('@')[0]}
                </p>
                <p className="text-[0.6875rem] text-text-tertiary truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 w-full px-3 py-2 text-[0.8125rem] text-text-secondary hover:text-danger hover:bg-danger-soft rounded-[var(--radius-sm)] transition-colors cursor-pointer"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={signInWithGoogle}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[var(--radius-md)] bg-accent text-white text-[0.8125rem] font-medium hover:bg-accent-hover transition-colors cursor-pointer shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        )}
      </div>
    </aside>
  );
}
