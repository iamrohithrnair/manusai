'use client';

import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PipelineCard, PlanItemData } from '@/components/pipeline-card';
import { cn } from '@/lib/utils';

interface PipelineBoardProps {
  items: PlanItemData[];
  planId: string;
  onCardClick: (item: PlanItemData) => void;
  onItemMoved: () => void;
}

interface Column {
  key: string;
  label: string;
  statuses: string[];
  dropStatus: string | null;
  color: string;
}

const COLUMNS: Column[] = [
  { key: 'planned', label: 'Planned', statuses: ['planned'], dropStatus: 'planned', color: 'border-slate-300' },
  { key: 'gen', label: 'Generating', statuses: ['researching', 'generating'], dropStatus: 'generating', color: 'border-amber-300' },
  { key: 'draft', label: 'Draft ready', statuses: ['drafted'], dropStatus: null, color: 'border-purple-300' },
  { key: 'approved', label: 'Approved', statuses: ['approved'], dropStatus: 'approved', color: 'border-green-300' },
  { key: 'rejected', label: 'Rejected', statuses: ['rejected'], dropStatus: 'rejected', color: 'border-red-300' },
  { key: 'published', label: 'Published', statuses: ['published'], dropStatus: 'published', color: 'border-emerald-400' },
];

export function PipelineBoard({ items, planId, onCardClick, onItemMoved }: PipelineBoardProps) {
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleDrop = async (e: React.DragEvent, col: Column) => {
    e.preventDefault();
    setDragOverCol(null);
    if (!col.dropStatus) return;

    const itemId = e.dataTransfer.getData('text/plain');
    if (!itemId) return;

    const item = items.find((i) => i._id === itemId);
    if (!item) return;
    if (col.statuses.includes(item.status)) return;

    await fetch(`/api/plans/${planId}/items/${itemId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: col.dropStatus }),
    });

    onItemMoved();
  };

  return (
    <div className="flex gap-3 h-full px-3 py-3 overflow-x-auto">
      {COLUMNS.map((col) => {
        const columnItems = items.filter((item) => col.statuses.includes(item.status));
        const isOver = dragOverCol === col.key;

        return (
          <div
            key={col.key}
            className="flex flex-col w-64 shrink-0"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCol(col.key);
            }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => handleDrop(e, col)}
          >
            <div
              className={cn(
                'flex items-center gap-2 pb-2 border-b-2 transition-colors',
                isOver ? 'border-primary' : col.color
              )}
            >
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {col.label}
              </h3>
              {columnItems.length > 0 && (
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  {columnItems.length}
                </span>
              )}
            </div>

            <ScrollArea className="flex-1 pt-2">
              <div className={cn('space-y-2 pr-2 min-h-[48px]', isOver && 'bg-primary/5 rounded-lg')}>
                {columnItems.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/60 text-center py-6 italic">No items</p>
                )}
                {columnItems.map((item) => (
                  <PipelineCard key={item._id} item={item} onClick={onCardClick} />
                ))}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
