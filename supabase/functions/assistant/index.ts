// Assistant Edge Function — Claude-powered, context-agnostic chat for the
// app-wide AI assistant. Each client request carries the active SKILL's system
// prompt, context snapshot, tool definitions, and the running message history;
// this function relays them to Claude and returns the assistant's reply plus
// any proposed tool calls.
//
// IMPORTANT: this function performs NO database writes. It only proposes tool
// calls; the client executes approved tools through the app's own services
// under the user's RLS. That keeps every write authorized + undoable.
//
// Endpoint:
//   POST /assistant
//     { skill_id, system, context, tools[], messages[] }
//   → { ok, text, tool_calls: [{ id, name, input }] }
//
// Required Supabase secret:
//   ANTHROPIC_API_KEY      — keys.anthropic.com / Workbench → API keys
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY auto-injected)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { jsonResponse, preflight } from "../_shared/cors.ts";
import { requireMember, type MembershipContext } from "../_shared/auth.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;
const MAX_CONTEXT_CHARS = 40_000;

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** A chat turn as sent by the client. Mirrors src/lib/ai/types.ts ChatMessage,
 *  plus optional tool results the client attaches after running approved tools
 *  so the model can continue the conversation. */
interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
  /** Base64 images attached to a user turn — relayed to Claude as vision. */
  images?: Array<{ media_type: string; data: string }>;
  tool_calls?: Array<{ id: string; name: string; input: unknown }>;
  tool_results?: Array<{ tool_call_id: string; output: string }>;
}

interface RequestBody {
  skill_id?: string;
  system?: string;
  context?: string;
  tools?: AnthropicTool[];
  messages?: IncomingMessage[];
}

/** Translates our flat message list into Anthropic's content-block format.
 *  Assistant turns with tool_calls become text + tool_use blocks; a following
 *  user turn carrying tool_results becomes tool_result blocks (so the model
 *  sees what its proposed tools returned). */
function toAnthropicMessages(messages: IncomingMessage[]) {
  const out: Array<{ role: "user" | "assistant"; content: unknown }> = [];
  for (const m of messages) {
    if (m.role === "assistant") {
      const blocks: unknown[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.tool_calls ?? []) {
        blocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.input ?? {},
        });
      }
      out.push({ role: "assistant", content: blocks.length ? blocks : m.content });
    } else {
      // User turn. If it carries tool_results, emit them as tool_result blocks
      // (must directly follow the assistant tool_use turn per the API).
      if (m.tool_results && m.tool_results.length > 0) {
        out.push({
          role: "user",
          content: m.tool_results.map((r) => ({
            type: "tool_result",
            tool_use_id: r.tool_call_id,
            content: r.output,
          })),
        });
        // The same user turn may also carry images / text (e.g. the user asked
        // a question — possibly with a photo — while tool proposals were open).
        const rest: unknown[] = (m.images ?? []).map((img) => ({
          type: "image",
          source: { type: "base64", media_type: img.media_type, data: img.data },
        }));
        if (m.content) rest.push({ type: "text", text: m.content });
        if (rest.length > 0) {
          out.push({ role: "user", content: rest });
        }
      } else if (m.images && m.images.length > 0) {
        // A user turn with attached images → image block(s) + optional text.
        const blocks: unknown[] = m.images.map((img) => ({
          type: "image",
          source: {
            type: "base64",
            media_type: img.media_type,
            data: img.data,
          },
        }));
        if (m.content) blocks.push({ type: "text", text: m.content });
        out.push({ role: "user", content: blocks });
      } else {
        out.push({ role: "user", content: m.content });
      }
    }
  }
  return out;
}

async function callClaude(body: RequestBody): Promise<{
  text: string;
  toolCalls: Array<{ id: string; name: string; input: unknown }>;
}> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set on this edge function. Add it under " +
        "Supabase Dashboard → Edge Functions → Secrets."
    );
  }
  const context =
    (body.context ?? "").length > MAX_CONTEXT_CHARS
      ? (body.context ?? "").slice(0, MAX_CONTEXT_CHARS) + "\n\n[ההקשר קוצר]"
      : body.context ?? "";

  const systemText = [body.system ?? "", context && `\n\nהקשר נוכחי:\n${context}`]
    .filter(Boolean)
    .join("");

  const anthropicBody = {
    model: ANTHROPIC_MODEL,
    max_tokens: MAX_TOKENS,
    // Cache the (stable) system + tool definitions; the moving part is messages.
    system: [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }],
    tools: body.tools ?? [],
    messages: toAnthropicMessages(body.messages ?? []),
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(anthropicBody),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`anthropic_${res.status}: ${text.slice(0, 500)}`);
  }
  const json = (await res.json()) as {
    content?: Array<{
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: unknown;
    }>;
  };
  let text = "";
  const toolCalls: Array<{ id: string; name: string; input: unknown }> = [];
  for (const block of json.content ?? []) {
    if (block.type === "text" && block.text) text += block.text;
    else if (block.type === "tool_use" && block.id && block.name) {
      toolCalls.push({ id: block.id, name: block.name, input: block.input ?? {} });
    }
  }
  return { text, toolCalls };
}

async function assistantHandler(
  req: Request,
  _ctx: MembershipContext
): Promise<Response> {
  const origin = req.headers.get("origin");
  const body = (await req.json().catch(() => null)) as RequestBody | null;
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonResponse({ error: "bad_request" }, { status: 400, origin });
  }
  const { text, toolCalls } = await callClaude(body);
  return jsonResponse({ ok: true, text, tool_calls: toolCalls }, { origin });
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
    return await assistantHandler(req, auth.ctx);
  } catch (err) {
    console.error("assistant_unhandled", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500, origin: req.headers.get("origin") }
    );
  }
});
