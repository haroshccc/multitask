# Claude AI Integration — Implementation Plan

**Status:** Not started. The Thoughts-screen AI today is a deterministic mock
(`src/lib/ai/thought-suggestions.ts` → `mockProvider`) with hand-coded Hebrew
patterns for ~10 scenarios. UX, types, and adapter interface are all production-
ready; only the *brain* is missing.

This doc captures everything we need to do to wire **Claude Haiku 4.5** as the
real provider. Pick it up next session.

---

## 1. The principle (carved into SPEC §28 #9)

**The Anthropic API key never lives in the browser.** Any `VITE_*` env var is
shipped in the public bundle. Bundling `ANTHROPIC_API_KEY` there = anyone with
DevTools can call our Anthropic account on our dime. The key lives in
**Supabase secrets** (set via the Supabase Dashboard, no `VITE_` prefix), and
the browser calls a thin **Edge Function** that holds the SDK.

```
Browser  ──HTTP──►  Supabase Edge Function  ──Anthropic SDK──►  Claude Haiku 4.5
                       (holds ANTHROPIC_API_KEY,
                        prompt-cached system prompt,
                        ~50 lines of TS)
```

---

## 2. What the user does (≈ 10 minutes, one-time)

1. **Get an Anthropic API key.**
   - Sign in / sign up at <https://console.anthropic.com>.
   - Settings → API Keys → "Create Key" → name it `multitask-prod`.
   - Copy the key (starts with `sk-ant-…`). It is shown **once**.

2. **Add the key as a Supabase secret** (NOT as an env var).
   - Supabase Dashboard → Project Settings → Edge Functions → Secrets.
   - Add: `ANTHROPIC_API_KEY` = `sk-ant-...`
   - **Do not** add it with `VITE_` prefix anywhere. Do not put it in `.env`.

3. **Decide on a budget cap** in the Anthropic console (Billing → Usage limits).
   For dev, a $20/month soft cap is plenty.

That's it for the user. Everything else is code.

---

## 3. What I do (≈ 30–45 minutes of coding)

### 3.1. Edge Function — `supabase/functions/thoughts-ai/index.ts`

A single POST endpoint that wraps Claude with a structured-output prompt.

- **Input** (from browser, JSON):
  ```ts
  {
    text: string;            // thought.text_content
    taskLists: { id, name, color }[];     // for list matching
    thoughtLists: { id, name }[];
    recentTasks?: { title, task_list_id, tags }[];   // last ~80, for "history"
  }
  ```

- **Output** (matching the existing `AiPlan` interface):
  ```ts
  {
    title: string;
    actions: SuggestedAction[];
  }
  ```

- **Model**: `claude-haiku-4-5` (cheapest + fast enough for this UX).
- **Prompt caching**: the system prompt is large (rules + JSON schema + reasoning
  guide). Mark it `cache_control: { type: "ephemeral" }` so subsequent thoughts
  reuse the cached prompt. Cuts ~90% of input cost.
- **Tool use** (recommended) — define tools `create_task`, `create_event`,
  `create_project`, `assign_list`, `send_message`. Claude returns tool calls
  → we map directly to `SuggestedAction[]`. Cleaner than free-form JSON.
- **Auth** — verify the request's Supabase auth JWT and only respond if the
  user is a member of an active org. Reject anonymous requests.
- **Rate limit** — 30 calls/user/minute. Anthropic itself doesn't rate-limit
  per-user; we add this so a runaway client can't drain the budget.

**System prompt outline** (Hebrew):

```
You are an assistant for a Hebrew RTL productivity app.
The user pastes a thought. You produce a JSON plan of suggested actions:
- create_event when a date is mentioned (all_day=true if no time given)
- create_task for each action that needs doing — brainstorm 3-5 follow-ups
  when the thought implies a known scenario (exam, trip, meeting, ...)
- create_project when the thought is large and needs structure
- send_message when the thought says "tell X" / "call X"
- assign_list when the thought belongs in a thoughts-list

For each task, pick the best task_list from the user's lists by topic match.
Use recentTasks to learn the user's habits — if a similar task always lands
in list X, prefer X.

All output strings are in Hebrew. Confidence scores 0-1.
```

### 3.2. Real provider — `src/lib/ai/claude-provider.ts`

Thin client that calls the Edge Function. Same interface as `mockProvider`:

```ts
import type { ThoughtAiProvider } from "./thought-suggestions";
import { supabase } from "@/lib/supabase/client";

export const claudeProvider: ThoughtAiProvider = {
  async generateTitle(text) { /* one-shot Edge Function call */ },
  async buildPlan(thought, ctx) {
    const { data, error } = await supabase.functions.invoke("thoughts-ai", {
      body: {
        text: thought.text_content ?? "",
        taskLists: ctx.taskLists.map((l) => ({ id: l.id, name: l.name, color: l.color })),
        thoughtLists: ctx.thoughtLists.map((l) => ({ id: l.id, name: l.name })),
        recentTasks: ctx.recentTasks ?? [],
      },
    });
    if (error) throw error;
    return data as AiPlan;
  },
};
```

### 3.3. Wire into the banner — one-line change

`src/components/thoughts/ThoughtAiBanner.tsx`:
```ts
- import { mockProvider } from "@/lib/ai/thought-suggestions";
+ import { claudeProvider as aiProvider } from "@/lib/ai/claude-provider";
```

(Or feature-flag: read `import.meta.env.VITE_AI_PROVIDER` and pick.)

### 3.4. Fallback / error path

If the Edge Function returns an error (network, Anthropic outage, rate limit),
**fall back to the mock**. Better to give the user the deterministic 10-scenario
brainstorm than nothing. Show a small "ה-AI לא זמין כרגע, מציגה הצעות מקומיות"
hint at the top of the banner.

### 3.5. Caching

- **Per-thought** — once a plan is built for a thought, cache it in React Query
  by `thoughtId`. Re-opening the banner doesn't re-call Claude. (Already true
  for the mock; just generalize.)
- **Anthropic prompt caching** — system prompt + the user's task lists (which
  rarely change) get marked cacheable. Cache TTL is 5 min; in a busy session
  every thought after the first hits the warm cache.

---

## 4. Cost estimate

Using **Claude Haiku 4.5** with prompt caching:

- Cached input: ~$0.10 / MTok (90% off the $1 base)
- Output: ~$5 / MTok
- Typical thought: ~3K input (mostly cached), ~500 output → **~$0.003 per
  thought**
- Heavy user (1000 thoughts/month) → **~$3/month**
- Light user (100 thoughts/month) → **~$0.30/month**

Anthropic rate limits for new accounts are generous; a $20 budget cap covers
~6,000 thoughts. Effectively negligible until growth.

---

## 5. What we keep from the mock

The mock isn't going away — it stays as the **fallback** (per 3.4). It also
serves as documentation for the kinds of outputs Claude should produce. The 10
scenarios in `SCENARIOS` are the smoke-test set: when we wire Claude, run a
thought through each scenario template and confirm Claude's output looks
similar-or-better.

---

## 6. Migration step-by-step (when we resume)

1. **User**: generate Anthropic API key + paste into Supabase secrets as
   `ANTHROPIC_API_KEY`.
2. **Me**: scaffold `supabase/functions/thoughts-ai/` (Deno + Anthropic SDK).
3. **Me**: deploy the function (`supabase functions deploy thoughts-ai`).
4. **Me**: add `claudeProvider` in `src/lib/ai/claude-provider.ts`.
5. **Me**: feature-flag in the banner (`VITE_AI_PROVIDER=claude` enables it,
   default = mock).
6. **Together**: smoke test 5–10 representative thoughts, confirm the JSON
   shape Claude returns matches `AiPlan` exactly.
7. **Me**: flip the default to Claude. Mock stays as fallback.
8. **Me**: SPEC Changelog entry + updated §8 to reflect the live provider.

---

## 7. Open questions for the next session

- **Speech-to-text** — should the AI also handle `app_audio` thoughts? Today
  audio thoughts aren't transcribed at all. We can either (a) defer until the
  recordings phase wires Gladia, or (b) call Gladia directly from the same
  Edge Function for short thought-audio. Decide before coding.
- **Multi-turn** — should the user be able to ask the AI to refine its plan
  ("make the tasks more granular", "this is for work, not family")? Adds a
  chat affordance; we'd add a `refinePlan(prevPlan, instruction)` method to the
  provider. Probably yes, but can ship the first iteration without it.
- **PII** — Anthropic's data-retention defaults are 30 days. For an app where
  users dump personal thoughts, we may want to opt into the zero-retention
  business plan once we have paying users. Not blocking.

---

_Reference: SPEC.md §8 (AI + recordings + storage), §28 #9 (no secrets in
browser), §19 (Thoughts screen)._
