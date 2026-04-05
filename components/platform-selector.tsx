'use client';

import { cn } from '@/lib/utils';

export function PlatformSelectorMini({ platform }: { platform?: string }) {
  const p = (platform || 'other').toLowerCase();
  const label =
    p === 'linkedin' ? 'LI' : p === 'instagram' ? 'IG' : p === 'blog' ? 'Blog' : 'Other';
  const color =
    p === 'linkedin'
      ? 'bg-blue-100 text-blue-800'
      : p === 'instagram'
        ? 'bg-pink-100 text-pink-800'
        : 'bg-zinc-100 text-zinc-700';
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-md', color)}>
      {label}
    </span>
  );
}
