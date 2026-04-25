/**
 * AI adapter for the thoughts screen.
 *
 * The real integration (Claude Haiku via Anthropic API) ships in its own
 * phase — until then we wire a `mockProvider` that produces deterministic
 * output so the UI can be built and tested end-to-end. The rest of the
 * app only knows about the `ThoughtAiProvider` interface; swapping to the
 * real provider is a one-file change when we get there.
 */

import type { Thought } from "@/lib/types/domain";

export type DynamicSuggestionKind =
  | "split_tasks"
  | "link_project"
  | "create_event"
  | "assign_list"
  | "create_contact";

/**
 * A dynamic suggestion the AI surfaces on a per-thought basis. `kind`
 * narrows the shape of the action the user confirms.
 */
export interface DynamicSuggestion {
  id: string;
  kind: DynamicSuggestionKind;
  /** Hebrew sentence shown in the banner. */
  label: string;
  /** Optional payload the banner hands back when the user accepts. */
  payload?: Record<string, unknown>;
}

export interface ThoughtAiProvider {
  /** Short title (≤ 60 chars) — used for the card header. */
  generateTitle(text: string): Promise<string>;
  /**
   * Dynamic suggestions specific to this thought's content. Returning an
   * empty array is fine — the banner still shows its fixed suggestions.
   */
  getSuggestions(thought: Thought): Promise<DynamicSuggestion[]>;
}

// Mock -----------------------------------------------------------------------

const DATE_TOKEN = /\b(היום|מחר|ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת|\d{1,2}\/\d{1,2})\b/;
const PEOPLE_TOKEN = /\b(דני|ירדן|נועה|אורי|רונה|איתי|מאיה|שיר|אלון|שרון)\b/;
const ACTIONS_TOKEN = /(לענות|להתקשר|לשלוח|לסיים|לבדוק|להכין|לתאם|לארגן)/g;

function firstLine(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? text;
  return line.trim();
}

export const mockProvider: ThoughtAiProvider = {
  async generateTitle(text) {
    const line = firstLine(text);
    if (line.length === 0) return "מחשבה";
    // Simulate a network tick so the UI can animate a loader if needed.
    await new Promise((r) => setTimeout(r, 120));
    return line.length > 60 ? line.slice(0, 57) + "..." : line;
  },

  async getSuggestions(thought) {
    await new Promise((r) => setTimeout(r, 160));
    const text = thought.text_content ?? "";
    const suggestions: DynamicSuggestion[] = [];
    const personMatch = text.match(PEOPLE_TOKEN);
    if (personMatch) {
      suggestions.push({
        id: `link:${personMatch[0]}`,
        kind: "link_project",
        label: `זיהיתי שם "${personMatch[0]}" — שייכי לפרויקט/איש קשר?`,
        payload: { name: personMatch[0] },
      });
    }
    const dateMatch = text.match(DATE_TOKEN);
    if (dateMatch) {
      suggestions.push({
        id: `event:${dateMatch[0]}`,
        kind: "create_event",
        label: `זיהיתי תאריך "${dateMatch[0]}" — ליצור אירוע?`,
        payload: { when: dateMatch[0] },
      });
    }
    const actionHits = Array.from(text.matchAll(ACTIONS_TOKEN));
    if (actionHits.length >= 2) {
      suggestions.push({
        id: `split:${actionHits.length}`,
        kind: "split_tasks",
        label: `זיהיתי ${actionHits.length} פעולות נפרדות — לפצל ל-${actionHits.length} משימות?`,
        payload: { count: actionHits.length },
      });
    }
    // Heuristic: a thought longer than ~160 chars without a title usually
    // deserves a list assignment nudge — keeps the banner useful even on
    // text that doesn't hit any pattern above.
    if (suggestions.length === 0 && text.length > 160) {
      suggestions.push({
        id: "assign",
        kind: "assign_list",
        label: "המחשבה ארוכה — לשייך לרשימה מתאימה?",
      });
    }
    return suggestions;
  },
};
