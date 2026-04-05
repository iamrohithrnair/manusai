'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import { MessageList } from './message-list';
import { MessageInput } from './message-input';
import { Button } from '@/components/ui/button';
import { useManusApiKey } from '@/components/manus-api-key-provider';
import { manusKeyHeaders } from '@/lib/manus-key-storage';

interface ChatInterfaceProps {
  apiEndpoint: string;
  chatId?: string;
  initialMessages?: UIMessage[];
  rootCompanyId?: string;
  /** Pre-fill the input box (user still has to press Send) */
  prefillMessage?: string;
  /** Bump to force-apply prefillMessage again (same session). */
  prefillRevision?: number;
  /**
   * Poll Manus in the background while this chat is open / visible instead of blocking the stream.
   * Matches `/api/chat/{research|content}/pending` and `/sync`.
   */
  manusBackgroundSync?: 'research' | 'content';
  /** After a sync completes, fails, or goes idle — e.g. refetch plans (content) or refresh graph (research). */
  onManusSyncSettled?: (detail: { kind: 'completed' | 'failed' | 'idle' }) => void;
  /** Content workspace: active plan id so Manus plan tasks merge into this plan. */
  contentPlanId?: string | null;
}

const MANUS_BACKGROUND_POLL_MS = 30_000;

export function ChatInterface({
  apiEndpoint,
  chatId,
  initialMessages,
  rootCompanyId,
  prefillMessage,
  prefillRevision,
  manusBackgroundSync,
  onManusSyncSettled,
  contentPlanId,
}: ChatInterfaceProps) {
  const { apiKey } = useManusApiKey();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: apiEndpoint,
        body: {
          ...(chatId ? { chatId } : {}),
          ...(rootCompanyId ? { rootCompanyId } : {}),
          ...(contentPlanId ? { contentPlanId } : {}),
        },
        headers: () => ({
          ...manusKeyHeaders(apiKey),
        }),
      }),
    [apiEndpoint, chatId, rootCompanyId, contentPlanId, apiKey]
  );

  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
  });

  const [manusPolling, setManusPolling] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncBanner, setSyncBanner] = useState<string | null>(null);
  const prevStatusRef = useRef(status);

  const syncBase =
    manusBackgroundSync === 'research' || manusBackgroundSync === 'content'
      ? `/api/chat/${manusBackgroundSync}`
      : null;

  const runManusSync = useCallback(
    async (opts?: { fromManual?: boolean }) => {
      if (!chatId || !rootCompanyId || !syncBase) return;
      if (opts?.fromManual) {
        setSyncBusy(true);
        setSyncBanner(null);
      }
      try {
        const res = await fetch(`${syncBase}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...manusKeyHeaders(apiKey) },
          body: JSON.stringify({ chatId, rootCompanyId }),
        });
        const data = (await res.json()) as {
          status: string;
          messages?: UIMessage[];
          error?: string;
        };
        if (!res.ok) {
          setManusPolling(false);
          if (opts?.fromManual) {
            setSyncBanner(data.error || `Sync failed (${res.status}).`);
          }
          onManusSyncSettled?.({ kind: 'failed' });
          return;
        }
        if (data.status === 'completed') {
          if (data.messages) setMessages(data.messages);
          setManusPolling(false);
          if (opts?.fromManual) setSyncBanner('Synced — task finished.');
          onManusSyncSettled?.({ kind: 'completed' });
        } else if (data.status === 'failed') {
          if (data.messages) setMessages(data.messages);
          setManusPolling(false);
          if (opts?.fromManual) setSyncBanner('Task reported failure (see chat).');
          onManusSyncSettled?.({ kind: 'failed' });
        } else if (data.status === 'idle') {
          setManusPolling(false);
          if (opts?.fromManual) setSyncBanner('Nothing to sync — no running Manus task for this chat.');
          onManusSyncSettled?.({ kind: 'idle' });
        } else if (data.status === 'running') {
          setManusPolling(true);
          if (opts?.fromManual) {
            setSyncBanner('Checked — task still running. Results will appear when it finishes.');
          }
        }
      } catch {
        setManusPolling(false);
        if (opts?.fromManual) setSyncBanner('Sync failed (network error).');
        onManusSyncSettled?.({ kind: 'failed' });
      } finally {
        if (opts?.fromManual) setSyncBusy(false);
      }
    },
    [chatId, rootCompanyId, syncBase, setMessages, onManusSyncSettled, apiKey]
  );

  useEffect(() => {
    if (!syncBase || !chatId || !rootCompanyId) return;
    let cancelled = false;
    (async () => {
      const r = await fetch(
        `${syncBase}/pending?chatId=${encodeURIComponent(chatId)}&companyId=${encodeURIComponent(rootCompanyId)}`,
        { headers: { ...manusKeyHeaders(apiKey) } }
      );
      const j = (await r.json()) as { pending?: boolean };
      if (cancelled || !j.pending) return;
      setManusPolling(true);
      runManusSync(undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId, rootCompanyId, syncBase, runManusSync, apiKey]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (!syncBase || !chatId || !rootCompanyId) return;
    const wasActive = prev === 'streaming' || prev === 'submitted';
    if (!wasActive || status !== 'ready') return;
    (async () => {
      const r = await fetch(
        `${syncBase}/pending?chatId=${encodeURIComponent(chatId)}&companyId=${encodeURIComponent(rootCompanyId)}`,
        { headers: { ...manusKeyHeaders(apiKey) } }
      );
      const j = (await r.json()) as { pending?: boolean };
      if (j.pending) {
        setManusPolling(true);
        runManusSync(undefined);
      }
    })();
  }, [status, chatId, rootCompanyId, syncBase, runManusSync, apiKey]);

  useEffect(() => {
    if (!manusPolling) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') runManusSync(undefined);
    }, MANUS_BACKGROUND_POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') runManusSync(undefined);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [manusPolling, runManusSync]);

  const onManualSync = useCallback(async () => {
    if (!syncBase || !chatId || !rootCompanyId) return;
    const r = await fetch(
      `${syncBase}/pending?chatId=${encodeURIComponent(chatId)}&companyId=${encodeURIComponent(rootCompanyId)}`,
      { headers: { ...manusKeyHeaders(apiKey) } }
    );
    const j = (await r.json()) as { pending?: boolean };
    if (j.pending) setManusPolling(true);
    await runManusSync({ fromManual: true });
  }, [syncBase, chatId, rootCompanyId, runManusSync, apiKey]);

  const streamLoading = status === 'streaming' || status === 'submitted';
  const isLoading = streamLoading || manusPolling;

  const backgroundLabel =
    manusBackgroundSync === 'research'
      ? 'Research running in background…'
      : manusBackgroundSync === 'content'
        ? 'Content task running in background…'
        : '';

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} />

      {status === 'error' && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 text-xs text-destructive">
          Error: {error?.message || 'Something went wrong'}
        </div>
      )}

      {streamLoading && (
        <div className="flex items-center justify-center gap-3 py-2 border-t bg-muted/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {status === 'submitted' ? 'Sending...' : 'Agent working...'}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => stop()}
            className="h-6 text-[10px] gap-1 text-destructive hover:text-destructive"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            Stop
          </Button>
        </div>
      )}

      {manusBackgroundSync && chatId && rootCompanyId && !streamLoading && (
        <div className="flex flex-col gap-1.5 px-3 py-2 border-t bg-muted/15 text-[10px] text-muted-foreground">
          {syncBanner && (
            <div className="rounded border border-border/80 bg-background/80 px-2 py-1.5 text-foreground">
              {syncBanner}
            </div>
          )}
          <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 pt-0.5">
            {manusPolling && (
              <span className="relative flex h-2 w-2 shrink-0 mt-0.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
            )}
            <span className="leading-snug">
              {manusPolling ? (
                <>
                  <span className="font-medium text-foreground">{backgroundLabel}</span>{' '}
                  Auto-check every {MANUS_BACKGROUND_POLL_MS / 1000}s while this tab is visible.
                </>
              ) : (
                <>Manus tasks complete in the background. Sync now checks status immediately.</>
              )}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[10px] px-2 shrink-0"
            title="Check Manus task status now"
            disabled={syncBusy}
            onClick={() => void onManualSync()}
          >
            {syncBusy ? 'Syncing…' : 'Sync now'}
          </Button>
          </div>
        </div>
      )}

      <MessageInput
        onSend={(text) => sendMessage({ text })}
        isLoading={isLoading}
        defaultValue={prefillMessage}
        applyRevision={prefillRevision}
      />
    </div>
  );
}
