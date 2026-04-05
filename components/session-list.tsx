'use client';

import { useEffect, useState, useCallback, type MouseEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Session {
  _id: string;
  preview: string;
  updatedAt: string;
}

interface SessionListProps {
  agentType: 'research' | 'content';
  activeSessionId: string | null;
  companyId?: string;
  onSessionSelect: (id: string) => void;
  onNewSession: () => void;
  /** Called after the active session was deleted (list already refreshed). Parent should open another session or start fresh. */
  onActiveSessionDeleted?: () => void | Promise<void>;
  /** Research: start a new session with the workspace template prompt in the composer. */
  onNewSessionWithTemplate?: () => void;
  /** Research: put the template prompt in the composer without changing the session. */
  onInsertTemplatePrompt?: () => void;
}

export function SessionList({
  agentType,
  activeSessionId,
  companyId,
  onSessionSelect,
  onNewSession,
  onActiveSessionDeleted,
  onNewSessionWithTemplate,
  onInsertTemplatePrompt,
}: SessionListProps) {
  const [sessions, setSessions] = useState<Session[]>([]);

  const fetchSessions = useCallback(async () => {
    let url = `/api/chats?agentType=${agentType}`;
    if (companyId) url += `&companyId=${companyId}`;
    const res = await fetch(url);
    const data = await res.json();
    setSessions(data.items || []);
  }, [agentType, companyId]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Poll every 15s to pick up new sessions
  useEffect(() => {
    const interval = setInterval(fetchSessions, 15000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleDelete = async (e: MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm('Delete this session? This cannot be undone.')) return;
    const res = await fetch(`/api/chats/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      window.alert('Failed to delete session.');
      return;
    }
    await fetchSessions();
    if (activeSessionId === id) {
      await onActiveSessionDeleted?.();
    }
  };

  return (
    <div className="w-52 border-r flex flex-col h-full">
      <div className="p-2 border-b space-y-1.5">
        <Button onClick={onNewSession} variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" /><path d="M5 12h14" />
          </svg>
          New session
        </Button>
        {agentType === 'research' && companyId && onNewSessionWithTemplate && (
          <Button
            onClick={onNewSessionWithTemplate}
            variant="secondary"
            size="sm"
            className="w-full h-8 text-[11px] gap-1 leading-tight px-2"
            title="Creates a new session and fills the input with the default research prompt for this company"
          >
            New session + template
          </Button>
        )}
        {agentType === 'research' && companyId && onInsertTemplatePrompt && (
          <button
            type="button"
            onClick={onInsertTemplatePrompt}
            className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline py-0.5"
          >
            Insert template in composer
          </button>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {sessions.length === 0 && (
            <div className="px-2 py-6 text-center text-[11px] text-muted-foreground">
              No sessions yet
            </div>
          )}
          {sessions.map((session) => (
            <div key={session._id} className="group relative flex gap-0.5 items-stretch">
              <button
                type="button"
                onClick={() => onSessionSelect(session._id)}
                className={cn(
                  'flex-1 min-w-0 text-left px-2.5 py-2 rounded-lg text-xs transition-colors',
                  activeSessionId === session._id
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <div className="truncate leading-relaxed pr-6">{session.preview}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {new Date(session.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(e, session._id)}
                className="absolute right-1 top-1.5 p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus:opacity-100 focus:outline-none"
                title="Delete session"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
