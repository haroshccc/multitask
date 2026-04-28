/**
 * Default Claude prompts for the recording-summarize Edge Function.
 *
 * These are the per-section instructions Claude follows when generating each
 * field of the AI output. The user can override any of them on a per-account
 * basis (`user_thought_preferences.recording_ai_prompts`); empty / missing
 * values fall back to the defaults below.
 *
 * NOTE: this file is duplicated as a string literal in
 * `supabase/functions/summarize/index.ts` (`DEFAULT_PROMPTS` const) — keep
 * them in sync. The Deno runtime can't share TS files with the Vite bundle.
 */

export type RecordingAiPromptKey =
  | "short_summary"
  | "long_summary"
  | "whatsapp_message"
  | "email"
  | "tasks"
  | "events";

export const RECORDING_AI_PROMPT_LABELS: Record<RecordingAiPromptKey, string> = {
  short_summary: "סיכום קצר",
  long_summary: "סיכום ארוך",
  whatsapp_message: "הודעת WhatsApp",
  email: "טיוטת מייל",
  tasks: "משימות",
  events: "אירועים",
};

export const DEFAULT_RECORDING_AI_PROMPTS: Record<RecordingAiPromptKey, string> = {
  short_summary:
    "צור סיכום קצר של 1–2 משפטים שמסכמים את הנקודה המרכזית של השיחה (אלוואטור-פיץ').",
  long_summary:
    "צור סיכום מפורט של מספר פסקאות שמכסות את הנושאים העיקריים, ההחלטות שהתקבלו, ושאלות פתוחות שעלו. אל תכלול דברי נימוס.",
  whatsapp_message:
    "כתוב הודעת מעקב קצרה (3–5 שורות) שמתאימה לשליחה ב-WhatsApp לצד השני בשיחה. בטון אישי, כולל סיכום של מה שהוסכם ומה הצעדים הבאים.",
  email:
    "צור טיוטת מייל פורמלית לשליחה לצד השני. נושא תמציתי וגוף עם פתיח, סיכום הנקודות העיקריות, רשימה של פעולות שסוכמו, ופנייה חיובית לסיום.",
  tasks:
    "זהה משימות שצריך לבצע אחרי השיחה. לכל משימה קבע: כותרת ברורה, מי הדובר שאחראי (אם ידוע), עדיפות (low/normal/high), ורמז דד-ליין טקסטואלי אם הוזכר תאריך יחסי כמו 'מחר' או 'בשבוע הבא'. אל תמציא משימות.",
  events:
    "זהה פגישות / אירועים / מועדים שנקבעו בשיחה. לכל אירוע קבע: כותרת, תאריך ISO אם הוזכר תאריך מפורש (אחרת null), משך בדקות (ברירת מחדל 30), ומי הדובר אם זה רלוונטי.",
};

export interface RecordingAiPromptOverrides {
  short_summary?: string;
  long_summary?: string;
  whatsapp_message?: string;
  email?: string;
  tasks?: string;
  events?: string;
}

/** Resolve the effective prompt for a given key — user override or default. */
export function resolveRecordingAiPrompt(
  key: RecordingAiPromptKey,
  overrides: RecordingAiPromptOverrides | null | undefined
): string {
  const override = overrides?.[key]?.trim();
  return override && override.length > 0
    ? override
    : DEFAULT_RECORDING_AI_PROMPTS[key];
}
