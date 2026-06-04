import { supabase } from "@/lib/supabase/client";
import type { ChatMessage, AssistantTool } from "@/lib/ai/types";

/** What the assistant Edge Function returns: the reply text + proposed tool
 *  calls (awaiting the user's approval before the client runs them). */
export interface AssistantReply {
  text: string;
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>;
}

/** Sends the running conversation (+ the active skill's prompt/context/tools)
 *  to the `assistant` Edge Function and returns Claude's reply. Tool calls are
 *  proposals only — the caller executes approved ones locally.
 *
 *  Each message carries its own `toolResults` (the outcomes of tools approved
 *  for the previous assistant turn), so the model can continue and — crucially
 *  — the full history replays validly: every tool_use keeps a matching
 *  tool_result on every subsequent request. */
export async function sendAssistantMessage(args: {
  skillId: string;
  systemPrompt: string;
  context: string;
  tools: AssistantTool[];
  messages: ChatMessage[];
}): Promise<AssistantReply> {
  const { data: session } = await supabase.auth.getSession();
  const jwt = session.session?.access_token;
  if (!jwt) throw new Error("not_authenticated");

  // Strip client-only fields from tools (run/requiresApproval/label) — the API
  // only wants name/description/input_schema.
  const apiTools = args.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));

  // Serialize messages to the Edge Function's wire shape. Each message carries
  // its own tool_calls / tool_results so the whole history stays valid on every
  // request (the Edge Function emits tool_result blocks per message).
  const wireMessages = args.messages.map((m) => ({
    role: m.role,
    content: m.content,
    images: m.images?.map((img) => ({
      media_type: img.mediaType,
      data: img.data,
    })),
    tool_calls: m.toolCalls?.map((tc) => ({
      id: tc.id,
      name: tc.name,
      input: tc.input,
    })),
    tool_results: m.toolResults?.map((r) => ({
      tool_call_id: r.toolCallId,
      output: r.output,
    })),
  }));

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      skill_id: args.skillId,
      system: args.systemPrompt,
      context: args.context,
      tools: apiTools,
      messages: wireMessages,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string; error?: string }).message ??
        (body as { error?: string }).error ??
        `assistant_${res.status}`
    );
  }
  const json = (await res.json()) as {
    ok: boolean;
    text: string;
    tool_calls: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  };
  return { text: json.text ?? "", toolCalls: json.tool_calls ?? [] };
}
