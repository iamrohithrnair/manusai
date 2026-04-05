'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ContentTypeBadge } from '@/components/content-type-badge';
import { PlatformSelectorMini } from '@/components/platform-selector';

export interface PlanItemData {
  _id: string;
  topic: string;
  status: string;
  platform?: string;
  contentType?: string;
  contentItem?: {
    _id: string;
    textContent?: string;
    status?: string;
    carouselImages?: string[];
  };
}

interface PipelineCardProps {
  item: PlanItemData;
  onClick: (item: PlanItemData) => void;
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-slate-100 text-slate-700',
  researching: 'bg-sky-100 text-sky-800',
  generating: 'bg-amber-100 text-amber-800',
  drafted: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  published: 'bg-emerald-100 text-emerald-900',
};

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  researching: 'Researching',
  generating: 'Generating',
  drafted: 'Draft ready',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
};

export function PipelineCard({ item, onClick }: PipelineCardProps) {
  const dragRef = { current: false };

  return (
    <Card
      draggable
      onDragStart={(e) => {
        dragRef.current = true;
        e.dataTransfer.setData('text/plain', item._id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => {
        setTimeout(() => {
          dragRef.current = false;
        }, 0);
      }}
      className="p-3 space-y-2 cursor-grab active:cursor-grabbing clay hover:border-primary/40 transition-all"
      onClick={() => {
        if (!dragRef.current) onClick(item);
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 min-w-0">
          <PlatformSelectorMini platform={item.platform} />
          {item.contentType && <ContentTypeBadge type={item.contentType} />}
        </div>
        <Badge className={`text-[10px] shrink-0 ${STATUS_COLORS[item.status] ?? ''}`}>
          {STATUS_LABELS[item.status] ?? item.status}
        </Badge>
      </div>

      <p className="text-xs leading-relaxed line-clamp-3">{item.topic}</p>

      {item.contentItem?.textContent && (
        <div className="text-[11px] text-muted-foreground border-l-2 border-accent pl-2 line-clamp-2">
          {item.contentItem.textContent}
        </div>
      )}
    </Card>
  );
}
