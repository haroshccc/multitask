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

/** A summary of a past task — used by the AI to learn the user's habits. */
export interface TaskHistoryItem {
  title: string;
  task_list_id: string | null;
  tags: string[];
}

export interface AiContext {
  /** All task lists the user has — names are used for the semantic match. */
  taskLists: TaskList[];
  /** All thought lists — used for "assign to thought list" suggestions. */
  thoughtLists: ThoughtList[];
  /**
   * Recent tasks the user has created. The mock provider mines these for
   * "history-aware" list ranking — when the same scenario keyword landed in
   * a particular list before, the AI prefers that list again.
   */
  recentTasks?: TaskHistoryItem[];
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
// Scenario templates — the "brainstorm" engine
// -----------------------------------------------------------------------------

interface ScenarioTask {
  title: string;
  /** Days before the event date to schedule this task (negative = before). */
  daysOffset?: number;
  urgency?: number;
  tags?: string[];
}

interface Scenario {
  /** Trigger keywords (regex). First match wins. */
  trigger: RegExp;
  /** Friendly Hebrew name for the reasoning line. */
  name: string;
  /** True = the trigger usually implies a calendar event in addition to tasks. */
  hasEvent: boolean;
  /** Hint for list matching — pairs with `LIST_KEYWORD_BUCKETS`. */
  listBucket?: string;
  /** Tasks to brainstorm. 3-5 ranked from most to least essential. */
  tasks: ScenarioTask[];
}

/**
 * The brainstorm library. When a thought triggers a scenario, the AI
 * proposes 3-5 follow-up tasks even if no specific verb appears — the
 * scenario name itself implies the work. Real Claude will replace this
 * with prompted reasoning; the *shape* of the output stays the same.
 */
/**
 * Build a Hebrew-aware "word boundary" regex from a list of trigger words.
 *
 * JavaScript's native `\b` is defined against `\w` = `[A-Za-z0-9_]`, which
 * does NOT include Hebrew letters. So `/\b(מבחן)\b/.test("מבחן")` returns
 * **false** — the Hebrew chars are treated as `\W`, and there's no W↔w
 * transition at the start. This is a common gotcha that bit us in v1.
 *
 * The fix: lookarounds against the Unicode Hebrew block (U+0590..U+05FF).
 * "Word boundary" becomes "the trigger is not glued to another Hebrew
 * letter on either side", which is what we actually mean.
 */
function hebrewWordBoundaryRegex(words: string[], flags = ""): RegExp {
  const escaped = words
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return new RegExp(
    `(?<![\\u0590-\\u05FF])(${escaped})(?![\\u0590-\\u05FF])`,
    flags
  );
}

const SCENARIOS: Scenario[] = [
  {
    trigger: hebrewWordBoundaryRegex(["מבחן", "בחינה", "מבדק"]),
    name: "מבחן/בחינה",
    hasEvent: true,
    listBucket: "study",
    tasks: [
      { title: "ללמוד למבחן", daysOffset: -7, urgency: 4 },
      { title: "לכתוב דף נוסחאות", daysOffset: -3, urgency: 3 },
      { title: "לחזור על החומר", daysOffset: -2, urgency: 4 },
      { title: "לתרגל שאלות מבחני עבר", daysOffset: -3, urgency: 3 },
      { title: "לסכם את הנושאים העיקריים", daysOffset: -4, urgency: 3 },
    ],
  },
  {
    trigger: hebrewWordBoundaryRegex(["פגישה", "שיחה עם", "תיאום עם"]),
    name: "פגישה",
    hasEvent: true,
    listBucket: "work",
    tasks: [
      { title: "להכין סדר יום לפגישה", daysOffset: -1, urgency: 3 },
      { title: "לאשר את שעת הפגישה עם המשתתפים", daysOffset: -1, urgency: 3 },
      { title: "לסכם את הפגישה ולשלוח follow-up", daysOffset: 0, urgency: 3 },
      { title: "להכין שאלות לפגישה", daysOffset: -1, urgency: 2 },
    ],
  },
  {
    trigger: hebrewWordBoundaryRegex(["טיול", "חופש", "חופשה", "נסיעה"]),
    name: "טיול / נסיעה",
    hasEvent: true,
    listBucket: "errands",
    tasks: [
      { title: "להזמין מקום לינה", daysOffset: -14, urgency: 4 },
      { title: "לבדוק תחזית מזג אוויר", daysOffset: -2, urgency: 2 },
      { title: "לארוז", daysOffset: -1, urgency: 3 },
      { title: "לבדוק עלויות וגיבוש תקציב", daysOffset: -10, urgency: 3 },
      { title: "להתקין ביטוח נסיעות", daysOffset: -7, urgency: 3 },
    ],
  },
  {
    trigger: hebrewWordBoundaryRegex(["יום הולדת", "יומולדת", "יומ הולדת"]),
    name: "יום הולדת",
    hasEvent: true,
    listBucket: "family",
    tasks: [
      { title: "לקנות מתנה", daysOffset: -3, urgency: 4 },
      { title: "לשלוח ברכה", daysOffset: 0, urgency: 3 },
      { title: "לתאם הפתעה / מסיבה", daysOffset: -7, urgency: 3 },
    ],
  },
  {
    trigger: hebrewWordBoundaryRegex([
      "חתונה",
      "בר מצווה",
      "בת מצווה",
      "ברית",
      "אירוסין",
    ]),
    name: "אירוע משפחתי",
    hasEvent: true,
    listBucket: "family",
    tasks: [
      { title: "לאשר הגעה", daysOffset: -7, urgency: 3 },
      { title: "לבחור מתנה", daysOffset: -5, urgency: 3 },
      { title: "לסדר הסעה", daysOffset: -2, urgency: 3 },
      { title: "לבחור לבוש", daysOffset: -2, urgency: 2 },
    ],
  },
  {
    trigger: hebrewWordBoundaryRegex(["רופא", "רופאה", "בדיקה", "בדיקות"]),
    name: "תור רפואי",
    hasEvent: true,
    listBucket: "health",
    tasks: [
      { title: "להכין מסמכים רפואיים קודמים", daysOffset: -1, urgency: 3 },
      { title: "להכין רשימת שאלות לרופא", daysOffset: -1, urgency: 3 },
      { title: "לאשר את התור", daysOffset: -1, urgency: 2 },
      { title: "להזמין תזכורת לתרופות אחרי הפגישה", daysOffset: 0, urgency: 2 },
    ],
  },
  {
    trigger: hebrewWordBoundaryRegex(
      ["הצעת מחיר", "הצעה ללקוח", "quote"],
      "i"
    ),
    name: "הצעת מחיר",
    hasEvent: false,
    listBucket: "work",
    tasks: [
      { title: "לחשב עלויות", urgency: 4 },
      { title: "לכתוב את ההצעה", urgency: 4 },
      { title: "לשלוח את ההצעה ללקוח", urgency: 3 },
      { title: "לעקוב אחרי תשובה תוך שבוע", daysOffset: 7, urgency: 3 },
    ],
  },
  {
    trigger: hebrewWordBoundaryRegex(["מאמר", "פוסט", "בלוג", "כתבה"]),
    name: "כתיבה",
    hasEvent: false,
    tasks: [
      { title: "לחקור את הנושא", urgency: 3 },
      { title: "לכתוב טיוטה ראשונית", urgency: 4 },
      { title: "לעבור על העריכה", urgency: 3 },
      { title: "לשלוח לפידבק", urgency: 2 },
    ],
  },
  {
    trigger: hebrewWordBoundaryRegex([
      "אירוח",
      "ארוחה",
      "ארוחת ערב",
      "ארוחת צהריים",
      "מסיבה",
    ]),
    name: "אירוח",
    hasEvent: true,
    listBucket: "shopping",
    tasks: [
      { title: "לבנות תפריט", daysOffset: -3, urgency: 3 },
      { title: "לעשות קניות לארוחה", daysOffset: -1, urgency: 4 },
      { title: "לסדר את הבית", daysOffset: 0, urgency: 3 },
      { title: "לאשר הגעת אורחים", daysOffset: -2, urgency: 2 },
    ],
  },
  {
    trigger: hebrewWordBoundaryRegex([
      "מעבר דירה",
      "העברת דירה",
      "התקנה",
      "תיקון",
    ]),
    name: "סידור הבית",
    hasEvent: false,
    tasks: [
      { title: "לתאם בעל מקצוע", urgency: 3 },
      { title: "לקבל הצעות מחיר", urgency: 3 },
      { title: "להכין את האזור הרלוונטי", urgency: 2 },
    ],
  },
];

function findScenario(text: string): Scenario | null {
  for (const s of SCENARIOS) {
    if (s.trigger.test(text)) return s;
  }
  return null;
}

/**
 * History-aware list ranking. Looks at the user's recent tasks: if the
 * scenario keyword (or task title's keywords) historically landed in a
 * particular list, prefer that list. Falls back to keyword-bucket matching.
 */
function rankListForScenarioTask(
  taskTitle: string,
  scenario: Scenario | null,
  ctx: AiContext
): {
  list: TaskList;
  reason: "history" | "bucket" | "name";
  detail: string;
} | null {
  if (ctx.taskLists.length === 0) return null;

  // 1. History — count frequency of each list_id for tasks whose title
  //    overlaps the scenario name OR the suggested task title.
  const titleLower = taskTitle.toLowerCase();
  const scenarioLower = scenario?.name.toLowerCase() ?? "";
  const histCounts = new Map<string, number>();
  for (const t of ctx.recentTasks ?? []) {
    if (!t.task_list_id) continue;
    const tl = t.title.toLowerCase();
    let related = false;
    // Title-keyword overlap (rough): share at least one 3+ char word.
    const tokens = titleLower.split(/\s+/).filter((w) => w.length >= 3);
    for (const tok of tokens) {
      if (tl.includes(tok)) {
        related = true;
        break;
      }
    }
    if (!related && scenarioLower && tl.includes(scenarioLower)) {
      related = true;
    }
    if (related) {
      histCounts.set(t.task_list_id, (histCounts.get(t.task_list_id) ?? 0) + 1);
    }
  }

  if (histCounts.size > 0) {
    let best: { id: string; n: number } | null = null;
    for (const [id, n] of histCounts) {
      if (!best || n > best.n) best = { id, n };
    }
    if (best) {
      const list = ctx.taskLists.find((l) => l.id === best!.id);
      if (list) {
        return {
          list,
          reason: "history",
          detail: `בעבר ${best.n} משימות דומות נכנסו ל"${list.name}".`,
        };
      }
    }
  }

  // 2. Scenario bucket → list whose name resembles the bucket.
  if (scenario?.listBucket) {
    const bucketHints: Record<string, string[]> = {
      shopping: ["קניות", "קנייה", "סופר", "חנות"],
      work: ["עבודה", "פרויקט", "משרד"],
      family: ["משפחה", "ילדים", "בית"],
      study: ["לימודים", "לימוד", "קורס"],
      health: ["בריאות", "רופא"],
      finance: ["כספים", "תשלומים", "פיננסים"],
      errands: ["סידורים", "דואר"],
    };
    const hints = bucketHints[scenario.listBucket] ?? [];
    const hit = ctx.taskLists.find((l) =>
      hints.some((h) => l.name.toLowerCase().includes(h))
    );
    if (hit) {
      return {
        list: hit,
        reason: "bucket",
        detail: `מתאים לקטגוריית "${scenario.name}".`,
      };
    }
  }

  // 3. Direct name match.
  const direct = ctx.taskLists.find((l) =>
    titleLower.includes(l.name.toLowerCase())
  );
  if (direct) {
    return {
      list: direct,
      reason: "name",
      detail: `שם הרשימה מופיע בכותרת.`,
    };
  }

  return null;
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
    const scenario = findScenario(text);
    const baseTitle = scenario
      ? `${scenario.name} — ${summarize(text, 40)}`
      : action
      ? summarize(action)
      : summarize(text);

    // 1. Event suggestion — if a date OR if a scenario implies one.
    if (date) {
      const start = new Date(date.date);
      const end = new Date(start);
      if (date.allDay) {
        end.setHours(23, 59, 59, 999);
      } else {
        end.setHours(end.getHours() + 1);
      }
      const eventTitle = scenario
        ? `${scenario.name}: ${summarize(text, 40)}`
        : baseTitle;
      actions.push({
        kind: "create_event",
        payload: {
          title: eventTitle,
          description: text,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          all_day: date.allDay,
        },
        reasoning: date.allDay
          ? `זוהה תאריך "${date.raw}" בלי שעה — מציעה אירוע יום-מלא.`
          : `זוהה תאריך "${date.raw}" עם שעה — מציעה אירוע מתוזמן.`,
        confidence: 0.92,
      });
    }

    // 2. Scenario brainstorm — 3-5 follow-up tasks specific to the scenario.
    if (scenario) {
      const anchorDate = date?.date ?? null;
      for (let i = 0; i < scenario.tasks.length; i++) {
        const t = scenario.tasks[i];
        const ranked = rankListForScenarioTask(t.title, scenario, ctx);

        // Compute due date relative to the event (if any) or null.
        let due: string | null = null;
        if (anchorDate && typeof t.daysOffset === "number") {
          const d = new Date(anchorDate);
          d.setDate(d.getDate() + t.daysOffset);
          d.setHours(9, 0, 0, 0); // morning of the offset day
          // Don't suggest a due-date in the past.
          if (d.getTime() >= Date.now() - 24 * 60 * 60 * 1000) {
            due = d.toISOString();
          }
        }

        const reasoningParts = [
          `מתבקש בתרחיש "${scenario.name}".`,
        ];
        if (ranked) reasoningParts.push(ranked.detail);

        actions.push({
          kind: "create_task",
          payload: {
            title: t.title,
            description: text,
            due_at: due,
            task_list_id: ranked?.list.id ?? null,
            task_list_name: ranked?.list.name ?? null,
            urgency: t.urgency ?? 3,
            tags: t.tags,
          },
          reasoning: reasoningParts.join(" "),
          // Slight decay so the most-essential task ranks first.
          confidence: 0.82 - i * 0.03,
        });
      }
    } else if (action || text.length < 200) {
      // Fallback: single task suggestion when no scenario fires but the
      // text reads like a to-do.
      const matched = matchTaskList(text, ctx.taskLists);
      const taskTitle = action ? summarize(action) : baseTitle;
      actions.push({
        kind: "create_task",
        payload: {
          title: taskTitle,
          description: text,
          due_at: date?.date.toISOString() ?? null,
          task_list_id: matched?.list.id ?? null,
          task_list_name: matched?.list.name ?? null,
          urgency: 3,
        },
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
