/**
 * Manus Open API v2 client.
 *
 * Task polling follows the official lifecycle: after `task.create`, poll `task.listMessages`
 * and interpret `status_update` / `agent_status` (running → stopped | waiting | error).
 * @see https://open.manus.im/docs/v2/task-lifecycle
 */
const MANUS_API_BASE = 'https://api.manus.ai/v2';

export type ContentPart = { type: string; [key: string]: unknown };

function headers(): Record<string, string> {
  const key = process.env.MANUS_API_KEY;
  if (!key) throw new Error('MANUS_API_KEY is not set');
  return {
    'Content-Type': 'application/json',
    'x-manus-api-key': key,
  };
}

export interface CreateTaskOptions {
  connectors?: string[];
  enableSkills?: string[];
  projectId?: string;
  locale?: string;
  interactiveMode?: boolean;
}

export interface ManusTaskResult {
  taskId: string;
  taskUrl: string;
  taskTitle: string;
}

export async function createTask(
  content: string | ContentPart[],
  options?: CreateTaskOptions
): Promise<ManusTaskResult> {
  const body: Record<string, unknown> = {
    message: {
      content,
      ...(options?.connectors?.length ? { connectors: options.connectors } : {}),
      ...(options?.enableSkills?.length ? { enable_skills: options.enableSkills } : {}),
    },
    ...(options?.projectId ? { project_id: options.projectId } : {}),
    locale: options?.locale || 'en',
    interactive_mode: options?.interactiveMode ?? false,
  };

  const res = await fetch(`${MANUS_API_BASE}/task.create`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    ok?: boolean;
    task_id?: string;
    task_url?: string;
    task_title?: string;
    error?: { message?: string };
  };
  if (!data.ok) throw new Error(data.error?.message || 'Failed to create task');

  const taskId = data.task_id?.trim();
  if (!taskId) {
    throw new Error('Manus task.create succeeded but did not return task_id');
  }

  return {
    taskId,
    taskUrl: data.task_url || '',
    taskTitle: data.task_title || '',
  };
}

export async function getTaskDetail(taskId: string): Promise<Record<string, unknown>> {
  const res = await fetch(
    `${MANUS_API_BASE}/task.detail?task_id=${encodeURIComponent(taskId)}`,
    { headers: headers() }
  );
  const data = (await res.json()) as { ok?: boolean; task?: Record<string, unknown>; error?: { message?: string } };
  if (!data.ok) throw new Error(data.error?.message || 'Failed to get task');
  return data.task || {};
}

export async function sendMessage(taskId: string, content: string) {
  const res = await fetch(`${MANUS_API_BASE}/task.sendMessage`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ task_id: taskId, message: { content } }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: { message?: string } };
  if (!data.ok) throw new Error(data.error?.message || 'Failed to send message');
  return data;
}

export async function confirmAction(
  taskId: string,
  eventId: string,
  input: Record<string, unknown>
) {
  const res = await fetch(`${MANUS_API_BASE}/task.confirmAction`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ task_id: taskId, event_id: eventId, input }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: { message?: string } };
  if (!data.ok) throw new Error(data.error?.message || 'Failed to confirm action');
  return data;
}

export async function listMessages(taskId: string, cursor?: string) {
  /** Up to 200 per Manus API; research threads can have many events before the final answer. */
  const params = new URLSearchParams({ task_id: taskId, order: 'desc', limit: '200' });
  if (cursor) params.set('cursor', cursor);

  const res = await fetch(`${MANUS_API_BASE}/task.listMessages?${params}`, { headers: headers() });
  const data = (await res.json()) as {
    ok?: boolean;
    messages?: unknown[];
    next_cursor?: string;
    error?: { message?: string };
  };
  if (!data.ok) throw new Error(data.error?.message || 'Failed to list messages');
  return { messages: data.messages || [], nextCursor: data.next_cursor };
}

export async function listConnectors() {
  const res = await fetch(`${MANUS_API_BASE}/connector.list`, { headers: headers() });
  const data = (await res.json()) as { ok?: boolean; connectors?: unknown[]; error?: { message?: string } };
  if (!data.ok) throw new Error(data.error?.message || 'Failed to list connectors');
  return data.connectors || [];
}

export async function uploadFile(filename: string) {
  const res = await fetch(`${MANUS_API_BASE}/file.upload`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ filename }),
  });
  /** @see https://open.manus.ai/docs/v2/upload-file.md — `file.id` is the attachment id; top-level `upload_url` is presigned. */
  const data = (await res.json()) as {
    ok?: boolean;
    file_id?: string;
    fileId?: string;
    file?: { id?: string };
    upload_url?: string;
    uploadUrl?: string;
    error?: { message?: string };
  };
  if (!data.ok) throw new Error(data.error?.message || 'Failed to upload file');
  const fileId = data.file_id ?? data.fileId ?? data.file?.id;
  const uploadUrl = data.upload_url ?? data.uploadUrl;
  if (!fileId?.trim() || !uploadUrl?.trim()) {
    throw new Error('Manus file.upload response missing file id or upload_url');
  }
  return { fileId: fileId.trim(), uploadUrl: uploadUrl.trim() };
}

export type FileDetailStatus = 'pending' | 'uploaded' | 'deleted' | 'error';

/** @see https://open.manus.im/docs/v2/upload-file — after PUT to \`upload_url\`, poll until \`uploaded\`. */
export async function getFileDetail(fileId: string): Promise<{
  status: FileDetailStatus;
  errorMessage?: string | null;
}> {
  const res = await fetch(
    `${MANUS_API_BASE}/file.detail?file_id=${encodeURIComponent(fileId)}`,
    { headers: headers() }
  );
  const data = (await res.json()) as Record<string, unknown>;
  if (!data.ok) {
    const err = data.error as { message?: string } | undefined;
    throw new Error(err?.message || 'Failed to get file detail');
  }
  const file = (data.file ?? {}) as Record<string, unknown>;
  const s =
    (file.status as string | undefined) ||
    (file.Status as string | undefined) ||
    (data.status as string | undefined);
  const status = (s === 'uploaded' || s === 'pending' || s === 'error' || s === 'deleted' ? s : 'pending') as FileDetailStatus;
  const errMsg =
    (file.error_message as string | null | undefined) ??
    (file.errorMessage as string | null | undefined) ??
    null;
  return { status, errorMessage: errMsg };
}

/**
 * After PUT to upload_url, Manus keeps the file as `pending` until processing finishes.
 * Creating a task before `uploaded` often yields "no audio attached" from the agent.
 */
export async function waitForFileUploaded(
  fileId: string,
  options?: { timeoutMs?: number; intervalMs?: number }
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 90_000;
  const intervalMs = options?.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const d = await getFileDetail(fileId);
    if (d.status === 'uploaded') return;
    if (d.status === 'error') {
      throw new Error(d.errorMessage || `File ${fileId} upload failed on Manus`);
    }
    if (d.status === 'deleted') {
      throw new Error(`File ${fileId} was deleted before upload completed`);
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for file ${fileId} to become ready (still pending)`);
}

export async function stopTask(taskId: string) {
  const res = await fetch(`${MANUS_API_BASE}/task.stop`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ task_id: taskId }),
  });
  return res.json();
}

type AgentStatus = 'running' | 'stopped' | 'waiting' | 'error' | 'unknown';

/**
 * Reads the latest `status_update` from listMessages.
 * We request `order=desc`, so the first `status_update` in the array is the newest.
 * @see https://open.manus.im/docs/v2/task-lifecycle — agent_status: running | stopped | waiting | error
 */
function readStatusFromMessages(messages: unknown[]): {
  agentStatus: AgentStatus;
  waitingEventId?: string;
  waitingEventType?: string;
} {
  let agentStatus: AgentStatus = 'unknown';
  let waitingEventId: string | undefined;
  let waitingEventType: string | undefined;

  for (const raw of messages) {
    const m = raw as Record<string, unknown>;
    if (m.type === 'status_update' && m.status_update && typeof m.status_update === 'object') {
      const su = m.status_update as { agent_status?: string; status_detail?: Record<string, unknown> };
      const s = su.agent_status;
      if (s === 'running' || s === 'stopped' || s === 'waiting' || s === 'error') {
        agentStatus = s;
      }
      const detail = su.status_detail;
      if (detail && typeof detail === 'object') {
        waitingEventId = detail.waiting_for_event_id as string | undefined;
        waitingEventType = detail.waiting_for_event_type as string | undefined;
      }
      break;
    }
  }

  return { agentStatus, waitingEventId, waitingEventType };
}

function readErrorDetailFromMessages(messages: unknown[]): string | undefined {
  for (const raw of messages) {
    const m = raw as Record<string, unknown>;
    if (m.type === 'error_message') {
      const em = m.error_message;
      if (em && typeof em === 'object') {
        const c = (em as Record<string, unknown>).content;
        if (typeof c === 'string' && c.trim()) return c.trim();
      }
      const text = m.content ?? m.text ?? m.message;
      if (typeof text === 'string' && text.trim()) return text.trim();
    }
    if (m.type === 'error') {
      const text = m.content ?? m.text ?? m.message;
      if (typeof text === 'string' && text.trim()) return text.trim();
    }
  }
  return undefined;
}

async function handleWaiting(
  taskId: string,
  waitingEventId: string | undefined,
  waitingEventType: string | undefined
) {
  if (!waitingEventId) return;
  if (waitingEventType === 'messageAskUser') {
    await sendMessage(
      taskId,
      'Reply with your best concise answer and continue the task without asking for more input.'
    );
    return;
  }
  if (waitingEventType === 'needConnectMyBrowser') {
    await confirmAction(taskId, waitingEventId, { action: 'skip' });
    return;
  }
  // https://open.manus.im/docs/v2/task-lifecycle — apiHighCreditNotice uses { action: "accept" | "reject" }
  if (waitingEventType === 'apiHighCreditNotice') {
    await confirmAction(taskId, waitingEventId, { action: 'accept' });
    return;
  }
  if (
    waitingEventType === 'gmailSendAction' ||
    waitingEventType === 'outlookSendMailsAction' ||
    waitingEventType === 'deployAction' ||
    waitingEventType === 'terminalExecute' ||
    waitingEventType === 'connectorOauthExpired' ||
    waitingEventType === 'mapreduceAction'
  ) {
    await confirmAction(taskId, waitingEventId, { accept: true });
    return;
  }
  if (waitingEventType === 'videoGenerate') {
    await confirmAction(taskId, waitingEventId, { choice: 'standard' });
    return;
  }
  if (waitingEventType === 'webdevRunAction') {
    await confirmAction(taskId, waitingEventId, { accept: true, mode: 'speed' });
    return;
  }
  await confirmAction(taskId, waitingEventId, { accept: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Manus may briefly return task_id before task.listMessages can see it (eventual consistency). */
export function isTransientTaskNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /task not found|task_id.*not found|invalid task/i.test(msg);
}

/**
 * Pull plain text from Manus message `content` whether it is a string, part array, or nested object.
 * @see https://open.manus.ai/docs/v2/list-messages.md — assistant payload lives under `assistant_message`.
 */
function extractTextFromContentValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    const chunks = value.map((part) => extractTextFromContentValue(part)).filter(Boolean);
    return chunks.join('\n');
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text.trim();
    if (typeof o.content === 'string') return o.content.trim();
    if (Array.isArray(o.parts)) return extractTextFromContentValue(o.parts);
  }
  return '';
}

function extractAssistantBodyFromEvent(m: Record<string, unknown>): string {
  const t = m.type as string | undefined;

  if (t === 'assistant_message' && m.assistant_message && typeof m.assistant_message === 'object') {
    const am = m.assistant_message as Record<string, unknown>;
    return extractTextFromContentValue(am.content);
  }

  const role = m.role as string | undefined;
  if (role === 'assistant' || role === 'model') {
    const nested = (m.message as Record<string, unknown> | undefined)?.content;
    return extractTextFromContentValue(m.content ?? m.text ?? nested);
  }

  if (t === 'assistant_message') {
    return extractTextFromContentValue(m.content ?? m.text);
  }

  return '';
}

export function extractAssistantText(messages: unknown[]): string {
  const chronological = [...messages].reverse();
  const parts: string[] = [];
  for (const raw of chronological) {
    const m = raw as Record<string, unknown>;
    const body = extractAssistantBodyFromEvent(m);
    if (body) parts.push(body);
  }
  return parts.join('\n\n');
}

/**
 * Single listMessages + status handling step (for client-driven polling).
 * - `completed`: agent finished — use `messages` with extractAssistantText.
 * - `continue`: still provisioning, running, or waiting was handled — poll again later.
 * - `error`: terminal failure.
 */
export async function pollOneStep(taskId: string): Promise<
  | { kind: 'completed'; messages: unknown[] }
  | { kind: 'continue'; statusLabel: string }
  | { kind: 'error'; message: string }
> {
  let messages: unknown[];
  try {
    messages = (await listMessages(taskId)).messages;
  } catch (e) {
    if (isTransientTaskNotFoundError(e)) {
      return { kind: 'continue', statusLabel: 'task_provisioning' };
    }
    throw e;
  }

  const { agentStatus, waitingEventId, waitingEventType } = readStatusFromMessages(messages);

  if (agentStatus === 'error') {
    const detail = readErrorDetailFromMessages(messages);
    return { kind: 'error', message: detail || `Task ${taskId} failed (agent error)` };
  }

  if (agentStatus === 'stopped') {
    return { kind: 'completed', messages };
  }

  if (agentStatus === 'waiting') {
    await handleWaiting(taskId, waitingEventId, waitingEventType);
    return { kind: 'continue', statusLabel: 'waiting' };
  }

  const label = agentStatus === 'unknown' ? 'polling' : agentStatus;
  return { kind: 'continue', statusLabel: label };
}

export async function pollUntilComplete(
  taskId: string,
  options?: {
    intervalMs?: number;
    /** Omit for default 5 minutes; pass `null` for no timeout. */
    timeoutMs?: number | null;
    onStatus?: (status: string, elapsedMs: number) => void;
  }
): Promise<{ status: string; messages: unknown[] }> {
  const interval = options?.intervalMs ?? 5000;
  const timeout = options?.timeoutMs === undefined ? 300000 : options.timeoutMs;
  const start = Date.now();

  while (true) {
    const elapsed = Date.now() - start;
    if (timeout !== null && elapsed > timeout) throw new Error(`Task ${taskId} timed out after ${timeout}ms`);

    const step = await pollOneStep(taskId);
    if (step.kind === 'completed') {
      options?.onStatus?.('stopped', elapsed);
      return { status: 'completed', messages: step.messages };
    }
    if (step.kind === 'error') {
      throw new Error(`Task ${taskId} failed: ${step.message}`);
    }

    options?.onStatus?.(step.statusLabel, elapsed);
    const wait =
      step.statusLabel === 'task_provisioning'
        ? Math.min(interval, 4000)
        : step.statusLabel === 'waiting'
          ? Math.min(interval, 2000)
          : interval;
    await sleep(wait);
  }
}

export async function runTask(
  content: string,
  options?: CreateTaskOptions & {
    timeoutMs?: number | null;
    onStatus?: (status: string, elapsedMs: number) => void;
  }
): Promise<{ taskId: string; resultText: string; messages: unknown[] }> {
  const { taskId } = await createTask(content, options);
  const { messages } = await pollUntilComplete(taskId, {
    timeoutMs: options?.timeoutMs,
    onStatus: options?.onStatus,
  });

  const resultText = extractAssistantText(messages);
  return { taskId, resultText, messages };
}

/**
 * PUT file bytes to the presigned URL from [file.upload](https://open.manus.im/docs/v2/upload-file).
 * S3 often requires the same Content-Type that was signed; we retry with \`application/octet-stream\` if the first PUT fails.
 */
export async function putUpload(uploadUrl: string, body: ArrayBuffer | Blob, contentType: string) {
  let res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });
  if (!res.ok && contentType !== 'application/octet-stream') {
    res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body,
    });
  }
  if (!res.ok) {
    const hint = await res.text().catch(() => '');
    throw new Error(`Upload to presigned URL failed: ${res.status} ${hint.slice(0, 300)}`);
  }
}

/** Max size to send as inline \`file_data\` on \`task.create\` (avoids presigned pipeline issues). ~2.5MB raw. */
export const VOICE_INLINE_DATA_MAX_BYTES = Math.floor(2.5 * 1024 * 1024);
