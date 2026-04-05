'use client';

import { Badge } from '@/components/ui/badge';

const LABELS: Record<string, string> = {
  text_post: 'Post',
  carousel: 'Carousel',
  reel: 'Reel',
  story: 'Story',
  video: 'Video',
  blog: 'Blog',
  slides: 'Slides',
};

export function ContentTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="secondary" className="text-[9px]">
      {LABELS[type] || type}
    </Badge>
  );
}
