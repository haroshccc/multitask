import { supabase } from "@/lib/supabase/client";
import type { ChatMessage, ToolResult, AssistantTool } from "@/lib/ai/types";

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
 *  `toolResults` carries the outcomes of tools the user just approved+ran, so
 *  the model can continue (e.g. "ingredients added" → now propose the meal).
 *  They're attached to the latest user turn as tool_result blocks server-side. */
export async function sendAssistantMessage(args: {
  skillId: string;
  systemPrompt: string;
  context: string;
  tools: AssistantTool[];
  messages: ChatMessage[];
  /** Results for tool calls from the previous assistant turn, if any. */
  toolResults?: ToolResult[];
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

  // Serialize messages to the Edge Function's wire shape. The most recent user
  // turn carries any pending tool_results.
  const wireMessages = args.messages.map((m, i) => {
    const isLast = i === args.messages.length - 1;
    return {
      role: m.role,
      content: m.content,
      tool_calls: m.toolCalls?.map((tc) => ({
        id: tc.id,
        name: tc.name,
        input: tc.input,
      })),
      tool_results:
        isLast && m.role === "user" && args.toolResults?.length
          ? args.toolResults.map((r) => ({
              tool_call_id: r.toolCallId,
              output: r.output,
            }))
          : undefined,
    };
  });

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
