'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Connector {
  id?: string;
  uuid?: string;
  type?: string;
  name?: string;
}

export function PublishDialog({
  open,
  onClose,
  previewText,
  onPublish,
}: {
  open: boolean;
  onClose: () => void;
  previewText: string;
  onPublish: (platform: string) => Promise<void>;
}) {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [platform, setPlatform] = useState('linkedin');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch('/api/connectors')
      .then((r) => r.json())
      .then((d) => setConnectors(d.connectors || []))
      .catch(() => setConnectors([]));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg clay">
        <h2 className="text-lg font-semibold">Publish via Manus</h2>
        <p className="text-xs text-muted-foreground">
          Uses your connected accounts from Manus. Pick a platform label to match a connector.
        </p>
        <div className="flex gap-2 flex-wrap">
          {['linkedin', 'instagram', 'blog'].map((p) => (
            <Button
              key={p}
              size="sm"
              variant={platform === p ? 'default' : 'outline'}
              className="capitalize"
              onClick={() => setPlatform(p)}
            >
              {p}
            </Button>
          ))}
        </div>
        {connectors.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {connectors.length} connector(s) available in your Manus workspace.
          </p>
        )}
        <ScrollArea className="h-32 border rounded-lg p-2 text-xs bg-muted/30">
          {previewText.slice(0, 2000)}
        </ScrollArea>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              setBusy(true);
              try {
                await onPublish(platform);
                onClose();
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          >
            {busy ? 'Publishing…' : 'Confirm publish'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
