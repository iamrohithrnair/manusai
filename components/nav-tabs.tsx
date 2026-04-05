'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CompanySelector } from '@/components/company-selector';

const tabs = [
  { href: '/research', label: 'Research' },
  { href: '/content', label: 'Content' },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="flex h-12 items-center px-4 gap-1">
        <Link href="/research" className="flex items-center gap-2 mr-2">
          <div className="h-7 w-7 rounded-xl bg-primary flex items-center justify-center clay">
            <span className="text-primary-foreground font-bold text-xs">G</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">Graphluence</span>
        </Link>
        <div className="h-4 w-px bg-border mx-1" />
        <CompanySelector />
        <div className="h-4 w-px bg-border mx-1" />
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'relative px-3 py-1.5 text-sm font-medium rounded-xl transition-all duration-200 clay-hover',
              pathname === tab.href ? 'clay-pressed text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
