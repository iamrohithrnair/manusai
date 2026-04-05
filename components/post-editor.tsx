'use client';

import { Textarea } from '@/components/ui/textarea';

export function PostEditor({ content }: { content: string }) {
  return (
    <Textarea
      className="min-h-[200px] text-sm font-mono"
      value={content}
      readOnly
    />
  );
}
