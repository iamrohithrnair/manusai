'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useManusApiKey } from '@/components/manus-api-key-provider';
import { manusKeyHeaders } from '@/lib/manus-key-storage';

export type SavedVoiceProfile = {
  toneDescription?: string;
  styleNotes?: string;
  contentBrief?: string;
  keyPhrases?: string[];
  personality?: string;
};

export function VoiceRecorder({
  companyId,
  activePlanId,
  onInsertChat,
  onPlanUpdated,
}: {
  companyId: string;
  activePlanId?: string | null;
  /** Prefills the content chat composer (user presses Send). */
  onInsertChat?: (text: string) => void;
  /** After seeding the pipeline from voice. */
  onPlanUpdated?: () => void;
}) {
  const { apiKey } = useManusApiKey();
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [lastProfile, setLastProfile] = useState<SavedVoiceProfile | null>(null);
  const [seeding, setSeeding] = useState(false);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunks.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    mr.onstop = () => {
      setBlob(new Blob(chunks.current, { type: 'audio/webm' }));
      stream.getTracks().forEach((t) => t.stop());
    };
    mr.start();
    setRec(mr);
    setStatus('Recording…');
    setBlob(null);
  };

  const stop = () => {
    if (!rec) return;
    rec.stop();
    setRec(null);
    setStatus('Ready to upload');
  };

  const buildChatInsert = (p: SavedVoiceProfile) => {
    const brief = (p.contentBrief || '').trim();
    const tone = (p.toneDescription || '').trim();
    const style = (p.styleNotes || '').trim();
    const phrases = (p.keyPhrases || []).filter(Boolean).join(', ');
    return `Based on my brand voice analysis:

**What I want to create:** ${brief || '(see voice profile)'}

**Voice & style for copy:** ${tone || '—'}${style ? `\n**Style notes:** ${style}` : ''}${phrases ? `\n**Key phrases:** ${phrases}` : ''}

Please generate a **content plan** with concrete topics. Use all major formats (LinkedIn, Instagram, blog, short-form video) unless I specified otherwise. Merge into my current workspace plan.`;
  };

  const upload = async () => {
    if (!blob) return;
    const form = new FormData();
    form.append('companyId', companyId);
    form.append('audio', blob, 'voice.webm');
    setUploading(true);
    setLastProfile(null);
    try {
      const res = await fetch('/api/voice-profile', {
        method: 'POST',
        headers: { ...manusKeyHeaders(apiKey) },
        body: form,
      });
      const data = (await res.json()) as {
        profile?: SavedVoiceProfile;
        error?: string;
      };
      if (!res.ok || data.error) {
        setStatus(data.error || `Request failed (${res.status})`);
        return;
      }
      if (data.profile) {
        setLastProfile(data.profile);
        setStatus('Voice profile saved. Use the buttons below to add to chat or the pipeline.');
      } else {
        setStatus('Done');
      }
    } catch {
      setStatus('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const seedPipeline = async () => {
    if (!activePlanId) {
      setStatus((s) => s + '\nSelect or create a plan in the sidebar first.');
      return;
    }
    setSeeding(true);
    try {
      const res = await fetch(`/api/plans/${activePlanId}/seed-from-voice`, { method: 'POST' });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || data.error) {
        setStatus(data.error || 'Could not add topics');
        return;
      }
      setStatus(data.message || 'Topics added to plan.');
      onPlanUpdated?.();
    } catch {
      setStatus('Failed to update pipeline');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <Card className="p-3 space-y-2 clay">
      <p className="text-xs font-semibold">Brand voice (audio)</p>
      <p className="text-[10px] text-muted-foreground">
        Record what you want to say and what content you need. Formats default to{' '}
        <span className="text-foreground/80">all major platforms</span> unless you name specific ones.
      </p>
      <div className="flex flex-wrap gap-2">
        {!rec ? (
          <Button size="sm" type="button" onClick={start} disabled={uploading}>
            Record
          </Button>
        ) : (
          <Button size="sm" type="button" variant="destructive" onClick={stop}>
            Stop
          </Button>
        )}
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={upload}
          disabled={uploading || !blob}
        >
          {uploading ? 'Uploading…' : 'Upload & analyze'}
        </Button>
      </div>
      {lastProfile && onInsertChat && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            type="button"
            className="text-[10px] h-7"
            variant="secondary"
            onClick={() => onInsertChat(buildChatInsert(lastProfile))}
          >
            Insert request into chat
          </Button>
          <Button
            size="sm"
            type="button"
            className="text-[10px] h-7"
            variant="outline"
            disabled={seeding || !activePlanId}
            onClick={() => void seedPipeline()}
          >
            {seeding ? 'Adding…' : 'Add topics to pipeline'}
          </Button>
        </div>
      )}
      {status && <p className="text-[10px] text-muted-foreground whitespace-pre-wrap">{status}</p>}
    </Card>
  );
}
