'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCompany } from '@/lib/company-context';
import { PipelineBoard } from '@/components/pipeline-board';
import { ItemDetailPanel } from '@/components/item-detail-panel';
import { ChatInterface } from '@/components/chat-interface';
import { VoiceRecorder } from '@/components/voice-recorder';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PlanItemData } from '@/components/pipeline-card';

interface PlanData {
  _id: string;
  title: string;
  status: 'draft' | 'active' | 'completed';
  items: PlanItemData[];
  createdAt: string;
}

export default function ContentPage() {
  const { activeCompany } = useCompany();
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PlanItemData | null>(null);
  const [chatId, setChatId] = useState(() => crypto.randomUUID());
  const [chatPrefill, setChatPrefill] = useState('');
  const [prefillRevision, setPrefillRevision] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);
  const [platformTab, setPlatformTab] = useState<string>('all');
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const autoPlanCreatedFor = useRef<string | null>(null);

  const activePlan = plans.find((p) => p._id === activePlanId) ?? null;

  const fetchPlans = useCallback(async () => {
    if (!activeCompany?._id) return;
    const res = await fetch(`/api/plans?companyId=${activeCompany._id}`);
    const data = await res.json();
    setPlans(data.plans || []);
  }, [activeCompany?._id]);

  useEffect(() => {
    setPlans([]);
    setActivePlanId(null);
    setSelectedItem(null);
    setChatId(crypto.randomUUID());
    autoPlanCreatedFor.current = null;
    setDraftNote(null);
  }, [activeCompany?._id]);

  /** Ensure at least one plan exists so the pipeline and Generate drafts have a target. */
  useEffect(() => {
    if (!activeCompany?._id || plans.length > 0) return;
    if (autoPlanCreatedFor.current === activeCompany._id) return;
    let cancelled = false;
    (async () => {
      await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: activeCompany._id, title: 'Content pipeline' }),
      });
      if (!cancelled) {
        await fetchPlans();
        autoPlanCreatedFor.current = activeCompany._id;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCompany?._id, plans.length, fetchPlans]);

  const prevPlanCount = useRef<number | null>(null);
  useEffect(() => {
    if (prevPlanCount.current !== null && prevPlanCount.current > 0 && plans.length === 0) {
      autoPlanCreatedFor.current = null;
    }
    prevPlanCount.current = plans.length;
  }, [plans.length]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    if (plans.length > 0 && !activePlanId) {
      setActivePlanId(plans[0]._id);
    }
    if (plans.length === 0) {
      setActivePlanId(null);
    }
  }, [plans, activePlanId]);

  useEffect(() => {
    const interval = setInterval(fetchPlans, 12000);
    return () => clearInterval(interval);
  }, [fetchPlans]);

  const handleApprove = async (itemId: string) => {
    if (!activePlan) return;
    await fetch(`/api/plans/${activePlan._id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planItemId: itemId, decision: 'approved' }),
    });
    await fetchPlans();
  };

  const handleReject = async (itemId: string) => {
    if (!activePlan) return;
    await fetch(`/api/plans/${activePlan._id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planItemId: itemId, decision: 'rejected' }),
    });
    await fetchPlans();
  };

  const handleDeletePlan = async (planId: string) => {
    await fetch(`/api/plans/${planId}`, { method: 'DELETE' });
    setPlans((prev) => prev.filter((p) => p._id !== planId));
    if (activePlanId === planId) {
      setActivePlanId(plans.find((p) => p._id !== planId)?._id ?? null);
    }
  };

  const filteredItems =
    activePlan && platformTab === 'all'
      ? activePlan.items
      : activePlan
        ? activePlan.items.filter((i) => (i.platform || 'other') === platformTab)
        : [];

  if (!activeCompany) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">Add a company to use the content workspace.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <div className="w-52 border-r flex flex-col shrink-0 bg-muted/5">
        <div className="px-2 py-2 border-b">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1.5">
            Content plans
          </p>
          <Button
            size="sm"
            className="w-full text-xs h-8 mb-2 clay-hover"
            variant="secondary"
            onClick={async () => {
              await fetch('/api/plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  companyId: activeCompany._id,
                  title: `Plan ${new Date().toLocaleDateString()}`,
                }),
              });
              await fetchPlans();
            }}
          >
            New plan
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1.5 space-y-0.5">
            {plans.length === 0 && (
              <div className="px-2 py-6 text-center text-[11px] text-muted-foreground">
                No plans yet. Create one or ask the agent for a content plan.
              </div>
            )}
            {plans.map((plan) => (
              <div key={plan._id} className="group relative">
                <button
                  type="button"
                  onClick={() => setActivePlanId(plan._id)}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-colors clay ${
                    activePlanId === plan._id
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-medium">{plan.title}</span>
                    <Badge
                      className={`text-[9px] shrink-0 ${
                        plan.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : plan.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {plan.status}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {plan.items.length} items
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePlan(plan._id);
                  }}
                  className="absolute right-1 top-1 hidden group-hover:block p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="Delete plan"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {activePlan ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b gap-2 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold">{activePlan.title}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {activePlan.items.length} items ·{' '}
                  {activePlan.items.filter((i) => i.status === 'planned').length} planned ·{' '}
                  {activePlan.items.filter((i) => i.status === 'approved').length} approved
                </p>
                {draftNote && (
                  <p className="text-[10px] text-muted-foreground mt-1 max-w-md">{draftNote}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs"
                  disabled={draftBusy || activePlan.items.filter((i) => i.status === 'planned').length === 0}
                  onClick={async () => {
                    setDraftBusy(true);
                    setDraftNote(null);
                    try {
                      const res = await fetch(`/api/plans/${activePlan._id}/activate`, { method: 'POST' });
                      const data = (await res.json()) as { error?: string; message?: string; generated?: string[] };
                      if (!res.ok) {
                        setDraftNote(data.error || `Failed (${res.status})`);
                        return;
                      }
                      setDraftNote(data.message || `Generated ${data.generated?.length ?? 0} draft(s).`);
                      await fetchPlans();
                    } catch {
                      setDraftNote('Network error — try again.');
                    } finally {
                      setDraftBusy(false);
                    }
                  }}
                >
                  {draftBusy ? 'Generating…' : 'Generate drafts'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => setChatOpen((p) => !p)}
                  title={chatOpen ? 'Hide session' : 'Show session'}
                >
                  💬
                </Button>
              </div>
            </div>
            <Tabs value={platformTab} onValueChange={setPlatformTab} className="px-4 pt-2">
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-[10px] px-2">
                  All
                </TabsTrigger>
                <TabsTrigger value="linkedin" className="text-[10px] px-2">
                  LinkedIn
                </TabsTrigger>
                <TabsTrigger value="instagram" className="text-[10px] px-2">
                  Instagram
                </TabsTrigger>
                <TabsTrigger value="blog" className="text-[10px] px-2">
                  Blog
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex-1 overflow-hidden min-h-0">
              <PipelineBoard
                items={filteredItems}
                planId={activePlan._id}
                onCardClick={(item) => setSelectedItem(item)}
                onItemMoved={() => fetchPlans()}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3 max-w-sm">
              <h3 className="text-sm font-medium">Content pipeline</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Create a plan or ask the agent to propose topics. Then run **Generate drafts** to call
                Manus for each planned item.
              </p>
            </div>
          </div>
        )}
      </div>

      {chatOpen && (
        <div className="w-[380px] border-l flex flex-col shrink-0 min-h-0 bg-muted/5">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-xs font-semibold">Content agent</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px]"
              onClick={() => setChatId(crypto.randomUUID())}
            >
              New session
            </Button>
          </div>
          <div className="px-2 py-2 border-b">
            <VoiceRecorder
              companyId={activeCompany._id}
              activePlanId={activePlanId}
              onInsertChat={(text) => {
                setChatPrefill(text);
                setPrefillRevision((n) => n + 1);
              }}
              onPlanUpdated={() => void fetchPlans()}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatInterface
              key={`${chatId}-${activePlanId ?? 'p'}`}
              apiEndpoint="/api/chat/content"
              chatId={chatId}
              rootCompanyId={activeCompany._id}
              contentPlanId={activePlanId}
              prefillMessage={chatPrefill}
              prefillRevision={prefillRevision}
              manusBackgroundSync="content"
              onManusSyncSettled={(d) => {
                if (d.kind === 'completed') fetchPlans();
              }}
            />
          </div>
        </div>
      )}

      {selectedItem && activePlan && (
        <ItemDetailPanel
          item={selectedItem}
          planId={activePlan._id}
          onClose={() => setSelectedItem(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
