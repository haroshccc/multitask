import { useCallback, useRef, useState } from "react";
import { sendAssistantMessage } from "@/lib/services/assistant";
import type {
  AssistantSkill,
  ChatMessage,
  ToolCall,
  ToolResult,
} from "@/lib/ai/types";

/** A tool call surfaced to the UI for a decision, tagged with the message it
 *  belongs to + whether it still needs approval. */
export interface PendingToolCall extends ToolCall {
  /** Index of the assistant message that proposed it. */
  messageIndex: number;
  requiresApproval: boolean;
  label?: string;
  /** UI state. 'pending' awaits the user; the rest are terminal. */
  state: "pending" | "running" | "done" | "dismissed" | "error";
  resultText?: string;
}

const RESOLVED = new Set(["done", "dismissed", "error"]);

/**
 * Drives an assistant conversation for one skill: sends user messages, surfaces
 * proposed tool calls, runs approved ones through the skill's runners, and
 * feeds results back so the model can continue. History is in-memory (MVP).
 *
 * Anthropic requires that EVERY tool_use in an assistant turn gets a matching
 * tool_result in the next user turn. So we don't continue the conversation per
 * individual approval — we wait until all tool calls from a given assistant
 * message are resolved (approved/dismissed/errored), then send one continuation
 * carrying a result for each.
 */
export function useAssistantChat(skill: AssistantSkill | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<PendingToolCall[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mirror of `pending` for synchronous reads inside async handlers.
  const pendingRef = useRef<PendingToolCall[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);

  const setPendingSynced = useCallback(
    (updater: (prev: PendingToolCall[]) => PendingToolCall[]) => {
      setPending((prev) => {
        const next = updater(prev);
        pendingRef.current = next;
        return next;
      });
    },
    []
  );
  const setMessagesSynced = useCallback((next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const reset = useCallback(() => {
    setMessagesSynced([]);
    setPendingSynced(() => []);
    setError(null);
  }, [setMessagesSynced, setPendingSynced]);

  const runTurn = useCallback(
    async (history: ChatMessage[], toolResults?: ToolResult[]) => {
      if (!skill) return;
      setBusy(true);
      setError(null);
      try {
        const reply = await sendAssistantMessage({
          skillId: skill.id,
          systemPrompt: skill.systemPrompt,
          context: skill.buildContext(),
          tools: skill.tools,
          messages: history,
          toolResults,
        });
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: reply.text,
          toolCalls: reply.toolCalls,
        };
        const nextMessages = [...history, assistantMsg];
        setMessagesSynced(nextMessages);

        const idx = nextMessages.length - 1;
        const newPending: PendingToolCall[] = reply.toolCalls.map((tc) => {
          const def = skill.tools.find((t) => t.name === tc.name);
          return {
            ...tc,
            messageIndex: idx,
            requiresApproval: def?.requiresApproval ?? Boolean(def?.run),
            label: def?.label,
            state: "pending",
          };
        });
        setPendingSynced((prev) => [...prev, ...newPending]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [skill, setMessagesSynced, setPendingSynced]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!skill || !text.trim() || busy) return;
      const userMsg: ChatMessage = { role: "user", content: text.trim() };
      const history = [...messagesRef.current, userMsg];
      setMessagesSynced(history);
      await runTurn(history);
    },
    [skill, busy, runTurn, setMessagesSynced]
  );

  /** Once every tool call from `messageIndex` is resolved, continue the
   *  conversation with a tool_result for each (Anthropic requires all of them).
   *  Dismissed/errored calls still get a result so the model can react. */
  const maybeContinue = useCallback(
    async (messageIndex: number) => {
      const group = pendingRef.current.filter((p) => p.messageIndex === messageIndex);
      if (group.length === 0) return;
      if (!group.every((p) => RESOLVED.has(p.state))) return;

      const results: ToolResult[] = group.map((p) => ({
        toolCallId: p.id,
        output:
          p.state === "dismissed"
            ? "המשתמשת בחרה לא לבצע פעולה זו."
            : p.state === "error"
            ? `הפעולה נכשלה: ${p.resultText ?? "שגיאה"}`
            : p.resultText ?? "בוצע.",
      }));

      const continuation: ChatMessage = { role: "user", content: "" };
      const history = [...messagesRef.current, continuation];
      setMessagesSynced(history);
      await runTurn(history, results);
    },
    [runTurn, setMessagesSynced]
  );

  /** Approves + runs a pending tool call. `editedInput` lets the UI pass
   *  user-edited arguments. Continues the conversation once the whole group is
   *  resolved. */
  const approveTool = useCallback(
    async (toolCallId: string, editedInput?: Record<string, unknown>) => {
      if (!skill) return;
      const target = pendingRef.current.find((p) => p.id === toolCallId);
      if (!target || target.state !== "pending") return;
      const def = skill.tools.find((t) => t.name === target.name);
      if (!def?.run) return;

      setPendingSynced((prev) =>
        prev.map((p) => (p.id === toolCallId ? { ...p, state: "running" } : p))
      );
      try {
        const output = await def.run(editedInput ?? target.input);
        setPendingSynced((prev) =>
          prev.map((p) =>
            p.id === toolCallId ? { ...p, state: "done", resultText: output } : p
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setPendingSynced((prev) =>
          prev.map((p) =>
            p.id === toolCallId ? { ...p, state: "error", resultText: msg } : p
          )
        );
        setError(msg);
      }
      await maybeContinue(target.messageIndex);
    },
    [skill, setPendingSynced, maybeContinue]
  );

  const dismissTool = useCallback(
    async (toolCallId: string) => {
      const target = pendingRef.current.find((p) => p.id === toolCallId);
      if (!target || target.state !== "pending") return;
      setPendingSynced((prev) =>
        prev.map((p) => (p.id === toolCallId ? { ...p, state: "dismissed" } : p))
      );
      await maybeContinue(target.messageIndex);
    },
    [setPendingSynced, maybeContinue]
  );

  return {
    messages,
    pending,
    busy,
    error,
    sendMessage,
    approveTool,
    dismissTool,
    reset,
  };
}
