import type { UIMessage } from 'ai';

export function getLastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === 'user');
  if (!last?.parts) return '';
  const t = last.parts.find((p) => p.type === 'text');
  if (t && t.type === 'text') return t.text ?? '';
  return '';
}

/** Every user turn in order, for tasks that must honor full chat context (e.g. research). */
export function getAllUserResearchInstructions(messages: UIMessage[], maxChars = 12000): string {
  const chunks: string[] = [];
  for (const m of messages) {
    if (m.role !== 'user' || !m.parts) continue;
    for (const p of m.parts) {
      if (p.type === 'text' && p.text?.trim()) {
        chunks.push(p.text.trim());
      }
    }
  }
  const joined = chunks.join('\n\n---\n\n');
  if (joined.length <= maxChars) return joined;
  return `${joined.slice(0, maxChars)}\n\n[Earlier user instructions omitted — text exceeded ${maxChars} characters.]`;
}
