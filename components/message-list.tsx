'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { isToolUIPart, getToolName } from 'ai';
import type { UIMessage, UIMessagePart, UIDataTypes, UITools } from 'ai';
import { CompanyCard } from '@/components/tool-outputs/company-card';
import { EmployeeTable } from '@/components/tool-outputs/employee-table';
import { PostPreview } from '@/components/tool-outputs/post-preview';
import { ToolCallLog } from '@/components/tool-call-log';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageListProps {
  messages: UIMessage[];
}

function ReasoningBlock({ text, state }: { text: string; state?: string }) {
  const [expanded, setExpanded] = useState(false);
  const isStreaming = state === 'streaming';

  return (
    <div className="my-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {isStreaming ? (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
          </span>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-500">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        <span className="font-medium">
          {isStreaming ? 'Thinking...' : 'Thought process'}
        </span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={cn('transition-transform', expanded && 'rotate-180')}
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-1.5 pl-4 border-l-2 border-violet-200 dark:border-violet-800">
          <div className="text-[11px] text-muted-foreground/80 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {text}
          </div>
        </div>
      )}
    </div>
  );
}

function renderPart(
  part: UIMessagePart<UIDataTypes, UITools>,
  i: number,
  role: string,
  toolStepNumber: { current: number }
) {
  if (part.type === 'text') {
    if (!part.text?.trim()) return null;
    if (role === 'user') {
      return <div key={i} className="whitespace-pre-wrap text-sm leading-relaxed">{part.text}</div>;
    }
    return (
      <div key={i} className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted prose-pre:border prose-code:text-xs">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
      </div>
    );
  }

  if (part.type === 'reasoning') {
    return <ReasoningBlock key={i} text={part.text} state={part.state} />;
  }

  if (isToolUIPart(part)) {
    const toolName = getToolName(part);
    toolStepNumber.current++;

    // Rich output components for specific tools when output is available
    if (part.state === 'output-available') {
      const output = part.output as Record<string, unknown>;

      // Show rich component AND the log underneath
      let richComponent: React.ReactNode = null;

      switch (toolName) {
        case 'saveCompany':
        case 'scrapeCompanyProfile': {
          const company = output?.company as Record<string, unknown> | undefined;
          if (company) {
            richComponent = (
              <CompanyCard
                name={String(company.name ?? '')}
                industry={company.industry != null ? String(company.industry) : undefined}
                size={company.size != null ? String(company.size) : undefined}
                description={company.description != null ? String(company.description) : undefined}
                followerCount={typeof company.followerCount === 'number' ? company.followerCount : undefined}
                linkedinUrl={company.linkedinUrl != null ? String(company.linkedinUrl) : undefined}
              />
            );
          }
          break;
        }
        case 'getEmployees':
        case 'scrapeCompanyEmployees': {
          const employees = output?.employees;
          if (Array.isArray(employees) && employees.length > 0) {
            richComponent = <EmployeeTable employees={employees as Array<{ name: string; title?: string; linkedinUrl?: string }>} />;
          }
          break;
        }
        case 'writePost': {
          if (output?.post != null) {
            richComponent = <PostPreview content={String(output.post)} contentIdea={output?.contentIdea != null ? String(output.contentIdea) : undefined} />;
          }
          break;
        }
      }

      return (
        <div key={i}>
          <ToolCallLog
            toolName={toolName}
            state={part.state}
            input={part.input as Record<string, unknown>}
            output={output}
            stepNumber={toolStepNumber.current}
          />
          {richComponent}
        </div>
      );
    }

    // For in-progress and error states, just show the log
    return (
      <ToolCallLog
        key={i}
        toolName={toolName}
        state={part.state}
        input={part.state !== 'input-streaming' ? (part.input as Record<string, unknown>) : undefined}
        errorText={part.state === 'output-error' ? part.errorText : undefined}
        stepNumber={toolStepNumber.current}
      />
    );
  }

  return null;
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3 max-w-sm">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <span className="text-primary text-lg font-bold">J</span>
          </div>
          <h3 className="text-sm font-medium">Start a session</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ask me to research a company, analyze competitors, or create content for your employees.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
        {messages.map((message) => {
          const toolStepNumber = { current: 0 };
          return (
            <div key={message.id} className={cn('flex gap-3', message.role === 'user' ? 'justify-end' : 'justify-start')}>
              {message.role !== 'user' && (
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary text-xs font-bold">J</span>
                </div>
              )}
              <div className={cn(
                'max-w-[85%]',
                message.role === 'user'
                  ? 'rounded-xl px-4 py-3 bg-primary text-primary-foreground'
                  : 'space-y-1'
              )}>
                {message.parts?.map((part, i) => renderPart(part, i, message.role, toolStepNumber))}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
