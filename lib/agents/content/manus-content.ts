import { runTask, createTask, pollUntilComplete, extractAssistantText } from '@/lib/manus-client';
import { parseResearchResult } from '@/lib/agents/research/result-parser';
import { buildContentSystemPrompt } from '@/lib/agents/content/system-prompt';
import type { VoiceProfileLike } from '@/lib/types/voice';

function voiceFromProfile(vp?: VoiceProfileLike | null): string {
  if (!vp) return '';
  return [
    vp.toneDescription && `Tone: ${vp.toneDescription}`,
    vp.styleNotes && `Style: ${vp.styleNotes}`,
    vp.personality && `Personality: ${vp.personality}`,
    vp.keyPhrases?.length && `Key phrases: ${vp.keyPhrases.join('; ')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export interface ParsedContentPlan {
  title: string;
  items: Array<{
    topic: string;
    platform: 'linkedin' | 'instagram' | 'blog' | 'other';
    contentType:
      | 'text_post'
      | 'carousel'
      | 'reel'
      | 'story'
      | 'video'
      | 'blog'
      | 'slides';
  }>;
}

export function parseContentPlanJson(text: string): ParsedContentPlan | null {
  const fence = /```json\s*([\s\S]*?)```/i.exec(text);
  const raw = fence?.[1]?.trim();
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as ParsedContentPlan;
    if (!j.title || !Array.isArray(j.items)) return null;
    return j;
  } catch {
    return null;
  }
}

export async function generateContentPlanFromResearch(
  instruction: string,
  researchContext: string,
  voiceProfile?: VoiceProfileLike | null
): Promise<{ taskId: string; resultText: string; plan?: ParsedContentPlan }> {
  const voice = voiceFromProfile(voiceProfile);
  const system = buildContentSystemPrompt(voice);
  const prompt = `${system}

## Research context
${researchContext}

## User instruction
${instruction}

Return a content plan as JSON inside a \`\`\`json block:
{
  "title": "Plan title",
  "items": [
    { "topic": "...", "platform": "linkedin|instagram|blog|other", "contentType": "text_post|carousel|reel|story|video|blog|slides" }
  ]
}
Use 4–10 items. Topics must reflect gaps and opportunities from the research context.`;

  const { taskId, resultText } = await runTask(prompt, { timeoutMs: null });
  const plan = parseContentPlanJson(resultText);
  return { taskId, resultText, plan: plan || undefined };
}

export async function generateContentPiece(
  topic: string,
  platform: 'linkedin' | 'instagram' | 'blog' | 'other',
  contentType: string,
  competitorContext: string,
  voiceProfile?: VoiceProfileLike | null
): Promise<string> {
  const voice = voiceFromProfile(voiceProfile);
  const system = buildContentSystemPrompt(voice);
  const prompt = `${system}

## Competitor / landscape context
${competitorContext}

## Deliverable
Platform: ${platform}
Format: ${contentType}
Topic: ${topic}

Write the final copy. For non-blog formats, keep length appropriate to platform. Output plain text (or markdown for blog).`;

  const { resultText } = await runTask(prompt, { timeoutMs: null });
  return resultText;
}

export async function generateCarouselManus(
  topic: string,
  slideCount: number,
  style: string,
  connectors?: string[]
): Promise<{ slides: { headline: string; imageUrl?: string }[] }> {
  const prompt = `${buildContentSystemPrompt('')}

Create a ${slideCount}-slide carousel about: ${topic}.
Style: ${style}

Return JSON in a \`\`\`json block:
{ "slides": [ { "headline": "...", "imageUrl": "" } ] }
Headlines only on each slide; imageUrl may be empty.`;

  const { resultText } = await runTask(prompt, { connectors, timeoutMs: null });
  try {
    const fence = /```json\s*([\s\S]*?)```/i.exec(resultText);
    const j = JSON.parse(fence?.[1] || resultText) as {
      slides?: { headline: string; imageUrl?: string }[];
    };
    return { slides: j.slides || [] };
  } catch {
    return { slides: [] };
  }
}

export async function generateVideoContentManus(
  topic: string,
  platform: 'linkedin' | 'instagram',
  duration: string,
  voiceProfile?: VoiceProfileLike | null
): Promise<{
  script: string;
  scenes: { timestamp: string; description: string; imageUrl?: string }[];
}> {
  const voice = voiceFromProfile(voiceProfile);
  const prompt = `${buildContentSystemPrompt(voice)}

Topic: ${topic}
Platform: ${platform}
Target duration: ${duration}

Return JSON in a \`\`\`json block:
{
  "script": "full voiceover/narration script",
  "scenes": [ { "timestamp": "0:00-0:05", "description": "...", "imageUrl": "" } ]
}`;

  const { resultText } = await runTask(prompt, { timeoutMs: null });
  try {
    const fence = /```json\s*([\s\S]*?)```/i.exec(resultText);
    const j = JSON.parse(fence?.[1] || resultText) as {
      script?: string;
      scenes?: { timestamp: string; description: string; imageUrl?: string }[];
    };
    return { script: j.script || '', scenes: j.scenes || [] };
  } catch {
    return { script: resultText, scenes: [] };
  }
}

export async function generateBlogManus(
  topic: string,
  keywords: string[],
  voiceProfile?: VoiceProfileLike | null
): Promise<{ title: string; content: string; metaDescription: string }> {
  const voice = voiceFromProfile(voiceProfile);
  const prompt = `${buildContentSystemPrompt(voice)}

Write an SEO-minded blog post.
Topic: ${topic}
Keywords: ${keywords.join(', ')}

Return JSON in a \`\`\`json block:
{ "title": "...", "content": "markdown body", "metaDescription": "..." }`;

  const { resultText } = await runTask(prompt, { timeoutMs: null });
  try {
    const fence = /```json\s*([\s\S]*?)```/i.exec(resultText);
    const j = JSON.parse(fence?.[1] || resultText) as {
      title?: string;
      content?: string;
      metaDescription?: string;
    };
    return {
      title: j.title || topic,
      content: j.content || resultText,
      metaDescription: j.metaDescription || '',
    };
  } catch {
    return { title: topic, content: resultText, metaDescription: '' };
  }
}

export { parseResearchResult };
