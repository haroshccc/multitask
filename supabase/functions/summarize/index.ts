// Summarize Edge Function — Claude-powered analysis of a transcribed recording.
// SPEC §8 + Phase 6ג (step 2 of 2). Reads `recordings.transcript_json` /
// `transcript_text`, asks Claude Sonnet 4.6 to extract a structured set of
// proposals (summary / whatsapp / email / tasks / events / decisions /
// questions), and writes the result back to `recordings.ai_output` so the
// frontend can render an editable, approvable review pane.
//
// Endpoint:
//   POST /summarize        — { recording_id } → fills ai_output, returns it.
//
// Required Supabase secrets (Settings → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY      — keys.anthropic.com / Workbench → API keys
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are auto-injected)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { jsonResponse, preflight } from "../_shared/cors.ts";
import { requireMember, type MembershipContext } from "../_shared/auth.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const MAX_TRANSCRIPT_CHARS = 80_000; // ~20k tokens; well under context limit

interface AiOutput {
  short_summary: string;
  long_summary: string;
  whatsapp_message: string;
  email: { subject: string; body: string };
  tasks: Array<{
    title: string;
    speaker_name?: string | null;
    speaker_index?: number | null;
    priority?: "low" | "normal" | "high";
    due_hint?: string | null;
  }>;
  events: Array<{
    title: string;
    date_iso?: string | null;
    duration_minutes?: number | null;
    speaker_name?: string | null;
  }>;
}

// Default per-section instructions. Mirrored verbatim from
// `src/lib/ai/recording-prompts.ts` — keep in sync. Each user can override
// any of these via `user_thought_preferences.recording_ai_prompts`.
const DEFAULT_PROMPTS: Record<string, string> = {
  short_summary:
    "צור סיכום קצר של 1–2 משפטים שמסכמים את הנקודה המרכזית של השיחה (אלוואטור-פיץ').",
  long_summary:
    "צור סיכום מפורט של מספר פסקאות שמכסות את הנושאים העיקריים, ההחלטות שהתקבלו, ושאלות פתוחות שעלו. אל תכלול דברי נימוס.",
  whatsapp_message:
    "כתוב/כתבי הודעת מעקב קצרה (3–5 שורות) לשליחה ב-WhatsApp לצד השני בשיחה. פתח/פתחי ב-'היי <שם>' תוך שימוש בשם של הדובר העיקרי שאינו בעלת ההקלטה (לפי תיוג הדוברים שמופיע בהקשר). השתמש/י בלשון אישית בגוף שני (את/אתה). כלול/כללי סיכום של מה שהוסכם ומה הצעדים הבאים. אם אין שם דובר אחר ידוע, אל תכלול שורת פתיחה אלא הודעה ניטרלית.",
  email:
    "צור/צרי טיוטת מייל פורמלית לשליחה לצד השני. הנושא תמציתי. גוף המייל מתחיל ב-'היי <שם>' עם שם הדובר העיקרי שאינו בעלת ההקלטה (לפי תיוג הדוברים שמופיע בהקשר), בלשון אישית בגוף שני. אחר כך — סיכום הנקודות העיקריות, רשימה של פעולות שסוכמו, ופנייה חיובית לסיום. אם אין שם דובר אחר ידוע, פתח/פתחי ב-'שלום' ללא שם.",
  tasks:
    "זהה משימות שצריך לבצע אחרי השיחה ופצל אותן לפי האחראי. לכל משימה קבע: כותרת ברורה, speaker_name של הדובר שאחראי לבצע אותה (השתמש/י ב-'אני' אם זו משימה של בעלת ההקלטה — דובר 0 כברירת מחדל אלא אם תויג אחרת), עדיפות (low/normal/high), ורמז דד-ליין טקסטואלי אם הוזכר תאריך יחסי כמו 'מחר' או 'בשבוע הבא'. אל תמציא משימות.",
  events:
    "זהה פגישות / אירועים / מועדים שנקבעו בשיחה. לכל אירוע קבע: כותרת, תאריך ISO אם הוזכר תאריך מפורש (אחרת null), משך בדקות (ברירת מחדל 30), ומי הדובר אם זה רלוונטי.",
};

function buildSystemPrompt(
  overrides: Record<string, string | null | undefined> | null,
  customPrompt?: string
): string {
  const get = (k: string) => {
    const v = overrides?.[k]?.trim();
    return v && v.length > 0 ? v : DEFAULT_PROMPTS[k];
  };
  return `אתה עוזר אישי שמנתח שיחות מתומללות בעברית. המשתמש (בעלת המוצר) הקליטה שיחה עם לקוח / שותף / חבר צוות, ועכשיו את צריכה לעבד את התמלול כדי להוציא ממנו ערך שימושי.

דרישות כלליות:
- כל הטקסט החופשי בעברית בלבד.
- אל תמציא נתונים שאינם בתמלול.
- אם אין מידע מתאים לסעיף, החזר/י מערך ריק או מחרוזת ריקה.

הנחיות פר-סקציה (ניתנות להתאמה ע"י המשתמשת):

[short_summary] ${get("short_summary")}
[long_summary] ${get("long_summary")}
[whatsapp_message] ${get("whatsapp_message")}
[email] ${get("email")}
[tasks] ${get("tasks")}
[events] ${get("events")}

${customPrompt ? `\nהוראה נוספת מהמשתמש: ${customPrompt}\n` : ""}החזר/י JSON תקני בלבד התואם בדיוק לסכימה הבאה — בלי מלל לפני או אחרי, בלי בלוקי \`\`\`:

{
  "short_summary": string,
  "long_summary": string,
  "whatsapp_message": string,
  "email": { "subject": string, "body": string },
  "tasks": [
    { "title": string, "speaker_name": string | null, "speaker_index": number | null, "priority": "low" | "normal" | "high", "due_hint": string | null }
  ],
  "events": [
    { "title": string, "date_iso": string | null, "duration_minutes": number | null, "speaker_name": string | null }
  ]
}`;
}

function buildUserPrompt(args: {
  title: string | null;
  transcript_text: string;
  speakerLabels: Record<number, string>;
}): string {
  const speakerHint = Object.keys(args.speakerLabels).length
    ? `\n\nתיוג דוברים:\n${Object.entries(args.speakerLabels)
        .map(([i, l]) => `  דובר ${i}: ${l}`)
        .join("\n")}`
    : "";
  const t =
    args.transcript_text.length > MAX_TRANSCRIPT_CHARS
      ? args.transcript_text.slice(0, MAX_TRANSCRIPT_CHARS) +
        "\n\n[התמלול קוצר בגלל אורך]"
      : args.transcript_text;
  return `כותרת ההקלטה: ${args.title ?? "ללא כותרת"}${speakerHint}\n\nתמלול:\n${t}`;
}

async function callClaude(args: {
  title: string | null;
  transcript_text: string;
  speakerLabels: Record<number, string>;
  promptOverrides: Record<string, string | null | undefined> | null;
  customPrompt?: string;
}): Promise<AiOutput> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set on this edge function. Add it under " +
        "Supabase Dashboard → Edge Functions → Secrets."
    );
  }
  const systemPrompt = buildSystemPrompt(args.promptOverrides, args.customPrompt);
  const hasOverrides =
    args.customPrompt ||
    (args.promptOverrides &&
      Object.values(args.promptOverrides).some((v) => v && v.trim().length > 0));
  // Tool-use forces a structured object output. Without this the model
  // sometimes returned slightly-malformed JSON (unescaped newlines mid-
  // string, smart quotes, etc.) and our `JSON.parse(text)` blew up. With
  // tool_choice locked to this tool, the API returns the parsed object as
  // `tool_use.input` directly — no string parsing on our side.
  const reportTool = {
    name: "report_analysis",
    description:
      "Returns the structured analysis of the conversation transcript.",
    input_schema: {
      type: "object",
      properties: {
        short_summary: { type: "string" },
        long_summary: { type: "string" },
        whatsapp_message: { type: "string" },
        email: {
          type: "object",
          properties: {
            subject: { type: "string" },
            body: { type: "string" },
          },
          required: ["subject", "body"],
        },
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              speaker_name: { type: ["string", "null"] },
              speaker_index: { type: ["number", "null"] },
              priority: {
                type: "string",
                enum: ["low", "normal", "high"],
              },
              due_hint: { type: ["string", "null"] },
            },
            required: ["title"],
          },
        },
        events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              date_iso: { type: ["string", "null"] },
              duration_minutes: { type: ["number", "null"] },
              speaker_name: { type: ["string", "null"] },
            },
            required: ["title"],
          },
        },
      },
      required: [
        "short_summary",
        "long_summary",
        "whatsapp_message",
        "email",
        "tasks",
        "events",
      ],
    },
  };
  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: [
      hasOverrides
        ? { type: "text", text: systemPrompt }
        : {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
    ],
    tools: [reportTool],
    tool_choice: { type: "tool", name: "report_analysis" },
    messages: [
      {
        role: "user",
        content: buildUserPrompt(args),
      },
    ],
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`anthropic_${res.status}: ${text.slice(0, 500)}`);
  }
  const json = (await res.json()) as {
    content?: Array<{
      type: string;
      text?: string;
      name?: string;
      input?: unknown;
    }>;
  };
  const toolBlock = json.content?.find(
    (b) => b.type === "tool_use" && b.name === "report_analysis"
  );
  if (!toolBlock?.input) {
    throw new Error("anthropic_no_tool_use_block");
  }
  return toolBlock.input as AiOutput;
}

async function summarizeHandler(
  req: Request,
  ctx: MembershipContext
): Promise<Response> {
  const origin = req.headers.get("origin");
  const body = (await req.json().catch(() => null)) as
    | { recording_id?: string; custom_prompt?: string }
    | null;
  if (!body?.recording_id) {
    return jsonResponse(
      { error: "missing_fields", required: ["recording_id"] },
      { status: 400, origin }
    );
  }

  const { data: recording, error: recErr } = await ctx.serviceClient
    .from("recordings")
    .select(
      "id, organization_id, status, title, transcript_text, transcript_json"
    )
    .eq("id", body.recording_id)
    .maybeSingle();
  if (recErr || !recording) {
    return jsonResponse({ error: "recording_not_found" }, { status: 404, origin });
  }
  if (recording.organization_id !== ctx.organizationId) {
    return jsonResponse({ error: "recording_outside_org" }, { status: 403, origin });
  }
  if (!recording.transcript_text || !recording.transcript_text.trim()) {
    return jsonResponse(
      { error: "no_transcript_yet", hint: "trigger transcription first" },
      { status: 409, origin }
    );
  }

  // Pull speaker labels — passing them to Claude tightens task attribution.
  const { data: speakers } = await ctx.serviceClient
    .from("recording_speakers")
    .select("speaker_index, label")
    .eq("recording_id", recording.id);
  const speakerLabels: Record<number, string> = {};
  for (const s of speakers ?? []) {
    if (s.label?.trim()) speakerLabels[s.speaker_index] = s.label.trim();
  }

  // Pull the recording owner's per-user prompt overrides (if any). Empty /
  // missing keys fall back to the defaults inlined above.
  const { data: prefs } = await ctx.serviceClient
    .from("user_thought_preferences")
    .select("recording_ai_prompts")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  const promptOverrides =
    (prefs?.recording_ai_prompts as Record<string, string> | null) ?? null;

  // Mark in-flight so the UI shows "בעיבוד".
  await ctx.serviceClient
    .from("recordings")
    .update({ ai_status: "pending", status: "processing", error_message: null })
    .eq("id", recording.id);

  const customPromptText = (body.custom_prompt ?? "").trim();

  let aiOutput: AiOutput;
  try {
    aiOutput = await callClaude({
      title: recording.title,
      transcript_text: recording.transcript_text,
      speakerLabels,
      promptOverrides,
      customPrompt: customPromptText || undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.serviceClient
      .from("recordings")
      .update({ ai_status: "error", status: "ready", error_message: msg })
      .eq("id", recording.id);
    console.error("summarize_failed", { recording_id: recording.id, err: msg });
    return jsonResponse({ error: "summarize_failed", message: msg }, {
      status: 502,
      origin,
    });
  }

  const { data: updated, error: updErr } = await ctx.serviceClient
    .from("recordings")
    .update({
      ai_output: aiOutput as unknown as Record<string, unknown>,
      ai_output_at: new Date().toISOString(),
      ai_status: "ready",
      status: "processed",
      error_message: null,
    })
    .eq("id", recording.id)
    .select()
    .single();
  if (updErr) {
    console.error("summarize_db_update_failed", updErr);
    return jsonResponse({ error: "db_update_failed" }, { status: 500, origin });
  }

  return jsonResponse({ ok: true, recording: updated }, { origin });
}

serve(async (req) => {
  const cors = preflight(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return jsonResponse(
      { error: "method_not_allowed" },
      { status: 405, origin: req.headers.get("origin") }
    );
  }
  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  try {
    return await summarizeHandler(req, auth.ctx);
  } catch (err) {
    console.error("summarize_unhandled", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500, origin: req.headers.get("origin") }
    );
  }
});
