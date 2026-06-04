import { useCallback, useRef, useState } from "react";
import { sendAssistantMessage } from "@/lib/services/assistant";
import type {
  AssistantSkill,
  ChatImage,
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
  /** UI state. 'pending' awaits the user; the rest are terminal. 'deferred'
   *  means the user asked a question instead of deciding — the proposal is
   *  closed with a "still open, answer first" result and the model re-proposes. */
  state: "pending" | "running" | "done" | "dismissed" | "error" | "deferred";
  resultText?: string;
}

const RESOLVED = new Set(["done", "dismissed", "error", "deferred"]);

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

  // Mutate pending through the ref so reads are synchronous: a React functional
  // updater runs deferred, so reading pendingRef right after a setState could
  // see stale state — and the "is the whole group resolved?" check in
  // maybeContinue runs immediately after an approval. We compute from the ref
  // (the live truth), assign it, then render with a fresh array.
  const setPendingSynced = useCallback(
    (updater: (prev: PendingToolCall[]) => PendingToolCall[]) => {
      const next = updater(pendingRef.current);
      pendingRef.current = next;
      setPending(next);
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
    async (history: ChatMessage[]) => {
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
    async (text: string, images?: ChatImage[]) => {
      const hasImages = Boolean(images && images.length > 0);
      if (!skill || (!text.trim() && !hasImages) || busy) return;

      // If tool proposals are still awaiting a decision and the user types a
      // message instead of approving/dismissing, Anthropic still requires a
      // tool_result for every open tool_use. So we close each open call with a
      // "still open — answer the question first, then re-propose" result and
      // carry the user's message on the same turn. The model answers, then
      // re-proposes the same action so the cards reappear. (All open calls
      // belong to the latest assistant turn — you can't advance past an
      // unresolved group — so their results legally precede the user text.)
      const open = pendingRef.current.filter(
        (p) => p.state === "pending" || p.state === "running"
      );
      if (open.length > 0) {
        const openIds = new Set(open.map((p) => p.id));
        setPendingSynced((prev) =>
          prev.map((p) => (openIds.has(p.id) ? { ...p, state: "deferred" } : p))
        );
        const deferredResults: ToolResult[] = open.map((p) => ({
          toolCallId: p.id,
          output:
            "המשתמשת שאלה שאלה לפני שהחליטה; הצעה זו עדיין פתוחה. עני קודם על " +
            "שאלתה במלל, ואז הציעי שוב את אותה פעולה (קריאת הכלי) כדי שתוכל לאשר " +
            "או לדחות.",
        }));
        const continuation: ChatMessage = {
          role: "user",
          content: text.trim(),
          toolResults: deferredResults,
          ...(hasImages ? { images } : {}),
        };
        const history = [...messagesRef.current, continuation];
        setMessagesSynced(history);
        await runTurn(history);
        return;
      }

      const userMsg: ChatMessage = {
        role: "user",
        content: text.trim(),
        ...(hasImages ? { images } : {}),
      };
      const history = [...messagesRef.current, userMsg];
      setMessagesSynced(history);
      await runTurn(history);
    },
    [skill, busy, runTurn, setMessagesSynced, setPendingSynced]
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

      // Embed the results on the continuation turn itself so they persist in
      // history and replay on every later request (not just this one send).
      const continuation: ChatMessage = { role: "user", content: "", toolResults: results };
      const history = [...messagesRef.current, continuation];
      setMessagesSynced(history);
      await runTurn(history);
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
