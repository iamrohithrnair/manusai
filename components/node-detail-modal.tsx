'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Edge {
  target?: { _id: string; name: string; nodeType: string; metadata?: { linkedinUrl?: string } };
  type: string;
  label?: string;
}

interface NodeDetail {
  _id: string;
  name: string;
  nodeType: string;
  content: string;
  isOurCompany: boolean;
  metadata: Record<string, unknown>;
  edges: Edge[];
  createdAt: string;
  updatedAt: string;
}

interface NodeDetailModalProps {
  nodeId: string | null;
  onClose: () => void;
  onNavigateToNode?: (nodeId: string) => void;
}

const NODE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  company: { label: 'Company', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  competitor: { label: 'Competitor', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  employee: { label: 'Person', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  content_strategy: { label: 'Strategy', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  post: { label: 'Post', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
};

const EDGE_TYPE_LABELS: Record<string, string> = {
  competitor_of: 'Competes with',
  has_employee: 'Has employee',
  works_at: 'Works at',
  has_strategy: 'Content strategy',
  authored: 'Authored by',
  related_to: 'Related to',
};

export function NodeDetailModal({ nodeId, onClose, onNavigateToNode }: NodeDetailModalProps) {
  const [node, setNode] = useState<NodeDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!nodeId) { setNode(null); return; }
    setLoading(true);
    fetch(`/api/research-docs/${nodeId}`)
      .then(r => r.json())
      .then(data => { setNode(data.node || null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [nodeId]);

  const typeConfig = node ? NODE_TYPE_LABELS[node.nodeType] || { label: node.nodeType, color: 'bg-muted text-muted-foreground' } : null;

  return (
    <Dialog open={!!nodeId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="!max-w-5xl !w-[95vw] max-h-[90vh] p-0 gap-0 overflow-hidden">
        {loading && (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        )}
        {node && !loading && (
          <>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{node.name}</h2>
                    {node.isOurCompany && (
                      <Badge variant="outline" className="text-[10px]">Your company</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {typeConfig && (
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${typeConfig.color}`}>
                        {typeConfig.label}
                      </span>
                    )}
                    {node.metadata?.industry != null && (
                      <span className="text-xs text-muted-foreground">{String(node.metadata.industry)}</span>
                    )}
                    {node.metadata?.title != null && (
                      <span className="text-xs text-muted-foreground">{String(node.metadata.title)}</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Metadata pills */}
              <div className="flex flex-wrap gap-2 mt-3">
                {node.metadata?.linkedinUrl != null && (
                  <a
                    href={String(node.metadata.linkedinUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    LinkedIn ↗
                  </a>
                )}
                {node.metadata?.followerCount != null && (
                  <span className="text-[11px] text-muted-foreground">
                    {Number(node.metadata.followerCount).toLocaleString()} followers
                  </span>
                )}
                {node.metadata?.size != null && (
                  <span className="text-[11px] text-muted-foreground">{String(node.metadata.size)}</span>
                )}
              </div>
            </div>

            <ScrollArea className="max-h-[70vh]">
              <div className="px-6 py-4 space-y-4">
                {/* Content */}
                {node.content && (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{node.content}</ReactMarkdown>
                  </div>
                )}

                {/* Connections */}
                {node.edges.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Connections ({node.edges.length})
                      </h3>
                      <div className="space-y-1.5">
                        {node.edges.map((edge, i) => {
                          const edgeLabel = EDGE_TYPE_LABELS[edge.type] || edge.type;
                          const targetTypeConfig = edge.target?.nodeType
                            ? NODE_TYPE_LABELS[edge.target.nodeType]
                            : null;
                          return (
                            <button
                              key={i}
                              onClick={() => edge.target?._id && onNavigateToNode?.(edge.target._id)}
                              className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                            >
                              <span className="text-[10px] text-muted-foreground w-24 shrink-0">{edgeLabel}</span>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {targetTypeConfig && (
                                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${targetTypeConfig.color}`}>
                                    {targetTypeConfig.label}
                                  </span>
                                )}
                                <span className="text-sm truncate">{edge.target?.name || 'Unknown'}</span>
                              </div>
                              <span className="text-muted-foreground text-xs shrink-0">→</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="px-6 py-3 border-t bg-muted/30 text-[10px] text-muted-foreground">
              Updated {new Date(node.updatedAt).toLocaleString()}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
