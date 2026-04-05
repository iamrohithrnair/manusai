'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface MessageInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  defaultValue?: string;
  /** Increment to re-apply defaultValue (e.g. user asked to insert the template again in the same session). */
  applyRevision?: number;
}

export function MessageInput({ onSend, isLoading, defaultValue, applyRevision }: MessageInputProps) {
  const [input, setInput] = useState(defaultValue || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // When defaultValue changes, update input
  useEffect(() => {
    if (defaultValue) setInput(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (applyRevision === undefined || applyRevision < 1) return;
    setInput(defaultValue || '');
  }, [applyRevision, defaultValue]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t bg-background/95 backdrop-blur">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-4">
        <div className="relative flex items-end gap-2 rounded-xl border bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring p-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message the agent..."
            className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground min-h-[40px] max-h-[200px]"
            rows={1}
          />
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !input.trim()}
            className="mb-1 mr-1 h-8 w-8 rounded-lg p-0 shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 7-7 7 7" /><path d="M12 19V5" />
            </svg>
          </Button>
        </div>
      </form>
    </div>
  );
}
