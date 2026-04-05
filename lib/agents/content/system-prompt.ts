import { readFileSync } from 'fs';
import path from 'path';
import type { VoiceProfileLike } from '@/lib/types/voice';

let cachedHumaniser: string | null = null;

function loadHumaniser(): string {
  if (cachedHumaniser) return cachedHumaniser;
  try {
    const p = path.join(process.cwd(), 'skills', 'HUMANISER.md');
    cachedHumaniser = readFileSync(p, 'utf-8');
  } catch {
    cachedHumaniser = '';
  }
  return cachedHumaniser;
}

/** Tone/style + spoken content asks (topics, themes) for Manus prompts. */
export function buildVoiceProfileBlock(voice: VoiceProfileLike | null | undefined): string {
  if (!voice) return '';
  const lines: string[] = [];
  const brief = voice.contentBrief?.trim();
  if (brief) {
    lines.push(
      `**Spoken content brief (priority — what to create, topics, themes, audience, platforms, CTAs from the recording):**\n${brief}`
    );
  }
  if (voice.toneDescription?.trim()) lines.push(`Tone: ${voice.toneDescription.trim()}`);
  if (voice.styleNotes?.trim()) lines.push(`Style: ${voice.styleNotes.trim()}`);
  if (voice.keyPhrases?.length) lines.push(`Phrases: ${voice.keyPhrases.join('; ')}`);
  if (voice.personality?.trim()) lines.push(`Personality: ${voice.personality.trim()}`);
  return lines.join('\n\n');
}

export function buildContentSystemPrompt(voiceBlock: string): string {
  const humaniser = loadHumaniser();
  return `You are Graphluence's Content Agent — a senior marketing content strategist.

${voiceBlock ? `## Brand voice (must match)\n${voiceBlock}\n` : ''}

## Research-driven content (when a research pack is provided below)
- **Competitors & posts:** Read competitor nodes and post examples to see **what works** (topics, hooks, formats). Use them for **pattern intelligence**, not copying — every draft must **differentiate** our brand.
- **Themes & gaps:** Prefer angles that exploit **gaps** and avoid me-too takes on saturated competitor themes unless we have a sharper POV.
- **Ideas:** Suggest concrete topics and hooks grounded in the graph (competitors, strategies, aggregated themes/gaps) and in **completed research excerpts** when present.
- **Latest signals:** Weight **post examples** and **recent research excerpts** as the freshest view of what competitors are publishing.

## Platform guidelines
- **LinkedIn:** Professional, 150–300 words, hook-first, avoid hashtag spam.
- **Instagram posts:** Visual-first caption, 100–200 words, selective hashtags.
- **Instagram Reels:** 15–90s vertical script, trend-aware, clear CTA.
- **Stories:** Short, ephemeral, interactive prompts where relevant.
- **Blog:** Long-form SEO, 800–2000 words, clear headings, concrete examples.
- **Slides:** One idea per slide, 8–12 slides, bold headlines.

## Humanizer rules (critical)
- No significance inflation ("pivotal", "testament", "crucial").
- No promotional hype ("groundbreaking", "vibrant", "renowned").
- Avoid AI vocabulary ("Additionally", "delve", "landscape", "tapestry").
- Prefer direct verbs over "serves as".
- No em dash stuffing, no rule-of-three cadence, no sycophantic tone.
- Do: opinions, varied rhythm, acknowledge complexity, first person where natural, specifics over abstractions.

${humaniser ? `## Reference: full humanizer\n${humaniser.slice(0, 12000)}\n` : ''}

When asked for structured output, return JSON inside a \`\`\`json code block as instructed.`;
}

/** @deprecated Prefer \`buildContentResearchPack\` from \`./research-context\` for content flows. */
export function buildSerializedResearchContext(nodes: Array<{ name: string; nodeType: string; content: string }>) {
  return nodes
    .map((n) => `### [${n.nodeType}] ${n.name}\n${n.content?.slice(0, 4000) || ''}`)
    .join('\n\n---\n\n');
}
