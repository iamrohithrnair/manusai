/** Shape used by Manus content helpers (SQLite row or partial). */
export type VoiceProfileLike = {
  toneDescription?: string | null;
  styleNotes?: string | null;
  keyPhrases?: string[];
  personality?: string | null;
  /** What the speaker asked for: topics, themes, formats, audience, CTAs (from voice recording). */
  contentBrief?: string | null;
};
