'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Activity, MapPin, Database, LogOut } from 'lucide-react';
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
    <aside className="
      hidden md:flex
      flex-col flex-shrink-0
      h-[calc(100vh-16px)] sticky top-2 z-30
      w-[60px] hover:w-[220px]
      transition-[width] duration-300 ease-in-out
      ml-2 my-2 mr-0
      bg-surface/82 backdrop-blur-xl
      rounded-[var(--radius-xl)]
      shadow-lg border border-white/25
      overflow-hidden
      group
    ">
      {/* Logo — links to landing page */}
      <Link href="/" className="h-14 flex items-center px-4 flex-shrink-0 overflow-hidden">
        <Image
          src="/assets/medunity-logo.png"
          alt="Medunity"
          width={130}
          height={30}
          className="h-7 w-auto flex-shrink-0"
          priority
        />
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center h-10
                rounded-[var(--radius-md)]
                transition-all duration-150
                ${isActive
                  ? 'bg-accent-soft text-accent shadow-sm'
                  : 'text-text-secondary hover:bg-surface-soft hover:text-text-primary'
                }
              `}
            >
              <div className="w-[44px] flex items-center justify-center flex-shrink-0">
                <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
              </div>
              <span className="
                opacity-0 group-hover:opacity-100
                transition-opacity duration-200 delay-100
                whitespace-nowrap text-[0.8125rem] font-medium
                pr-3
              ">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-2 py-3 flex-shrink-0">
        {loading ? (
          <div className="w-9 h-9 mx-auto rounded-full skeleton" />
        ) : user ? (
          <div className="space-y-1">
            <div className="flex items-center h-10">
              <div className="w-[44px] flex items-center justify-center flex-shrink-0">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center text-[0.6875rem] font-bold">
                    {getInitials(user.user_metadata?.full_name, user.email)}
                  </div>
                )}
              </div>
              <div className="min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 pr-3">
                <p className="text-[0.75rem] font-medium text-text-primary truncate">
                  {user.user_metadata?.full_name || user.email?.split('@')[0]}
                </p>
                <p className="text-[0.625rem] text-text-tertiary truncate">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center h-9">
              <button
                onClick={signOut}
                className="
                  flex items-center w-full h-full
                  text-text-tertiary hover:text-danger hover:bg-danger-soft
                  rounded-[var(--radius-sm)] transition-colors cursor-pointer
                "
              >
                <div className="w-[44px] flex items-center justify-center flex-shrink-0">
                  <LogOut size={16} />
                </div>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 whitespace-nowrap text-[0.75rem] pr-3">
                  Sign out
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center h-10">
            <div className="w-[44px] flex items-center justify-center flex-shrink-0">
              <button
                onClick={signInWithGoogle}
                className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-hover transition-colors cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
