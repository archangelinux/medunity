import Link from 'next/link';
import Image from 'next/image';
import { Avatar } from '@/components/ui/Avatar';

export function Nav() {
  return (
    <nav className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-border-soft">
      <div className="max-w-6xl mx-auto px-3 md:px-4 py-2.5 flex items-center justify-between">
        {/* Logo */}
        <Link href="/">
          <Image
            src="/assets/medunity-logo.png"
            alt="Medunity"
            width={120}
            height={28}
            className="h-7 w-auto"
            priority
          />
        </Link>

        {/* Right side */}
        <Avatar initials="AK" size="sm" />
      </div>
    </nav>
  );
}
