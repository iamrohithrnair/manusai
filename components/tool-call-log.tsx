'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  scrapeCompanyProfile: { label: 'Scraping company profile', icon: '🏢' },
  scrapeCompanyEmployees: { label: 'Finding employees', icon: '👥' },
  scrapeEmployeeProfile: { label: 'Scraping employee profile', icon: '👤' },
  analyzeContentStrategy: { label: 'Analyzing content strategy', icon: '📊' },
  searchWeb: { label: 'Searching the web', icon: '🔍' },
  saveCompany: { label: 'Saving company data', icon: '💾' },
  saveEmployee: { label: 'Saving employee data', icon: '💾' },
  saveContentAnalysis: { label: 'Saving content analysis', icon: '💾' },
  saveResearchNode: { label: 'Saving to knowledge graph', icon: '🧠' },
  addNodeEdge: { label: 'Linking nodes', icon: '🔗' },
  getResearchNode: { label: 'Reading node', icon: '📖' },
  listResearchNodes: { label: 'Listing nodes', icon: '📋' },
  getCompanies: { label: 'Loading companies', icon: '📋' },
  getEmployees: { label: 'Loading employees', icon: '📋' },
  getContentAnalysis: { label: 'Loading analysis', icon: '📋' },
  getEmployeeProfile: { label: 'Loading employee profile', icon: '👤' },
  getCompetitorInsights: { label: 'Loading competitor insights', icon: '📊' },
  createRecordingRequest: { label: 'Creating recording request', icon: '🎙️' },
  transcribeAudio: { label: 'Transcribing audio', icon: '🎧' },
  generateContentIdeas: { label: 'Generating content ideas', icon: '💡' },
  writePost: { label: 'Writing LinkedIn post', icon: '✍️' },
  generateCarouselSlide: { label: 'Generating carousel slide', icon: '🖼️' },
  assembleCarousel: { label: 'Assembling carousel PDF', icon: '📑' },
  savePost: { label: 'Saving post', icon: '💾' },
};

interface ToolCallLogProps {
  toolName: string;
  state: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
  stepNumber?: number;
}

export function ToolCallLog({ toolName, state, input, output, errorText, stepNumber }: ToolCallLogProps) {
  const [expanded, setExpanded] = useState(false);
  const config = TOOL_LABELS[toolName] || { label: toolName, icon: '⚙️' };

  const isRunning = state === 'input-streaming' || state === 'input-available';
  const isDone = state === 'output-available';
  const isError = state === 'output-error';

  return (
    <div className={cn(
      'my-1.5 rounded-lg border text-xs transition-all',
      isRunning && 'border-primary/30 bg-primary/5',
      isDone && 'border-border bg-muted/30',
      isError && 'border-destructive/30 bg-destructive/5',
    )}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        {/* Status indicator */}
        {isRunning && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        )}
        {isDone && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-600 shrink-0">
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {isError && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-destructive shrink-0">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}

        {/* Step badge */}
        {stepNumber != null && (
          <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded shrink-0">
            #{stepNumber}
          </span>
        )}

        {/* Icon + label */}
        <span className="shrink-0">{config.icon}</span>
        <span className={cn(
          'font-medium flex-1',
          isRunning && 'text-primary',
          isDone && 'text-muted-foreground',
          isError && 'text-destructive',
        )}>
          {config.label}
          {isRunning && <span className="animate-pulse">...</span>}
        </span>

        {/* Expand chevron */}
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={cn('text-muted-foreground transition-transform shrink-0', expanded && 'rotate-180')}
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-2.5 space-y-2 border-t border-border/50">
          {/* Input */}
          {input && Object.keys(input).length > 0 && (
            <div className="pt-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Input</div>
              <pre className="text-[11px] font-mono bg-background/50 rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
                {formatInput(input)}
              </pre>
            </div>
          )}

          {/* Output */}
          {isDone && output && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Output</div>
              <pre className="text-[11px] font-mono bg-background/50 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">
                {formatOutput(output)}
              </pre>
            </div>
          )}

          {/* Error */}
          {isError && errorText && (
            <div className="pt-2 text-destructive">
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1">Error</div>
              <pre className="text-[11px] font-mono bg-destructive/10 rounded p-2">{errorText}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatInput(input: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      lines.push(`${key}: ${value.length > 100 ? value.slice(0, 100) + '...' : value}`);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      lines.push(`${key}: [${value.length} items]`);
    } else {
      lines.push(`${key}: ${JSON.stringify(value, null, 2)}`);
    }
  }
  return lines.join('\n');
}

function formatOutput(output: Record<string, unknown>): string {
  // Show message first if present
  if (output.message) return String(output.message);
  if (output.error) return `Error: ${output.error}`;

  // Summarize known output shapes
  if (output.company) return `Company: ${JSON.stringify(output.company, null, 2).slice(0, 300)}`;
  if (output.employees && Array.isArray(output.employees)) return `${output.employees.length} employees found`;
  if (output.profile) return `Profile: ${JSON.stringify(output.profile, null, 2).slice(0, 300)}`;
  if (output.analysis) return String(output.analysis).slice(0, 300);
  if (output.node) return `Node: ${(output.node as Record<string, unknown>).name || 'unnamed'}`;
  if (output.nodes && Array.isArray(output.nodes)) return `${output.nodes.length} nodes`;
  if (output.post) return String(output.post).slice(0, 200);
  if (output.ideas) return String(output.ideas).slice(0, 300);
  if (output.transcript) return String(output.transcript).slice(0, 200);

  return JSON.stringify(output, null, 2).slice(0, 400);
}
