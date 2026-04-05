import type { UIMessage } from 'ai';

/**
 * Parses `**Manus task** \`taskId\`` from assistant messages (research + content "started" copy).
 * Returns the last match (most recent background task in the thread).
 */
export function extractLastManusTaskIdFromMessages(messages: UIMessage[]): string | null {
  const re = /\*\*Manus task\*\* `([^`]+)`/;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant' || !m.parts) continue;
    for (const p of m.parts) {
      if (p.type === 'text' && p.text) {
        const x = re.exec(p.text);
        if (x?.[1]?.trim()) return x[1].trim();
      }
    }
  }
  return null;
}
