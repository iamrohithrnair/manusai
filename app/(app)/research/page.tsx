'use client';

import { useState, useEffect, useCallback } from 'react';
import type { UIMessage } from 'ai';
import { ChatInterface } from '@/components/chat-interface';
import { SessionList } from '@/components/session-list';
import { KnowledgeGraph } from '@/components/knowledge-graph';
import { NodeDetailModal } from '@/components/node-detail-modal';
import { useCompany } from '@/lib/company-context';
import { buildResearchAutofillPrompt } from '@/lib/research-autofill-prompt';

export default function ResearchPage() {
  const { activeCompany } = useCompany();
  const [chatId, setChatId] = useState<string>(() => crypto.randomUUID());
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [graphFullScreen, setGraphFullScreen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [prefill, setPrefill] = useState<string | undefined>();
  /** Bumped to force the composer to re-apply `prefill` in the same session (Insert template). */
  const [prefillRevision, setPrefillRevision] = useState(0);
  const [graphRefreshSignal, setGraphRefreshSignal] = useState(0);

  const loadState = useCallback(async () => {
    if (!activeCompany) {
      setLoaded(true);
      return;
    }

    const chatsRes = await fetch(`/api/chats?agentType=research&companyId=${activeCompany._id}`);
    const chatsData = await chatsRes.json();
    const existingChats = chatsData.items || [];

    if (existingChats.length > 0) {
      const latestChat = existingChats[0];
      const chatRes = await fetch(`/api/chats/${latestChat._id}`);
      const chatData = await chatRes.json();
      setInitialMessages(chatData.messages || []);
      setChatId(latestChat._id);
      setPrefill(undefined);
      setPrefillRevision(0);
    } else {
      setPrefill(buildResearchAutofillPrompt(activeCompany));
      setInitialMessages([]);
      setChatId(crypto.randomUUID());
      setPrefillRevision(0);
    }

    setLoaded(true);
  }, [activeCompany]);

  useEffect(() => {
    setLoaded(false);
    loadState();
  }, [loadState]);

  const handleSessionSelect = async (id: string) => {
    const res = await fetch(`/api/chats/${id}`);
    const data = await res.json();
    setInitialMessages(data.messages || []);
    setPrefill(undefined);
    setPrefillRevision(0);
    setChatId(id);
  };

  const handleNewSession = () => {
    setInitialMessages([]);
    setPrefill(undefined);
    setPrefillRevision(0);
    setChatId(crypto.randomUUID());
  };

  const handleNewSessionWithTemplate = () => {
    if (!activeCompany) return;
    setInitialMessages([]);
    setPrefill(buildResearchAutofillPrompt(activeCompany));
    setPrefillRevision(0);
    setChatId(crypto.randomUUID());
  };

  const handleInsertTemplatePrompt = () => {
    if (!activeCompany) return;
    setPrefill(buildResearchAutofillPrompt(activeCompany));
    setPrefillRevision((n) => n + 1);
  };

  const handleActiveSessionDeleted = useCallback(async () => {
    const startFresh = () => {
      setInitialMessages([]);
      setChatId(crypto.randomUUID());
      setPrefillRevision(0);
      if (activeCompany) {
        setPrefill(buildResearchAutofillPrompt(activeCompany));
      } else {
        setPrefill(undefined);
      }
    };
    if (!activeCompany) {
      startFresh();
      return;
    }
    const chatsRes = await fetch(`/api/chats?agentType=research&companyId=${activeCompany._id}`);
    const chatsData = await chatsRes.json();
    const remaining = chatsData.items || [];
    if (remaining.length > 0) {
      const id = remaining[0]._id as string;
      const res = await fetch(`/api/chats/${id}`);
      const data = await res.json();
      setInitialMessages(data.messages || []);
      setPrefill(undefined);
      setPrefillRevision(0);
      setChatId(id);
    } else {
      startFresh();
    }
  }, [activeCompany]);

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <SessionList
        agentType="research"
        activeSessionId={chatId}
        companyId={activeCompany?._id}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
        onActiveSessionDeleted={handleActiveSessionDeleted}
        onNewSessionWithTemplate={activeCompany ? handleNewSessionWithTemplate : undefined}
        onInsertTemplatePrompt={activeCompany ? handleInsertTemplatePrompt : undefined}
      />

      <div className="w-96 border-r flex flex-col h-full bg-muted/10 min-h-0">
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Knowledge graph
          </span>
        </div>
        <div className="flex-1 relative min-h-0">
          <KnowledgeGraph
            companyId={activeCompany?._id}
            refreshSignal={graphRefreshSignal}
            onNodeClick={(id) => setSelectedNodeId(id)}
            onToggleFullScreen={() => setGraphFullScreen(!graphFullScreen)}
          />
        </div>
      </div>

      <div className="flex-1 min-w-0 min-h-0">
        <ChatInterface
          key={chatId}
          apiEndpoint="/api/chat/research"
          chatId={chatId}
          initialMessages={initialMessages}
          rootCompanyId={activeCompany?._id}
          prefillMessage={prefill}
          prefillRevision={prefillRevision}
          manusBackgroundSync="research"
          onManusSyncSettled={(d) => {
            if (d.kind === 'completed') setGraphRefreshSignal((n) => n + 1);
          }}
        />
      </div>

      {graphFullScreen && (
        <KnowledgeGraph
          companyId={activeCompany?._id}
          refreshSignal={graphRefreshSignal}
          onNodeClick={(id) => {
            setSelectedNodeId(id);
            setGraphFullScreen(false);
          }}
          fullScreen
          onToggleFullScreen={() => setGraphFullScreen(false)}
        />
      )}

      <NodeDetailModal
        nodeId={selectedNodeId}
        onClose={() => setSelectedNodeId(null)}
        onNavigateToNode={(id) => setSelectedNodeId(id)}
      />
    </div>
  );
}
