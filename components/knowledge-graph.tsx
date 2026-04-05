'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { GraphCanvas, GraphCanvasRef, useSelection } from 'reagraph';
import type { GraphNode, GraphEdge } from 'reagraph';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ApiNode {
  _id: string;
  name: string;
  nodeType: string;
  isOurCompany?: boolean;
  metadata?: Record<string, unknown>;
  edges?: { target?: { _id: string; name: string; nodeType: string } | string; type: string }[];
  updatedAt: string;
}

const NODE_COLORS: Record<string, string> = {
  company: '#3DB4AD',
  competitor: '#E87461',
  employee: '#F5A623',
  content_strategy: '#8B5CF6',
  post: '#84A98C',
};

const NODE_SIZES: Record<string, number> = {
  company: 14,
  competitor: 11,
  employee: 7,
  content_strategy: 8,
  post: 5,
};

interface KnowledgeGraphProps {
  companyId?: string;
  onNodeClick?: (nodeId: string) => void;
  fullScreen?: boolean;
  onToggleFullScreen?: () => void;
  /** Increment (e.g. after research sync completes) to refetch nodes without remounting. */
  refreshSignal?: number;
}

export function KnowledgeGraph({
  companyId,
  onNodeClick,
  fullScreen,
  onToggleFullScreen,
  refreshSignal = 0,
}: KnowledgeGraphProps) {
  const [apiNodes, setApiNodes] = useState<ApiNode[]>([]);
  const graphRef = useRef<GraphCanvasRef | null>(null);

  const fetchNodes = useCallback(async () => {
    const url = companyId ? `/api/research-docs?companyId=${companyId}` : '/api/research-docs';
    const res = await fetch(url);
    const data = await res.json();
    setApiNodes(data.nodes || []);
  }, [companyId]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes, refreshSignal]);

  // Poll for new nodes every 10s
  useEffect(() => {
    const interval = setInterval(fetchNodes, 10000);
    return () => clearInterval(interval);
  }, [fetchNodes]);

  // Convert API nodes to Reagraph format
  const graphNodes: GraphNode[] = apiNodes.map(n => ({
    id: n._id,
    label: n.name,
    fill: NODE_COLORS[n.nodeType] || '#6b7280',
    size: NODE_SIZES[n.nodeType] || 5,
    data: { nodeType: n.nodeType, isOurCompany: n.isOurCompany },
  }));

  const graphEdges: GraphEdge[] = [];
  const seenEdges = new Set<string>();
  for (const node of apiNodes) {
    for (const edge of node.edges || []) {
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target?._id;
      if (!targetId) continue;
      const edgeKey = `${node._id}-${targetId}-${edge.type}`;
      if (seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);
      // Only add edge if target node exists in our data
      if (apiNodes.some(n => n._id === targetId)) {
        graphEdges.push({
          id: edgeKey,
          source: node._id,
          target: targetId,
          label: edge.type.replace(/_/g, ' '),
        });
      }
    }
  }

  const {
    selections,
    actives,
    onNodeClick: handleSelectionClick,
    onCanvasClick,
  } = useSelection({
    ref: graphRef,
    nodes: graphNodes,
    edges: graphEdges,
    pathSelectionType: 'all',
  });

  const handleNodeClick = useCallback((node: GraphNode) => {
    handleSelectionClick?.(node);
    onNodeClick?.(node.id);
  }, [handleSelectionClick, onNodeClick]);

  if (graphNodes.length === 0) {
    return (
      <div className={cn(
        'flex items-center justify-center bg-muted/20',
        fullScreen ? 'fixed inset-0 z-50' : 'h-full'
      )}>
        <div className="text-center space-y-2 p-6">
          <div className="text-2xl">🕸️</div>
          <p className="text-xs text-muted-foreground">Knowledge graph is empty.</p>
          <p className="text-[10px] text-muted-foreground">Add a company to start building your research graph.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'relative',
      fullScreen ? 'fixed inset-0 z-50 bg-background' : 'h-full'
    )}>
      {/* Top bar — stack vertically in sidebar, horizontal in full screen */}
      <div className={cn(
        'absolute z-10 pointer-events-none',
        fullScreen ? 'top-3 left-3 right-3 flex items-center justify-between' : 'top-2 left-2 right-2 space-y-1.5'
      )}>
        <div className="pointer-events-auto flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-[9px] gap-1 px-1.5 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />{apiNodes.filter(n => n.nodeType === 'company').length} co.
          </Badge>
          <Badge variant="secondary" className="text-[9px] gap-1 px-1.5 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />{apiNodes.filter(n => n.nodeType === 'competitor').length} comp.
          </Badge>
          <Badge variant="secondary" className="text-[9px] gap-1 px-1.5 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />{apiNodes.filter(n => n.nodeType === 'employee').length} people
          </Badge>
          <Badge variant="secondary" className="text-[9px] gap-1 px-1.5 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-pink-500 shrink-0" />{apiNodes.filter(n => n.nodeType === 'post').length} posts
          </Badge>
        </div>
        <div className="pointer-events-auto">
          {onToggleFullScreen && (
            <Button variant="outline" size="sm" className="h-6 text-[9px] gap-1 px-2" onClick={onToggleFullScreen}>
              {fullScreen ? 'Exit' : '⛶'}
            </Button>
          )}
        </div>
      </div>

      <GraphCanvas
        ref={graphRef}
        nodes={graphNodes}
        edges={graphEdges}
        selections={selections}
        actives={actives}
        onNodeClick={handleNodeClick}
        onCanvasClick={onCanvasClick}
        animated
        edgeArrowPosition="end"
        labelType="all"
        sizingType="default"
        cameraMode={fullScreen ? 'rotate' : 'pan'}
      />
    </div>
  );
}
