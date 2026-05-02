// Daily Brief Edge Function — Phase 8.2 (read-only) + Phase 8.3 (proposals).
//
// Given a (view, anchor) tuple, this function:
//   1. Computes the date range for the period.
//   2. Pulls the user's tasks / events / recordings / thoughts / time entries
//      that fall in that range (service-role, scoped by organization_id).
//   3. Sends a compact Hebrew context to Claude Sonnet 4.6 (with tool-use)
//      asking for a structured analysis of the period.
//   4. Phase 8.3: also asks for actionable `proposals[]` — moves, schedules,
//      new events, day reorderings — each tagged with kind + payload + reason.
//      The frontend renders these as approve/dismiss/edit cards; nothing is
//      executed server-side.
//   5. Upserts the result into `public.daily_briefs` so subsequent loads
//      are instant + cheap.
//
// Endpoint:
//   POST /daily-brief        — { view, anchor } → returns the brief row.
//
// Required Supabase secrets (Settings → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY      — keys.anthropic.com
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are auto-injected)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { jsonResponse, preflight } from "../_shared/cors.ts";
import { requireMember, type MembershipContext } from "../_shared/auth.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

type View = "day" | "week" | "month";

// -----------------------------------------------------------------------------
// Period helpers — must mirror `useDateRange.ts` so the cache key matches.

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}
function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getUTCDay();
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}
function rangeFor(view: View, anchorIso: string): { from: string; to: string } {
  const anchor = parseIsoDate(anchorIso);
  if (view === "day") {
    const from = anchor;
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (view === "week") {
    const from = startOfWeek(anchor);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 7);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  // month
  const from = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const to = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

// -----------------------------------------------------------------------------
// Anthropic types we care about

interface BriefOutput {
  summary: string;
  headline?: string;
  people_summary: Array<{
    person: string;
    context: string;
    recording_ids?: string[];
    event_ids?: string[];
  }>;
  recordings_digest: string;
  productive_hours_insight: string;
  recommendations: Array<{
    title: string;
    description: string;
    category: "time" | "tasks" | "meetings" | "general";
  }>;
}

type ProposalKind =
  | "move_task"
  | "schedule_task"
  | "create_event"
  | "reorder_day"
  | "complete_task"
  | "split_task";

interface RawProposal {
  id?: string;
  kind: ProposalKind;
  reason: string;
  payload: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Context aggregation — pulls all entities in the period and serialises them
// to a compact Hebrew block for Claude's user message.

interface ContextPayload {
  rangeLabel: string;
  view: View;
  anchorIso: string;
  fromIso: string;
  toIso: string;
  contextText: string;
  membersById: Record<string, string>;
  /** Entity ids referenced in the prompt — used to validate AI proposals. */
  knownTaskIds: Set<string>;
  knownEventIds: Set<string>;
  knownRecordingIds: Set<string>;
}

const HE_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

function periodLabel(view: View, fromIso: string, toIso: string): string {
  const f = new Date(fromIso);
  const t = new Date(toIso);
  if (view === "day") {
    return `${f.getUTCDate()} ${HE_MONTHS[f.getUTCMonth()]} ${f.getUTCFullYear()}`;
  }
  if (view === "week") {
    const lastDay = new Date(t);
    lastDay.setUTCDate(lastDay.getUTCDate() - 1);
    return `${f.getUTCDate()} ${HE_MONTHS[f.getUTCMonth()]} – ${lastDay.getUTCDate()} ${HE_MONTHS[lastDay.getUTCMonth()]} ${lastDay.getUTCFullYear()}`;
  }
  return `${HE_MONTHS[f.getUTCMonth()]} ${f.getUTCFullYear()}`;
}

function fmtTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} דק'`;
  return `${Math.floor(m / 60)}:${pad(m % 60)} שע'`;
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n) + "…";
}

async function gatherContext(
  ctx: MembershipContext,
  view: View,
  anchorIso: string,
  /** Optional client-provided range — preserves the user's local-tz semantics
   *  the dashboard widgets use. Falls back to UTC interpretation of `anchorIso`
   *  if missing (e.g. when an admin invokes the function directly).
   */
  rangeOverride?: { from?: string; to?: string }
): Promise<ContextPayload> {
  const computed = rangeFor(view, anchorIso);
  const range = {
    from: rangeOverride?.from ?? computed.from,
    to: rangeOverride?.to ?? computed.to,
  };
  const sb = ctx.serviceClient;

  // Tasks: scheduled OR completed OR created in range; or scheduled-and-overdue.
  // Pull all tasks in org and slice — same pattern as the dashboard widgets.
  // Limited to the org so we don't pull other members' private tasks unless
  // the requester has access via shares (RLS would normally enforce this; here
  // we use service-role and re-filter by `organization_id`).
  const { data: tasksRaw } = await sb
    .from("tasks")
    .select(
      "id, title, status, scheduled_at, completed_at, created_at, duration_minutes, urgency, parent_task_id, task_list_id, assignee_user_id, owner_id"
    )
    .eq("organization_id", ctx.organizationId)
    .or(
      `scheduled_at.gte.${range.from},completed_at.gte.${range.from},created_at.gte.${range.from}`
    )
    .or(
      `scheduled_at.lt.${range.to},completed_at.lt.${range.to},created_at.lt.${range.to}`
    )
    .order("scheduled_at", { ascending: true })
    .limit(200);

  // Defensive — Postgres `or` with two `.or()` chains can be flaky on some
  // server versions. Fall back to broad pull + JS filter if the above failed.
  const tasksAll = tasksRaw ?? [];

  // Tasks lists for human-readable context
  const listIds = Array.from(
    new Set(tasksAll.map((t) => t.task_list_id).filter(Boolean) as string[])
  );
  const listMap = new Map<string, { name: string; emoji: string | null }>();
  if (listIds.length > 0) {
    const { data: lists } = await sb
      .from("task_lists")
      .select("id, name, emoji")
      .in("id", listIds);
    for (const l of lists ?? []) {
      listMap.set(l.id, { name: l.name, emoji: l.emoji });
    }
  }

  // Events
  const { data: events } = await sb
    .from("events")
    .select("id, title, description, location, starts_at, ends_at, video_call_url, owner_id")
    .eq("organization_id", ctx.organizationId)
    .gte("starts_at", range.from)
    .lt("starts_at", range.to)
    .order("starts_at", { ascending: true })
    .limit(60);

  // Event participants
  const eventIds = (events ?? []).map((e) => e.id);
  const participantsByEvent = new Map<string, string[]>();
  if (eventIds.length > 0) {
    const { data: participants } = await sb
      .from("event_participants")
      .select("event_id, user_id")
      .in("event_id", eventIds);
    for (const p of participants ?? []) {
      if (!participantsByEvent.has(p.event_id))
        participantsByEvent.set(p.event_id, []);
      participantsByEvent.get(p.event_id)!.push(p.user_id);
    }
  }

  // Recordings
  const { data: recordingsRaw } = await sb
    .from("recordings")
    .select(
      "id, title, source, duration_seconds, created_at, summary, ai_output, ai_status"
    )
    .eq("organization_id", ctx.organizationId)
    .is("merged_into", null)
    .gte("created_at", range.from)
    .lt("created_at", range.to)
    .order("created_at", { ascending: true })
    .limit(40);
  const recordings = recordingsRaw ?? [];

  // Speakers per recording
  const recordingIds = recordings.map((r) => r.id);
  const speakersByRecording = new Map<string, Array<{ idx: number; label: string }>>();
  if (recordingIds.length > 0) {
    const { data: speakers } = await sb
      .from("recording_speakers")
      .select("recording_id, speaker_index, label")
      .in("recording_id", recordingIds);
    for (const s of speakers ?? []) {
      if (!s.label) continue;
      if (!speakersByRecording.has(s.recording_id))
        speakersByRecording.set(s.recording_id, []);
      speakersByRecording
        .get(s.recording_id)!
        .push({ idx: s.speaker_index, label: s.label });
    }
  }

  // Thoughts
  const { data: thoughtsRaw } = await sb
    .from("thoughts")
    .select("id, source, text_content, ai_generated_title, processed_at, created_at")
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .gte("created_at", range.from)
    .lt("created_at", range.to)
    .order("created_at", { ascending: true })
    .limit(80);
  const thoughts = thoughtsRaw ?? [];

  // Time entries — used for productive-hours insight + per-task summary.
  const { data: timeRaw } = await sb
    .from("time_entries")
    .select("id, task_id, started_at, ended_at, duration_seconds, user_id")
    .eq("organization_id", ctx.organizationId)
    .gte("started_at", range.from)
    .lt("started_at", range.to)
    .limit(500);
  const entries = timeRaw ?? [];

  // Org members — to map user_id → display name in the context.
  const { data: members } = await sb
    .from("organization_members")
    .select("user_id, profiles:user_id (full_name, email)")
    .eq("organization_id", ctx.organizationId);
  const membersById: Record<string, string> = {};
  for (const m of (members ?? []) as Array<{
    user_id: string;
    profiles?: { full_name?: string | null; email?: string | null };
  }>) {
    membersById[m.user_id] =
      m.profiles?.full_name?.trim() || m.profiles?.email || m.user_id.slice(0, 6);
  }
  // Mark current user explicitly.
  membersById[ctx.userId] = `${membersById[ctx.userId] ?? "אני"} (אני)`;

  // -- Build the compact text context ---------------------------------------
  const lines: string[] = [];
  const rangeLabel = periodLabel(view, range.from, range.to);
  lines.push(`תקופה: ${rangeLabel} (תצוגה: ${view})`);
  lines.push(`טווח ISO: ${range.from} → ${range.to}`);
  lines.push("");

  // Tasks
  const tasksScheduled = tasksAll.filter(
    (t) =>
      t.scheduled_at &&
      t.scheduled_at >= range.from &&
      t.scheduled_at < range.to
  );
  const tasksCompleted = tasksAll.filter(
    (t) =>
      t.completed_at &&
      t.completed_at >= range.from &&
      t.completed_at < range.to
  );
  const tasksCreated = tasksAll.filter(
    (t) =>
      t.created_at >= range.from &&
      t.created_at < range.to
  );
  const tasksOverdue = tasksScheduled.filter(
    (t) =>
      !t.completed_at &&
      t.scheduled_at! < new Date().toISOString()
  );
  const knownTaskIds = new Set<string>(tasksAll.map((t) => t.id));

  lines.push(`== משימות ==`);
  lines.push(`- הושלמו: ${tasksCompleted.length}`);
  lines.push(`- מתוזמנות בטווח: ${tasksScheduled.length}`);
  lines.push(`- חדשות שנוצרו: ${tasksCreated.length}`);
  lines.push(`- באיחור (זמן עבר): ${tasksOverdue.length}`);
  if (tasksScheduled.length > 0) {
    lines.push("");
    lines.push("מתוזמנות:");
    for (const t of tasksScheduled.slice(0, 50)) {
      const list = t.task_list_id ? listMap.get(t.task_list_id) : null;
      const listLabel = list ? `[${list.emoji ?? ""}${list.name}]` : "";
      const done = t.completed_at ? "✓" : t.scheduled_at! < new Date().toISOString() ? "⏰" : "○";
      const dur = t.duration_minutes ? `${t.duration_minutes}ד` : "";
      lines.push(
        `  ${done} task:${t.id} | ${fmtTimestamp(t.scheduled_at)} ${dur} | ${truncate(t.title, 80)} ${listLabel}`
      );
    }
  }
  if (tasksCompleted.length > 0 && tasksCompleted.some((t) => !tasksScheduled.find((s) => s.id === t.id))) {
    lines.push("");
    lines.push("הושלמו (שלא הופיעו במתוזמנות):");
    for (const t of tasksCompleted) {
      if (tasksScheduled.find((s) => s.id === t.id)) continue;
      lines.push(
        `  ✓ task:${t.id} | ${fmtTimestamp(t.completed_at)} | ${truncate(t.title, 80)}`
      );
    }
  }
  lines.push("");

  // Events
  const knownEventIds = new Set<string>((events ?? []).map((e) => e.id));
  lines.push(`== אירועים ==`);
  if (!events || events.length === 0) {
    lines.push("אין אירועים בטווח.");
  } else {
    for (const e of events) {
      const dur = e.starts_at && e.ends_at
        ? fmtDuration((new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime()) / 1000)
        : "—";
      const participants = (participantsByEvent.get(e.id) ?? [])
        .map((id) => membersById[id] ?? id.slice(0, 6))
        .join(", ");
      const meet = e.video_call_url ? " 🎥" : "";
      lines.push(
        `- event:${e.id} | ${fmtTimestamp(e.starts_at)} (${dur})${meet} | ${truncate(e.title, 80)}${
          participants ? ` | משתתפים: ${participants}` : ""
        }${e.location ? ` | מיקום: ${truncate(e.location, 40)}` : ""}`
      );
    }
  }
  lines.push("");

  // Recordings
  const knownRecordingIds = new Set<string>(recordings.map((r) => r.id));
  lines.push(`== הקלטות ==`);
  if (recordings.length === 0) {
    lines.push("אין הקלטות בטווח.");
  } else {
    for (const r of recordings) {
      const speakers = (speakersByRecording.get(r.id) ?? [])
        .map((s) => `${s.idx}=${s.label}`)
        .join(", ");
      lines.push(
        `- rec:${r.id} | ${fmtTimestamp(r.created_at)} (${fmtDuration(r.duration_seconds)}) | ${
          r.source
        } | ${truncate(r.title ?? "ללא כותרת", 60)}${speakers ? ` | דוברים: ${speakers}` : ""}`
      );
      // Pull short summary from ai_output if available, else from summary col.
      const aiOut = r.ai_output as { short_summary?: string; long_summary?: string } | null;
      const shortSum = aiOut?.short_summary || r.summary;
      if (shortSum) {
        lines.push(`  סיכום: ${truncate(shortSum, 280)}`);
      }
    }
  }
  lines.push("");

  // Thoughts
  lines.push(`== מחשבות ==`);
  if (thoughts.length === 0) {
    lines.push("אין מחשבות בטווח.");
  } else {
    const processed = thoughts.filter((t) => t.processed_at).length;
    lines.push(
      `סה״כ ${thoughts.length} (${processed} מעובדות, ${thoughts.length - processed} לא).`
    );
    for (const t of thoughts.slice(0, 30)) {
      const tag = t.processed_at ? "✓" : "○";
      lines.push(
        `  ${tag} thought:${t.id} | ${t.source} | ${truncate(
          t.ai_generated_title ?? t.text_content ?? "",
          120
        )}`
      );
    }
  }
  lines.push("");

  // Time entries → daily totals + per-hour heat for "productive hours"
  let totalSeconds = 0;
  const dayMap = new Map<string, number>();
  const hourMap = new Map<number, number>();
  for (const e of entries) {
    if (!e.duration_seconds || !e.started_at) continue;
    if (e.user_id !== ctx.userId) continue; // only the requesting user's tracking
    totalSeconds += e.duration_seconds;
    const d = new Date(e.started_at);
    const k = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    dayMap.set(k, (dayMap.get(k) ?? 0) + e.duration_seconds);
    hourMap.set(d.getUTCHours(), (hourMap.get(d.getUTCHours()) ?? 0) + e.duration_seconds);
  }
  let bestHour = -1;
  let bestHourSec = 0;
  for (const [h, s] of hourMap) {
    if (s > bestHourSec) {
      bestHour = h;
      bestHourSec = s;
    }
  }
  lines.push(`== זמן עבודה ==`);
  lines.push(`- סה״כ: ${fmtDuration(totalSeconds)}`);
  lines.push(`- ימים פעילים: ${dayMap.size}`);
  lines.push(
    `- שעת שיא (UTC): ${bestHour >= 0 ? `${pad(bestHour)}:00 (${fmtDuration(bestHourSec)})` : "—"}`
  );
  if (dayMap.size > 1) {
    lines.push("- פירוט יומי:");
    const sorted = Array.from(dayMap.entries()).sort();
    for (const [day, s] of sorted) {
      lines.push(`    ${day}: ${fmtDuration(s)}`);
    }
  }

  return {
    rangeLabel,
    view,
    anchorIso,
    fromIso: range.from,
    toIso: range.to,
    contextText: lines.join("\n"),
    membersById,
    knownTaskIds,
    knownEventIds,
    knownRecordingIds,
  };
}

// -----------------------------------------------------------------------------
// Anthropic call

const SYSTEM_PROMPT = `את עוזרת אישית לאפליקציית פרודוקטיביות בעברית בשם Multitask.
המשתמשת היא בעלת המוצר ואת מסכמת לה את התקופה הנוכחית מהדאטה שלה: משימות, אירועים, הקלטות, מחשבות וזמן עבודה.

עקרונות:
- כל הטקסט החופשי בעברית בלבד.
- אל תמציאי נתונים שלא מופיעים בקלט. אם משהו ריק — תכתבי מחרוזת ריקה / מערך ריק.
- ה"summary" הוא משפט אחד עד שניים שמתאר מה היה בתקופה.
- "headline" הוא משפט אחד עוצמתי — הדבר הכי חשוב מהתקופה (אופציונלי, רק אם יש משהו שבולט).
- "people_summary" — לכל אדם שדובר/שותף לאירוע/הוזכר בהקלטה: שם + 1-2 משפטי הקשר על מה דובר. השם נלקח מתיוג הדוברים, מהמשתתפים באירועים, או מהקטעים שב-membersById.
- "recordings_digest" — סיכום-על של ההקלטות בתקופה (פסקה אחת, לא רשימה). אם אין הקלטות — מחרוזת ריקה.
- "productive_hours_insight" — תובנה אחת על השעות היעילות, המבוססת על שעת השיא + פירוט יומי.
- "recommendations" — 2-5 המלצות פרקטיות לתקופה הבאה. כל המלצה: title קצר + description (1-2 משפטים) + category.

הצעות פעולה (proposals) — חשוב מאוד:
- מותר להציע פעולות **רק** עם entity ids שמופיעות במפורש בקלט: task:<id>, event:<id>, rec:<id>.
- כל הצעה היא **טיוטה**, לא ביצוע — המשתמשת תאשר לפני שמשהו קורה. תני תזמון מוצע רגיל, ואל תפחדי להציע.
- סוגי הצעות:
  - move_task: משימה כבר מתוזמנת אבל הזמן שלה לא מתאים (חרגה / יום עמוס) → להעביר ל-new_scheduled_at.
  - schedule_task: משימה ללא scheduled_at שכדאי לתזמן.
  - create_event: יצירת אירוע חדש שעלה במחשבה / הקלטה (כותרת, starts_at, ends_at, ואופציונלי description/location).
  - reorder_day: סידור מחדש של כמה משימות באותו יום (למשל בוקר/אחה"צ/ערב).
  - complete_task: משימה שכנראה הושלמה אבל לא סומנה (זוהתה בהקלטה/מחשבה).
  - split_task: משימה גדולה שכדאי לפצל ל-2-4 חלקים.
- לכל הצעה, "reason" זה משפט אחד מסביר.
- אל תציעי יותר מ-6 הצעות בסך הכל. עדיף איכות על כמות.
- ב-payload שמחזירה — השתמשי ב-id המדויק שראית (UUID מלא, לא קוצר).
- אם אין הצעות שמתאימות, החזירי מערך ריק.

הקלט הוא טקסט מובנה למחצה עם רשימות של ישויות, כל אחת עם id מדויק (task:<uuid>, event:<uuid>, rec:<uuid>, thought:<uuid>).
`;

const TOOL_SCHEMA = {
  name: "report_brief",
  description: "Returns the structured analysis + actionable proposals.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      headline: { type: ["string", "null"] },
      people_summary: {
        type: "array",
        items: {
          type: "object",
          properties: {
            person: { type: "string" },
            context: { type: "string" },
            recording_ids: { type: "array", items: { type: "string" } },
            event_ids: { type: "array", items: { type: "string" } },
          },
          required: ["person", "context"],
        },
      },
      recordings_digest: { type: "string" },
      productive_hours_insight: { type: "string" },
      recommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            category: {
              type: "string",
              enum: ["time", "tasks", "meetings", "general"],
            },
          },
          required: ["title", "description", "category"],
        },
      },
      proposals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: [
                "move_task",
                "schedule_task",
                "create_event",
                "reorder_day",
                "complete_task",
                "split_task",
              ],
            },
            reason: { type: "string" },
            payload: { type: "object" },
          },
          required: ["kind", "reason", "payload"],
        },
      },
    },
    required: [
      "summary",
      "people_summary",
      "recordings_digest",
      "productive_hours_insight",
      "recommendations",
      "proposals",
    ],
  },
};

interface ClaudeReturn {
  output: BriefOutput;
  proposals: RawProposal[];
  inputTokens: number | null;
  outputTokens: number | null;
}

async function callClaude(contextText: string): Promise<ClaudeReturn> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add under Supabase Dashboard → Edge Functions → Secrets."
    );
  }
  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: 3072,
    system: [
      // Cache the static system prompt so repeated calls are cheap.
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    tools: [TOOL_SCHEMA],
    tool_choice: { type: "tool", name: "report_brief" },
    messages: [
      {
        role: "user",
        content: `נתוני התקופה:\n\n${contextText}`,
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
    content?: Array<{ type: string; name?: string; input?: unknown }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const tool = json.content?.find(
    (b) => b.type === "tool_use" && b.name === "report_brief"
  );
  if (!tool?.input) {
    throw new Error("anthropic_no_tool_use_block");
  }
  const out = tool.input as BriefOutput & { proposals: RawProposal[] };
  return {
    output: {
      summary: out.summary ?? "",
      headline: out.headline ?? undefined,
      people_summary: out.people_summary ?? [],
      recordings_digest: out.recordings_digest ?? "",
      productive_hours_insight: out.productive_hours_insight ?? "",
      recommendations: out.recommendations ?? [],
    },
    proposals: out.proposals ?? [],
    inputTokens: json.usage?.input_tokens ?? null,
    outputTokens: json.usage?.output_tokens ?? null,
  };
}

// -----------------------------------------------------------------------------
// Proposal validation — Claude can only act on entities it actually saw.

function uuidv4Like(): string {
  // RFC4122-ish — Deno's crypto.randomUUID is available.
  return crypto.randomUUID();
}

function validateProposals(
  raw: RawProposal[],
  ctx: ContextPayload
): Array<RawProposal & { id: string }> {
  const out: Array<RawProposal & { id: string }> = [];
  for (const p of raw) {
    const payload = p.payload ?? {};
    let ok = false;
    switch (p.kind) {
      case "move_task":
      case "schedule_task":
      case "complete_task": {
        const tid = String((payload as { task_id?: unknown }).task_id ?? "");
        ok = ctx.knownTaskIds.has(tid);
        break;
      }
      case "create_event": {
        const t = String((payload as { title?: unknown }).title ?? "").trim();
        const s = String((payload as { starts_at?: unknown }).starts_at ?? "");
        const e = String((payload as { ends_at?: unknown }).ends_at ?? "");
        ok = t.length > 0 && !!s && !!e;
        break;
      }
      case "reorder_day": {
        const moves = (payload as { moves?: Array<{ task_id?: string }> }).moves;
        ok =
          Array.isArray(moves) &&
          moves.length > 0 &&
          moves.every(
            (m) => typeof m.task_id === "string" && ctx.knownTaskIds.has(m.task_id)
          );
        break;
      }
      case "split_task": {
        const sid = String(
          (payload as { source_task_id?: unknown }).source_task_id ?? ""
        );
        const parts = (payload as { parts?: Array<{ title?: string }> }).parts;
        ok =
          ctx.knownTaskIds.has(sid) &&
          Array.isArray(parts) &&
          parts.length >= 2 &&
          parts.every((p) => typeof p.title === "string" && p.title.trim().length > 0);
        break;
      }
    }
    if (ok) out.push({ ...p, id: p.id ?? uuidv4Like() });
  }
  return out;
}

// -----------------------------------------------------------------------------
// Handler

async function handleBrief(
  req: Request,
  ctx: MembershipContext
): Promise<Response> {
  const origin = req.headers.get("origin");
  const body = (await req.json().catch(() => null)) as
    | {
        view?: View;
        anchor?: string;
        force?: boolean;
        from?: string;
        to?: string;
      }
    | null;
  if (!body?.view || !body.anchor) {
    return jsonResponse(
      { error: "missing_fields", required: ["view", "anchor"] },
      { status: 400, origin }
    );
  }
  if (!["day", "week", "month"].includes(body.view)) {
    return jsonResponse({ error: "invalid_view" }, { status: 400, origin });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.anchor)) {
    return jsonResponse({ error: "invalid_anchor" }, { status: 400, origin });
  }

  const sb = ctx.serviceClient;

  // Cache hit? Return immediately unless `force=true`.
  if (!body.force) {
    const { data: existing } = await sb
      .from("daily_briefs")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("organization_id", ctx.organizationId)
      .eq("view", body.view)
      .eq("anchor", body.anchor)
      .maybeSingle();
    if (existing) {
      return jsonResponse({ ok: true, brief: existing, cached: true }, { origin });
    }
  }

  // Build context, call Claude. Pass the client-supplied range so we honour
  // the user's local-tz "today" instead of UTC midnight.
  const context = await gatherContext(ctx, body.view, body.anchor, {
    from: body.from,
    to: body.to,
  });
  let claudeResult: ClaudeReturn;
  try {
    claudeResult = await callClaude(context.contextText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("daily_brief_claude_failed", { user: ctx.userId, err: msg });
    return jsonResponse({ error: "claude_failed", message: msg }, {
      status: 502,
      origin,
    });
  }

  const proposals = validateProposals(claudeResult.proposals, context);

  // Upsert into cache. ON CONFLICT (user_id, organization_id, view, anchor) → update.
  const { data: upserted, error: upErr } = await sb
    .from("daily_briefs")
    .upsert(
      {
        user_id: ctx.userId,
        organization_id: ctx.organizationId,
        view: body.view,
        anchor: body.anchor,
        output: claudeResult.output as unknown as Record<string, unknown>,
        proposals: proposals as unknown as Record<string, unknown>[],
        // Reset decisions when we regenerate — old proposal ids may not exist.
        proposal_decisions: {},
        generated_at: new Date().toISOString(),
        model: ANTHROPIC_MODEL,
        input_token_count: claudeResult.inputTokens,
        output_token_count: claudeResult.outputTokens,
      },
      { onConflict: "user_id,organization_id,view,anchor" }
    )
    .select()
    .single();

  if (upErr || !upserted) {
    console.error("daily_brief_upsert_failed", upErr);
    return jsonResponse({ error: "db_upsert_failed", message: upErr?.message }, {
      status: 500,
      origin,
    });
  }

  return jsonResponse({ ok: true, brief: upserted, cached: false }, { origin });
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
    return await handleBrief(req, auth.ctx);
  } catch (err) {
    console.error("daily_brief_unhandled", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500, origin: req.headers.get("origin") }
    );
  }
});
