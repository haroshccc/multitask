/**
 * App-wide AI assistant — general infrastructure.
 *
 * The assistant itself is context-agnostic: it runs a chat and surfaces
 * "tool proposals" that the user approves. Each SCREEN/CONTEXT contributes a
 * SKILL that supplies (a) a system prompt, (b) a context snapshot, and (c) a
 * set of tools. The Edge Function never writes to the DB — it only proposes;
 * the client executes a tool through `AssistantTool.run` (which goes through
 * the existing services + RLS + undo) only after the user approves.
 *
 * MVP: one skill (food). Phase 2: register more skills + voice (OpenAI).
 */

/** JSON-schema-ish description of a tool's input — passed straight to the
 *  Anthropic `tools` API and rendered by the UI for editing. */
export interface ToolInputSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

/** A single chat turn. `tool_calls` carry the model's proposed actions for an
 *  assistant turn; the UI renders them as approve/edit/dismiss cards. */
export interface ChatMessage {
  role: "user" | "assistant";
  /** Free text shown in the bubble. May be empty for a pure tool-call turn. */
  content: string;
  /** Proposed tool calls for this assistant turn (awaiting user decision). */
  toolCalls?: ToolCall[];
  /** Outcomes of tools run for the PREVIOUS assistant turn, carried on the
   *  (usually empty) user continuation turn. Persisted on the message — not
   *  just passed once — so the full history replays validly: every tool_use
   *  must keep a matching tool_result on every subsequent request. */
  toolResults?: ToolResult[];
}

/** A proposed tool invocation returned by the model. `id` ties an approval/
 *  result back to the originating call when we continue the conversation. */
export interface ToolCall {
  id: string;
  name: string;
  /** The model-proposed arguments. The user may edit these before running. */
  input: Record<string, unknown>;
}

/** Result of running a tool locally, fed back to the model on the next turn
 *  so it can continue (e.g. after ingredients are added, propose the meal). */
export interface ToolResult {
  toolCallId: string;
  /** Plain-text outcome the model can read ("added 2 ingredients", "exists"). */
  output: string;
}

/** How a tool executes in the client after approval. Returns a human-readable
 *  result string. `null` from a tool that needs no execution (pure info). */
export type ToolRunner = (
  input: Record<string, unknown>
) => Promise<string> | string;

export interface AssistantTool {
  name: string;
  description: string;
  input_schema: ToolInputSchema;
  /** Tools whose effect is a real write require approval + a runner. Pure
   *  read/think tools (e.g. propose a recipe) can omit `run` — they only feed
   *  the conversation. */
  run?: ToolRunner;
  /** When true the UI shows an approve/edit card before `run`. Defaults true
   *  when `run` is present, false otherwise. */
  requiresApproval?: boolean;
  /** Short Hebrew label for the proposal card header. */
  label?: string;
}

export interface AssistantSkill {
  id: string;
  /** Hebrew label shown in the assistant header ("עוזר בישול"). */
  label: string;
  /** System prompt establishing the assistant's role for this context. */
  systemPrompt: string;
  /** Builds the per-request context block (current catalog, etc.). Runs fresh
   *  on each send so the model sees up-to-date state. */
  buildContext: () => string;
  tools: AssistantTool[];
  /** Opening suggestion chips shown on an empty chat. */
  starters?: string[];
}
