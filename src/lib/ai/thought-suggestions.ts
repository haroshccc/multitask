/**
 * AI adapter for the thoughts screen.
 *
 * Real Claude integration is its own phase. The `mockProvider` here is a
 * structured Hebrew-aware extractor that mimics the *output shape* the real
 * provider will produce — date parsing, all-day inference, task-list
 * matching, recipient extraction. The UI is built against the interface,
 * so swapping mock → real provider is a single-file change.
 */

import type { Thought, ThoughtList, TaskList } from "@/lib/types/domain";

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export interface SuggestedTask {
  title: string;
  description?: string;
  /** Suggested due date (ISO). Null = no specific date. */
  due_at?: string | null;
  /** AI-suggested list (matched against the user's task lists by name). */
  task_list_id?: string | null;
  task_list_name?: string | null;
  urgency?: number;
  tags?: string[];
}

export interface SuggestedEvent {
  title: string;
  description?: string;
  starts_at: string; // ISO
  ends_at: string; // ISO
  all_day: boolean;
}

export interface SuggestedProject {
  name: string;
  description?: string;
}

export interface SuggestedAssignment {
  list_id: string;
  list_name: string;
  reason: string;
}

export interface SuggestedMessage {
  recipient?: string;
  channel?: "whatsapp" | "email";
  body: string;
}

export type SuggestedAction =
  | {
      kind: "create_task";
      payload: SuggestedTask;
      reasoning: string;
      confidence: number;
    }
  | {
      kind: "create_event";
      payload: SuggestedEvent;
      reasoning: string;
      confidence: number;
    }
  | {
      kind: "create_project";
      payload: SuggestedProject;
      reasoning: string;
      confidence: number;
    }
  | {
      kind: "assign_list";
      payload: SuggestedAssignment;
      reasoning: string;
      confidence: number;
    }
  | {
      kind: "send_message";
      payload: SuggestedMessage;
      reasoning: string;
      confidence: number;
    };

export interface AiPlan {
  /** Short summary for the card title (≤ 60 chars). */
  title: string;
  /** Suggestions ordered by confidence, descending. */
  actions: SuggestedAction[];
}

export interface AiContext {
  /** All task lists the user has — names are used for the semantic match. */
  taskLists: TaskList[];
  /** All thought lists — used for "assign to thought list" suggestions. */
  thoughtLists: ThoughtList[];
}

export interface ThoughtAiProvider {
  generateTitle(text: string): Promise<string>;
  /** Returns a structured plan: title + ranked, pre-filled actions. */
  buildPlan(thought: Thought, ctx: AiContext): Promise<AiPlan>;
}

// -----------------------------------------------------------------------------
// Mock provider — Hebrew-aware extraction
// -----------------------------------------------------------------------------

const HEBREW_WEEKDAYS: Record<string, number> = {
  "ראשון": 0,
  "שני": 1,
  "שלישי": 2,
  "רביעי": 3,
  "חמישי": 4,
  "שישי": 5,
  "שבת": 6,
  // single-letter conventions: יום א', יום ב' etc.
  "א'": 0,
  "ב'": 1,
  "ג'": 2,
  "ד'": 3,
  "ה'": 4,
  "ו'": 5,
  "ש'": 6,
};

const ACTION_VERBS = [
  "לקנות",
  "להתקשר",
  "לשלוח",
  "לבדוק",
  "לסיים",
  "להכין",
  "לתאם",
  "להגיש",
  "לסדר",
  "לארגן",
  "להזמין",
  "להוריד",
  "לכתוב",
  "לקרוא",
  "לענות",
  "להחזיר",
];

/** Common Hebrew nouns → keyword buckets, used to score task lists. */
const LIST_KEYWORD_BUCKETS: Record<string, string[]> = {
  shopping: ["לקנות", "קניות", "מתנה", "סופר", "חנות"],
  work: ["פגישה", "לקוח", "פרויקט", "משרד", "דדליין", "הצעה", "חשבונית"],
  family: [
    "אמא",
    "אבא",
    "ילדים",
    "ילד",
    "ילדה",
    "סבא",
    "סבתא",
    "יום הולדת",
    "חתונה",
  ],
  health: ["רופא", "תור", "תרופה", "בדיקות", "בדיקה"],
  finance: ["תשלום", "חשבון", "בנק", "כסף", "מס"],
  errands: ["דואר", "מסמך", "טופס", "איסוף"],
};

const CHRONO_REL = {
  "היום": 0,
  "מחר": 1,
  "מחרתיים": 2,
  "אתמול": -1,
};

function todayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Resolve next occurrence of a weekday (0 = Sunday) starting from today. */
function nextWeekday(target: number, fromDate: Date = todayLocal()): Date {
  const d = new Date(fromDate);
  const today = d.getDay();
  let delta = (target - today + 7) % 7;
  if (delta === 0) delta = 7; // "next Wednesday" never returns today itself
  d.setDate(d.getDate() + delta);
  return d;
}

interface ExtractedDate {
  /** Date with time (or 00:00 if no time mentioned). */
  date: Date;
  /** True if the user did NOT mention a time of day. */
  allDay: boolean;
  /** Verbatim phrase from the text, for the "explanation" line. */
  raw: string;
}

/**
 * Best-effort Hebrew date extractor. Patterns it understands:
 *   - "היום", "מחר", "מחרתיים", "אתמול"
 *   - "ביום רביעי הקרוב" / "ביום רביעי" / "ברביעי"
 *   - "ב-15/4" / "ב-15.4" / "ב-15/4/2026"
 *   - "ב-15 לחודש" / "ב-15 בחודש"
 *   - times: "ב-10", "ב-10:30", "בשעה 10"
 */
function extractDate(text: string): ExtractedDate | null {
  const t = " " + text + " ";

  // 1. Relative tokens.
  for (const [word, offset] of Object.entries(CHRONO_REL)) {
    if (t.includes(word)) {
      const d = new Date(todayLocal());
      d.setDate(d.getDate() + offset);
      const time = extractTime(t);
      if (time) {
        d.setHours(time.h, time.m, 0, 0);
        return { date: d, allDay: false, raw: word };
      }
      return { date: d, allDay: true, raw: word };
    }
  }

  // 2. "ביום <weekday> הקרוב" or just "ב<weekday>".
  for (const [name, dow] of Object.entries(HEBREW_WEEKDAYS)) {
    const patterns = [
      `ביום ${name}`,
      `ב${name}`,
      `יום ${name}`,
    ];
    for (const p of patterns) {
      if (t.includes(p)) {
        const d = nextWeekday(dow);
        const time = extractTime(t);
        if (time) {
          d.setHours(time.h, time.m, 0, 0);
          return { date: d, allDay: false, raw: p };
        }
        return { date: d, allDay: true, raw: p };
      }
    }
  }

  // 3. Numeric date "15/4", "15/4/2026", "15.4".
  const dateMatch = t.match(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1;
    let year = dateMatch[3]
      ? parseInt(dateMatch[3], 10)
      : new Date().getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      // If date is in the past for the current year and no year given, bump to next year.
      if (!dateMatch[3] && d < todayLocal()) {
        d.setFullYear(d.getFullYear() + 1);
      }
      const time = extractTime(t);
      if (time) {
        d.setHours(time.h, time.m, 0, 0);
        return { date: d, allDay: false, raw: dateMatch[0] };
      }
      return { date: d, allDay: true, raw: dateMatch[0] };
    }
  }

  // 4. "ב-15 לחודש" / "ב-15 בחודש".
  const dom = t.match(/\bב[־-]?(\d{1,2})\s+(?:ל|ב)חודש\b/);
  if (dom) {
    const day = parseInt(dom[1], 10);
    const now = todayLocal();
    const d = new Date(now.getFullYear(), now.getMonth(), day);
    if (d < now) d.setMonth(d.getMonth() + 1);
    const time = extractTime(t);
    if (time) {
      d.setHours(time.h, time.m, 0, 0);
      return { date: d, allDay: false, raw: dom[0] };
    }
    return { date: d, allDay: true, raw: dom[0] };
  }

  return null;
}

function extractTime(t: string): { h: number; m: number } | null {
  // "בשעה 10" / "בשעה 10:30" / "ב-10:30" / "ב-10"
  const m = t.match(/(?:בשעה\s+|ב[־-]?)(\d{1,2})(?::(\d{2}))?\b/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = m[2] ? parseInt(m[2], 10) : 0;
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  // Heuristic: standalone "ב-10" might be a date rather than time. Require
  // a known time anchor word OR a colon.
  if (!m[2] && !/בשעה/.test(t)) return null;
  return { h, m: mm };
}

/** Score-and-rank task lists by keyword overlap with the thought text. */
function matchTaskList(
  text: string,
  lists: TaskList[]
): { list: TaskList; score: number; matchedKeyword: string } | null {
  if (lists.length === 0) return null;
  const lower = text.toLowerCase();

  const scored = lists.map((list) => {
    let bestKeyword = "";
    let score = 0;

    // 1. Direct name match.
    if (lower.includes(list.name.toLowerCase())) {
      score += 5;
      bestKeyword = list.name;
    }

    // 2. Keyword bucket inference based on list name.
    const lname = list.name.toLowerCase();
    for (const [bucketKey, keywords] of Object.entries(LIST_KEYWORD_BUCKETS)) {
      // If the list name resembles the bucket (rough heuristic), give credit
      // for any of the bucket's keywords found in the text.
      const bucketMatches: Record<string, string[]> = {
        shopping: ["קניות", "קנייה", "סופר", "חנות"],
        work: ["עבודה", "פרויקט", "משרד"],
        family: ["משפחה", "ילדים", "בית"],
        health: ["בריאות", "רופא"],
        finance: ["כספים", "תשלומים", "פיננסים"],
        errands: ["סידורים", "דואר"],
      };
      const bucketHints = bucketMatches[bucketKey] ?? [];
      const listMatchesBucket = bucketHints.some((h) => lname.includes(h));
      if (!listMatchesBucket) continue;

      for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) {
          score += 2;
          if (!bestKeyword) bestKeyword = kw;
        }
      }
    }

    return { list, score, matchedKeyword: bestKeyword };
  });

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];
  if (!winner || winner.score === 0) return null;
  return winner;
}

function summarize(text: string, max = 60): string {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? text;
  const trimmed = line.trim();
  return trimmed.length > max ? trimmed.slice(0, max - 1) + "…" : trimmed;
}

/**
 * Extract the "action" (what the user actually wants done) from the text.
 * Returns the verb-led phrase if found, or null.
 */
function extractAction(text: string): string | null {
  for (const verb of ACTION_VERBS) {
    const idx = text.indexOf(verb);
    if (idx === -1) continue;
    // Take a window of ~50 chars from the verb forward, stop at sentence end.
    const window = text.slice(idx, idx + 80);
    const stop = window.search(/[.!?\n]/);
    return (stop > 0 ? window.slice(0, stop) : window).trim();
  }
  return null;
}

/** People-name detector — coarse heuristic. */
const KNOWN_NAMES_RE =
  /\b(דני|ירדן|נועה|אורי|רונה|איתי|מאיה|שיר|אלון|שרון|עלמה|נועם|רוני|תום|דניאל|עומר)\b/;

function extractPerson(text: string): string | null {
  const m = text.match(KNOWN_NAMES_RE);
  return m ? m[1] : null;
}

// -----------------------------------------------------------------------------
// Mock provider
// -----------------------------------------------------------------------------

export const mockProvider: ThoughtAiProvider = {
  async generateTitle(text) {
    await new Promise((r) => setTimeout(r, 80));
    const action = extractAction(text);
    if (action) return summarize(action);
    return summarize(text);
  },

  async buildPlan(thought, ctx) {
    await new Promise((r) => setTimeout(r, 200));
    const text = thought.text_content ?? "";
    const actions: SuggestedAction[] = [];

    const date = extractDate(text);
    const action = extractAction(text);
    const person = extractPerson(text);
    const baseTitle = action ? summarize(action) : summarize(text);

    // 1. Event suggestion — if the text mentions a date.
    if (date) {
      const start = new Date(date.date);
      const end = new Date(start);
      if (date.allDay) {
        end.setHours(23, 59, 59, 999);
      } else {
        end.setHours(end.getHours() + 1);
      }
      actions.push({
        kind: "create_event",
        payload: {
          title: baseTitle,
          description: text,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          all_day: date.allDay,
        },
        reasoning: date.allDay
          ? `זוהה תאריך "${date.raw}" בלי שעה — מציעה אירוע יום-מלא.`
          : `זוהה תאריך "${date.raw}" עם שעה — מציעה אירוע מתוזמן.`,
        confidence: 0.9,
      });
    }

    // 2. Task suggestion — if there's an action verb OR if the text is
    //    short and looks like a to-do.
    if (action || text.length < 200) {
      const matched = matchTaskList(text, ctx.taskLists);
      const taskTitle = action ? summarize(action) : baseTitle;
      const taskPayload: SuggestedTask = {
        title: taskTitle,
        description: text,
        due_at: date?.allDay ? date.date.toISOString() : (date?.date.toISOString() ?? null),
        task_list_id: matched?.list.id ?? null,
        task_list_name: matched?.list.name ?? null,
        urgency: 3,
      };
      actions.push({
        kind: "create_task",
        payload: taskPayload,
        reasoning: matched
          ? `התאמה לרשימה "${matched.list.name}" לפי המילה "${matched.matchedKeyword}".`
          : "פעולה זוהתה בטקסט. בלי רשימה תואמת — תיווצר 'לא משויכת'.",
        confidence: action ? 0.85 : 0.6,
      });
    }

    // 3. Send message — if a person was named AND it sounds like outreach.
    if (
      person &&
      /(להודיע|לעדכן|לשלוח ל|לכתוב ל|להתקשר ל|לתאם עם|להזמין את)/.test(text)
    ) {
      actions.push({
        kind: "send_message",
        payload: {
          recipient: person,
          channel: "whatsapp",
          body: action ?? text,
        },
        reasoning: `זוהתה כוונה ליצור קשר עם ${person}.`,
        confidence: 0.7,
      });
    }

    // 4. Project — if the text uses the word "פרויקט".
    if (/פרויקט/.test(text)) {
      actions.push({
        kind: "create_project",
        payload: {
          name: baseTitle,
          description: text,
        },
        reasoning: 'המילה "פרויקט" מופיעה בטקסט.',
        confidence: 0.5,
      });
    }

    // Sort by confidence, highest first.
    actions.sort((a, b) => b.confidence - a.confidence);

    return {
      title: baseTitle,
      actions,
    };
  },
};
