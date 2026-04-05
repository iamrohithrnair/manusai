'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useManusApiKey } from '@/components/manus-api-key-provider';

export function SettingsMenu() {
  const { hasStoredKey, saveKey, clearKey } = useManusApiKey();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const next = input.trim();
    if (!next) {
      setError('Enter an API key or use Clear to remove the stored key.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveKey(next);
      setInput('');
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save key');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    clearKey();
    setInput('');
    setError(null);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground"
        onClick={() => {
          setOpen(true);
          setError(null);
          setInput('');
        }}
      >
        Settings
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md clay">
          <DialogHeader>
            <DialogTitle>Manus API key</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Optional. If set here, it is used instead of <code className="text-[10px]">MANUS_API_KEY</code> in{' '}
              <code className="text-[10px]">.env</code>. Stored only in this browser, encrypted (AES-GCM) in
              localStorage. Never sent to Graphluence servers except over HTTPS when calling Manus on your behalf.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label htmlFor="manus-key" className="text-xs font-medium leading-none">
              API key
            </label>
            <Input
              id="manus-key"
              type="password"
              name="manus-api-key"
              autoComplete="off"
              spellCheck={false}
              placeholder={
                hasStoredKey && !input.trim()
                  ? '•••••••••••••••• (saved — type to replace)'
                  : 'Paste Manus API key'
              }
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              className="font-mono text-xs"
            />
            {hasStoredKey && (
              <p className="text-[10px] text-muted-foreground">
                A key is stored in this browser only. Clear it to rely on <code className="text-[10px]">MANUS_API_KEY</code>{' '}
                from the server environment.
              </p>
            )}
            {error && <p className="text-[10px] text-destructive">{error}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={handleClear}>
              Clear stored key
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => void handleSave()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
