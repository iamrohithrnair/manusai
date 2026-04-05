import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { connectDB, getDb } from '@/lib/db/client';
import { voiceProfiles } from '@/lib/db/schema';
import {
  uploadFile,
  putUpload,
  createTask,
  pollUntilComplete,
  extractAssistantText,
  waitForFileUploaded,
  VOICE_INLINE_DATA_MAX_BYTES,
} from '@/lib/manus-client';

export const maxDuration = 300;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');
  if (!companyId) return Response.json({ error: 'companyId required' }, { status: 400 });

  await connectDB();
  const db = getDb();
  const profile = db.select().from(voiceProfiles).where(eq(voiceProfiles.companyId, companyId)).get();
  if (!profile) return Response.json({ profile: null });
  return Response.json({
    profile: {
      ...profile,
      keyPhrases: JSON.parse(profile.keyPhrasesJson || '[]'),
    },
  });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const companyId = form.get('companyId') as string;
  const file = form.get('audio') as Blob | null;
  if (!companyId || !file) {
    return Response.json({ error: 'companyId and audio file required' }, { status: 400 });
  }

  try {
  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    return Response.json({ error: 'Empty audio recording. Record again, then upload.' }, { status: 400 });
  }

  const mime = file.type || 'audio/webm';

  const instruction = `You are a supportive marketing voice analyst. Analyze the attached audio.

**Brand voice (for downstream content):**
- Summarize how the brand **comes across** in positive, professional terms: clarity, warmth, pacing, vocabulary, signature phrases, and energy suitable for copy.
- **Do not** insult or negatively judge the speaker (avoid labels like "unenthusiastic," "flat," "boring," or harsh personal critiques). Stay constructive and usable for writers.

**Content brief:** What they want created — topics, themes, platforms, audience, CTAs. If only voice/style is discussed, infer 1–2 sensible marketing directions or leave contentBrief concise.

**Formats:** If they name specific formats/platforms, list them in \`preferredFormats\` as lowercase tokens (e.g. "linkedin", "instagram", "blog", "reel"). If they **do not** specify formats, set \`preferredFormats\` to \`["all"]\` (meaning all major formats apply: LinkedIn, Instagram, blog, short-form video).

Return JSON in a code block:
\`\`\`json
{
  "toneDescription": "...",
  "styleNotes": "...",
  "keyPhrases": ["..."],
  "personality": "...",
  "contentBrief": "...",
  "preferredFormats": ["all"]
}
\`\`\``;

  /**
   * Prefer inline `file_data` (Manus ContentPart `voice` + `data:<mime>;base64,...`) so the model always receives bytes.
   * Presigned flow: https://open.manus.im/docs/v2/upload-file — POST file.upload → PUT upload_url → wait until file.detail is `uploaded` → task.create with `file_id`.
   */
  let fileId: string | null = null;
  let content:
    | [
        { type: 'voice'; file_data: string; filename: string; mime_type: string },
        { type: 'text'; text: string },
      ]
    | [
        { type: 'voice'; file_id: string; filename: string; mime_type: string },
        { type: 'text'; text: string },
      ];

  if (arrayBuffer.byteLength <= VOICE_INLINE_DATA_MAX_BYTES) {
    const fileData = `data:${mime};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
    content = [
      {
        type: 'voice',
        file_data: fileData,
        filename: 'recording.webm',
        mime_type: mime,
      },
      { type: 'text', text: instruction },
    ];
  } else {
    const up = await uploadFile('recording.webm');
    fileId = up.fileId;
    await putUpload(up.uploadUrl, arrayBuffer, mime);
    await waitForFileUploaded(fileId);
    content = [
      {
        type: 'voice',
        file_id: fileId,
        filename: 'recording.webm',
        mime_type: mime,
      },
      { type: 'text', text: instruction },
    ];
  }

  const { taskId } = await createTask(content, { interactiveMode: false });
  const { messages } = await pollUntilComplete(taskId, { timeoutMs: null });
  const text = extractAssistantText(messages);

  let parsed: {
    toneDescription?: string;
    styleNotes?: string;
    keyPhrases?: string[];
    personality?: string;
    contentBrief?: string;
    preferredFormats?: string[];
  } = {};
  try {
    const fence = /```json\s*([\s\S]*?)```/i.exec(text);
    parsed = JSON.parse(fence?.[1] || text) as typeof parsed;
  } catch {
    parsed = {
      toneDescription: text.slice(0, 500),
      styleNotes: '',
      keyPhrases: [],
      personality: '',
      contentBrief: '',
    };
  }

  let briefOut = (parsed.contentBrief || '').trim();
  const fmt = parsed.preferredFormats?.map((x) => String(x).toLowerCase().trim()) ?? [];
  if (!fmt.length || fmt.includes('all')) {
    briefOut = briefOut
      ? `${briefOut}\n\n_Formats: all major platforms (LinkedIn, Instagram, blog, short-form video) unless specified above._`
      : '_Formats: all major platforms (LinkedIn, Instagram, blog, short-form video)._';
  } else {
    briefOut = briefOut
      ? `${briefOut}\n\n_Preferred formats: ${fmt.join(', ')}._`
      : `_Preferred formats: ${fmt.join(', ')}._`;
  }

  const td = (parsed.toneDescription || '').trim();
  const combined = `${td} ${briefOut}`;
  const looksLikeAttachmentRefusal =
    td.length < 500 &&
    /no audio file was attached|i notice no audio|share the audio recording|please attach|didn'?t receive.*audio/i.test(
      combined
    ) &&
    !/```json/i.test(combined);
  if (looksLikeAttachmentRefusal) {
    throw new Error(
      'Manus did not analyze the recording. Try a shorter clip (under ~2 min) or record again; if it persists, check MANUS_API_KEY and Manus status.'
    );
  }

  await connectDB();
  const db = getDb();
  const t = Date.now();
  const id = randomUUID();
  const existing = db.select().from(voiceProfiles).where(eq(voiceProfiles.companyId, companyId)).get();

  if (existing) {
    db.update(voiceProfiles)
      .set({
        audioFileId: fileId,
        toneDescription: parsed.toneDescription || '',
        styleNotes: parsed.styleNotes || '',
        keyPhrasesJson: JSON.stringify(parsed.keyPhrases || []),
        personality: parsed.personality || '',
        contentBrief: briefOut.slice(0, 8000),
        manusTaskId: taskId,
        updatedAt: t,
      })
      .where(eq(voiceProfiles.id, existing.id))
      .run();
  } else {
    db.insert(voiceProfiles)
      .values({
        id,
        companyId,
        audioFileId: fileId,
        toneDescription: parsed.toneDescription || '',
        styleNotes: parsed.styleNotes || '',
        keyPhrasesJson: JSON.stringify(parsed.keyPhrases || []),
        personality: parsed.personality || '',
        contentBrief: briefOut.slice(0, 8000),
        manusTaskId: taskId,
        createdAt: t,
        updatedAt: t,
      })
      .run();
  }

  const profile = db.select().from(voiceProfiles).where(eq(voiceProfiles.companyId, companyId)).get();
  return Response.json({
    profile: profile
      ? { ...profile, keyPhrases: JSON.parse(profile.keyPhrasesJson || '[]') }
      : null,
  });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Voice profile failed';
    return Response.json({ error: msg }, { status: 502 });
  }
}
