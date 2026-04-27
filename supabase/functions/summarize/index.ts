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
  summary: string;
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
  key_decisions: Array<{ text: string }>;
  questions: Array<{ question: string; context?: string }>;
}

const SYSTEM_PROMPT = `אתה עוזר אישי שמנתח שיחות מתומללות בעברית. המשתמש (בעלת המוצר) הקליטה שיחה עם לקוח / שותף / חבר צוות, ועכשיו את צריכה לעבד את התמלול כדי להוציא ממנו ערך שימושי: סיכום, טיוטות הודעות מעקב, משימות, אירועים, החלטות מרכזיות ושאלות פתוחות.

דרישות:
- כל הטקסט החופשי בעברית בלבד.
- אל תמציא נתונים שאינם בתמלול.
- אם משימה נאמרה ע"י דובר מסוים, ציין/י את שמו (אם תויג ב-recording_speakers) או את מספר הדובר.
- תאריכים יחסיים ("מחר", "בעוד שבועיים") הופכים לרמז טקסטואלי ב-due_hint, לא לתאריך אבסולוטי.
- אם אין מידע מתאים לסעיף, החזר/י מערך ריק.

החזר/י JSON תקני בלבד התואם בדיוק לסכימה הבאה — בלי מלל לפני או אחרי, בלי בלוקי \`\`\`:

{
  "summary": string,
  "whatsapp_message": string,
  "email": { "subject": string, "body": string },
  "tasks": [
    { "title": string, "speaker_name": string | null, "speaker_index": number | null, "priority": "low" | "normal" | "high", "due_hint": string | null }
  ],
  "events": [
    { "title": string, "date_iso": string | null, "duration_minutes": number | null, "speaker_name": string | null }
  ],
  "key_decisions": [ { "text": string } ],
  "questions": [ { "question": string, "context": string } ]
}`;

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
}): Promise<AiOutput> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set on this edge function. Add it under " +
        "Supabase Dashboard → Edge Functions → Secrets."
    );
  }
  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: [
      // Static system prompt — wrapped in array form so we can mark it as a
      // cache breakpoint. Saves ~80% of input tokens on subsequent calls.
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
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
    content?: Array<{ type: string; text?: string }>;
  };
  const text = json.content?.find((b) => b.type === "text")?.text ?? "";
  if (!text) throw new Error("anthropic_empty_response");

  // Tolerate occasional ```json fences even though we asked for raw JSON.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`anthropic_unparseable_json: ${cleaned.slice(0, 300)}`);
  }
  return parsed as AiOutput;
}

async function summarizeHandler(
  req: Request,
  ctx: MembershipContext
): Promise<Response> {
  const origin = req.headers.get("origin");
  const body = (await req.json().catch(() => null)) as
    | { recording_id?: string }
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

  // Mark in-flight so the UI can disable retry buttons. Don't await failure.
  await ctx.serviceClient
    .from("recordings")
    .update({ ai_status: "pending", error_message: null })
    .eq("id", recording.id);

  let aiOutput: AiOutput;
  try {
    aiOutput = await callClaude({
      title: recording.title,
      transcript_text: recording.transcript_text,
      speakerLabels,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.serviceClient
      .from("recordings")
      .update({ ai_status: "error", error_message: msg })
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
