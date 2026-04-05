'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PostEditor } from '@/components/post-editor';
import { PublishDialog } from '@/components/publish-dialog';
import type { PlanItemData } from '@/components/pipeline-card';
import { useManusApiKey } from '@/components/manus-api-key-provider';
import { manusKeyHeaders } from '@/lib/manus-key-storage';

interface ItemDetailPanelProps {
  item: PlanItemData;
  planId: string;
  onClose: () => void;
  onApprove: (itemId: string) => void;
  onReject: (itemId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  researching: 'Researching',
  generating: 'Generating',
  drafted: 'Draft ready',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
};

export function ItemDetailPanel({
  item,
  planId,
  onClose,
  onApprove,
  onReject,
}: ItemDetailPanelProps) {
  const { apiKey } = useManusApiKey();
  const [publishOpen, setPublishOpen] = useState(false);
  const text = item.contentItem?.textContent || '';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col clay" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-base line-clamp-2">{item.topic}</CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                {STATUS_LABELS[item.status] ?? item.status}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 shrink-0">
            ✕
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto space-y-4">
          <PostEditor content={text} />

          <Separator />

          <div className="flex flex-wrap gap-2">
            {item.status === 'drafted' && (
              <>
                <Button size="sm" onClick={() => onApprove(item._id)}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => onReject(item._id)}>
                  Reject
                </Button>
              </>
            )}
            {(item.status === 'approved' || item.status === 'drafted') && (
              <Button size="sm" variant="secondary" onClick={() => setPublishOpen(true)}>
                Publish
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        previewText={text}
        onPublish={async (platform) => {
          await fetch(`/api/plans/${planId}/items/${item._id}/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...manusKeyHeaders(apiKey) },
            body: JSON.stringify({ platform }),
          });
        }}
      />
    </div>
  );
}
