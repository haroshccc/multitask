// Extract-Questions Edge Function — Claude-powered open-question extraction
// from a recording's transcript. Used by the project page to populate the
// QuestionsBlock from a customer call without manual data entry.
//
// SPEC §20.9: "יכולות לחלץ אוטומטית מתמלול הקלטה ... כל שאלה: טקסט · תגים ·
// תשובה (nullable) · קישור למשימה". This is the post-MVP "auto-extract" path
// the spec called out.
//
// Endpoint:
//   POST /extract-questions  — { recording_id, project_id?, replace? } →
//     creates `questions` rows for every distinct question Claude finds in
//     the transcript. Returns the inserted rows.
//
// Behavior:
//   - If `project_id` is provided, the new questions inherit it. Otherwise
//     we fall back to `recordings.project_id` (set when the recording was
//     uploaded from the project page).
//   - `replace=true` first deletes any existing questions tied to the same
//     recording (so re-running doesn't pile up duplicates after a transcript
//     edit). `replace=false` (default) appends.
//   - Empty/no questions: writes nothing, returns count: 0 — not an error.
//
// Required Supabase secrets:
//   ANTHROPIC_API_KEY
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are auto-injected)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { jsonResponse, preflight } from "../_shared/cors.ts";
import { requireMember, type MembershipContext } from "../_shared/auth.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const MAX_TRANSCRIPT_CHARS = 80_000;

interface ExtractedQuestion {
  text: string;
  /** Optional context tags Claude can attach: e.g. ["תכולה", "לוח זמנים"]. */
  tags?: string[];
  /**
   * If Claude believes the questioner already answered themselves later in
   * the conversation, the answer text. We persist it on the row so the UI
   * shows the question + answer as already-answered (line-through state).
   */
  answer?: string | null;
}

interface ExtractedPayload {
  questions: ExtractedQuestion[];
}

const SYSTEM_PROMPT = `אתה עוזר אישי שמנתח שיחות מתומללות בעברית. המשתמשת הקליטה שיחה עם לקוח / שותף, ואת צריכה לחלץ ממנה את כל השאלות הפתוחות שעלו ועדיין מצריכות מענה.

הנחיות:
- כל הטקסט בעברית בלבד.
- שאלה היא בקשת מידע שנשארה בלי תשובה (או שהיא מהותית מספיק לעקוב אחריה אחר־כך) — לא רק אינטונציה של שאלה. דוגמאות:
  • "מה התקציב המרבי?" — שאלה.
  • "אפשר לקבוע ל-15?" — שאלה.
  • "אז דיברנו על UX?" — לא שאלה (אישור).
- אם השאלה נענתה במהלך השיחה, שמור/שמרי את התשובה ב-answer (טקסט קצר). אחרת answer=null.
- שאלות "בערך אותן" אחרי כן (פעמיים אותו דבר) — מאחדים לשאלה אחת.
- אם נראה שאין שאלות פתוחות בכלל — מחזירים מערך ריק. לא ממציאים.
- כל שאלה מקסימום 200 תווים. אם נשמעה בצורה ארוכה — מקצרים לתמצית.
- tags: מומלץ 1–3 תגים קצרים (למשל ["תקציב"], ["לוח זמנים", "אישורים"]) — אם אין מובן, השאר/י מערך ריק.

החזר/י JSON תקני בלבד דרך הכלי report_questions, ללא מלל סביב.`;

async function callClaude(args: {
  title: string | null;
  transcript_text: string;
  speakerLabels: Record<number, string>;
}): Promise<ExtractedPayload> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it under Supabase Dashboard → " +
        "Edge Functions → Secrets."
    );
  }
  const reportTool = {
    name: "report_questions",
    description:
      "Returns the open questions extracted from the conversation transcript.",
    input_schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
              answer: { type: ["string", "null"] },
            },
            required: ["text"],
          },
        },
      },
      required: ["questions"],
    },
  };

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
  const userPrompt = `כותרת ההקלטה: ${args.title ?? "ללא כותרת"}${speakerHint}\n\nתמלול:\n${t}`;

  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [reportTool],
    tool_choice: { type: "tool", name: "report_questions" },
    messages: [{ role: "user", content: userPrompt }],
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
    (b) => b.type === "tool_use" && b.name === "report_questions"
  );
  if (!toolBlock?.input) {
    throw new Error("anthropic_no_tool_use_block");
  }
  return toolBlock.input as ExtractedPayload;
}

async function extractHandler(
  req: Request,
  ctx: MembershipContext
): Promise<Response> {
  const origin = req.headers.get("origin");
  const body = (await req.json().catch(() => null)) as
    | { recording_id?: string; project_id?: string; replace?: boolean }
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
      "id, organization_id, project_id, title, transcript_text"
    )
    .eq("id", body.recording_id)
    .maybeSingle();
  if (recErr || !recording) {
    return jsonResponse(
      { error: "recording_not_found" },
      { status: 404, origin }
    );
  }
  if (recording.organization_id !== ctx.organizationId) {
    return jsonResponse(
      { error: "recording_outside_org" },
      { status: 403, origin }
    );
  }
  if (!recording.transcript_text || !recording.transcript_text.trim()) {
    return jsonResponse(
      { error: "no_transcript_yet", hint: "trigger transcription first" },
      { status: 409, origin }
    );
  }

  const projectId =
    (body.project_id ?? recording.project_id ?? null) as string | null;
  if (!projectId) {
    return jsonResponse(
      {
        error: "missing_project_id",
        hint: "recording is not tagged to a project; pass project_id explicitly",
      },
      { status: 400, origin }
    );
  }

  // Pull speaker labels for tighter prompts.
  const { data: speakers } = await ctx.serviceClient
    .from("recording_speakers")
    .select("speaker_index, label")
    .eq("recording_id", recording.id);
  const speakerLabels: Record<number, string> = {};
  for (const s of speakers ?? []) {
    if (s.label?.trim()) speakerLabels[s.speaker_index] = s.label.trim();
  }

  let extracted: ExtractedPayload;
  try {
    extracted = await callClaude({
      title: recording.title,
      transcript_text: recording.transcript_text,
      speakerLabels,
    });
  } catch (err) {
    return jsonResponse(
      { error: "ai_call_failed", detail: String(err) },
      { status: 502, origin }
    );
  }

  // Optional: remove any prior questions extracted from this same recording so
  // re-running after a transcript edit doesn't double-up.
  if (body.replace) {
    await ctx.serviceClient
      .from("questions")
      .delete()
      .eq("source_recording_id", recording.id)
      .eq("project_id", projectId);
  }

  // Find the largest existing sort_order so new ones land at the end.
  const { data: lastQ } = await ctx.serviceClient
    .from("questions")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const baseSortOrder = ((lastQ?.[0]?.sort_order as number | undefined) ?? 0) + 1000;

  const rows = extracted.questions
    .map((q) => q.text?.trim())
    .filter((t): t is string => !!t && t.length > 0)
    .map((text, i) => {
      const original = extracted.questions[i];
      return {
        organization_id: ctx.organizationId,
        owner_id: ctx.userId,
        project_id: projectId,
        source_recording_id: recording.id,
        text: text.slice(0, 500),
        answer: original.answer?.trim() || null,
        answered_at: original.answer?.trim() ? new Date().toISOString() : null,
        answered_by_user_id: original.answer?.trim() ? ctx.userId : null,
        tags: Array.isArray(original.tags)
          ? original.tags.filter((t) => typeof t === "string").slice(0, 5)
          : [],
        sort_order: baseSortOrder + i * 1000,
      };
    });

  if (rows.length === 0) {
    return jsonResponse(
      { count: 0, questions: [] },
      { status: 200, origin }
    );
  }

  const { data: inserted, error: insErr } = await ctx.serviceClient
    .from("questions")
    .insert(rows)
    .select();
  if (insErr) {
    return jsonResponse(
      { error: "insert_failed", detail: insErr.message },
      { status: 500, origin }
    );
  }

  return jsonResponse(
    { count: inserted?.length ?? 0, questions: inserted ?? [] },
    { status: 200, origin }
  );
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") {
    return jsonResponse(
      { error: "method_not_allowed" },
      { status: 405, origin: req.headers.get("origin") }
    );
  }
  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;
  return extractHandler(req, auth.ctx);
});
