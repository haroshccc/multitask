# Multitask – Project Notes for Claude

## ⚠️ חשוב לכל סשן חדש

**הקוד המלא והעדכני תמיד נמצא ב-`main`.** לפני כל עבודה:
1. בדוק ש-`git status` נקי
2. הרץ `git fetch origin main && git merge origin/main` אם ה-branch מפגר
3. קרא קבצים מה-filesystem המקומי — **לא** עם `git show origin/main:...`

הסתכל תמיד על הפריסה האמיתית: `multitask-one.vercel.app` (branch: `main`)

## 🛑 STOP-THE-WORLD: שמירת משימות (Enter / commitTitle)

כל נגיעה בנתיב יצירה/שמירה של משימות **חייבת** לעצור הכל ולהקפיץ אישור מפורש מהמשתמשת **לפני** שמדחפים. עברנו כבר באג חמור שבו לחיצת Enter על משימה שכתבנו מחקה אותה (race condition בין commitTitle/updateTask לבין createTask + cleanup useEffect), והוא נשבר בעקבות שינויים שנראו "תמימים". המחיר של רגרסיה כאן הוא איבוד עבודה של המשתמשת בלי דרך לשחזר.

**קבצים/אזורים רגישים:**
- `src/components/tasks/TaskRow.tsx` — `commitTitle`, `handleKeyDown` (Enter / Cmd+Enter / Tab / Shift+Tab / Shift+Enter), `onBlur` של ה-contentEditable, ה-useEffect-ים ב-lines ~193-215 (`task.title` reset + focus).
- `src/components/tasks/TaskColumn.tsx` — `handleCreate`, `handleEmptyCreate`, `focusTaskId` state, וה-cleanup useEffect (כרגע מנוטרל — אל תחזיר אותו בלי לוודא שאין race).
- `src/lib/hooks/useTasks.ts` — `useCreateTask` (onSuccess invalidate), `useUpdateTask` (onMutate optimistic + onSettled invalidate), `useDeleteTask`.

**הכלל:**
1. לפני שינוי שנוגע באחד מאלה — להגיד למשתמשת ספציפית מה הולך להשתנות ולמה, ולחכות לאישור מפורש.
2. אסור לדחוף ל-`main` שינוי שכזה בלי שהמשתמשת אישרה את הרגרסיה הזאת בפירוש.
3. שינויי UI/CSS באותם קבצים שלא נוגעים ל-Enter/שמירה (למשל הסרת border, החלפת תווית) — בסדר לדחוף, אבל לוודא ב-diff ש-`commitTitle | handleKeyDown | createTask | deleteTask | updateTask` לא מופיעים בשורות שמשתנות.
4. אם בכל זאת חייבים שינוי באזורים האלה — להריץ tsc, להריץ build, ולהריץ באופן ידני את הזרימה: bottom-add → Enter → inline title → Enter → blur → Enter ב-subtask (Cmd+Enter), ולוודא שאף משימה לא נעלמת ב-DB.

---

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + RLS + Edge Functions)
- **Hosting**: Vercel (production = `main` branch → `multitask-one.vercel.app`)
- **State**: TanStack Query for server state, local `useState` for UI

## Repo layout

```
src/
  components/
    calendar/       – CalendarWeekView, CalendarDayView, RrulePicker, calendar-utils
    food/           – InteractiveMenuTab, MealsTab, ShareMenuModal, MenuTaskExportModal
    tasks/          – TaskEditModal, TaskRow
    dashboard/      – widgets (BriefReorderDayCard, etc.)
    ui/             – shared primitives
  lib/
    auth/           – AuthContext
    food/           – people.tsx (useFoodPeople), task-export, shopping-list
    hooks/          – useOrganizations, useFood, useOrgMembers, useOrgScope, ...
    services/       – organizations.ts, daily-brief.ts, ...
    tasks/          – recurrence.ts  ← occurrence helpers
    types/          – database.ts (generated + manually extended), domain.ts
  pages/app/        – one file per top-level route
supabase/
  migrations/       – SQL migration files (applied via Supabase MCP)
```

## Key conventions

- **TypeScript strict**: `noUnusedLocals` is ON. Unused variables → build error on Vercel.
- **RTL**: The app is Hebrew/RTL. Use `ps-` / `pe-` instead of `pl-` / `pr-`.
- **`cn()`** from `@/lib/utils/cn` for conditional class merging.
- **`field`** Tailwind component class used on all `<input>` and `<select>` elements.
- **Supabase client**: `import { supabase } from "@/lib/supabase/client"`. Cast to `any` as `db` when typegen lags behind schema.
- **Query keys**: centralized in `src/lib/query-keys.ts`.
- **Stepper buttons**: use `w-8 py-1.5 flex items-center justify-center` (not `px-2.5`) — prevents clipping in RTL.
- **Stepper+select pairing**: wrap in a shared `inline-flex items-center gap-2` div (no `flex-wrap`) so they stay on the same line.
- **Props vs state setters**: component props typed as `(v: T) => void` cannot receive a function updater — pass the computed value directly.

## RRULE format

Rules are stored in `tasks.recurrence_rule` as RFC 5545 strings (no `RRULE:` prefix).

- `FREQ=DAILY` / `FREQ=WEEKLY;BYDAY=SU,MO` / `FREQ=MONTHLY` / `FREQ=YEARLY`
- `INTERVAL=N` – omitted when 1
- `BYHOUR=H;BYMINUTE=M` – single time slot (standard)
- `BYSLOT=HH:MM,HH:MM,...` – custom extension for multi-slot rules
- **No BYHOUR/BYMINUTE** = "no specific time" → occurrences land at **00:00** (midnight)

`expandRrule` in `calendar-utils.ts` expands a rule into `Date[]` given an anchor and a window.
- When no BYHOUR/BYMINUTE/BYSLOT: `slotsPerDay = [{ h: 0, m: 0 }]` (midnight, not anchor time)
- `useDateOnlyCompare = freq === "DAILY" || freq === "WEEKLY"` (always compare by date, not time)

`getActiveOccurrence` / `getNextFutureOccurrence` in `recurrence.ts` are the task-list helpers.

`formatRelativeOccurrence` skips the time portion when the occurrence is at midnight (= no specific time).

## Food module

### Sharing model

- **Individual sharing**: `meal_plan_shares` table — one user grants another access to their plan.
- **Org-level sharing**: `organizations.food_shared = true` OR `org_type = 'family'`
  → `org_food_is_shared(org_id)` PostgreSQL helper encapsulates this logic.
  → RLS policies on `meals`, `ingredients`, `meal_plan_days`, `meal_plan_template` allow read/write for any org member when `org_food_is_shared` is true.

`useFoodPeople()` in `src/lib/food/people.tsx` returns the list of people whose plans are visible:
- Always includes the current user (`isMe: true`)
- Includes `meal_plan_shares` grantors (`isShared: true`)
- When food is org-shared, includes **all org members**

### InteractiveMenuTab shuffle

Meals are displayed in a stable-per-mount random order (Fisher-Yates via `useRef`).
Selected meals always appear first; unselected meals are shuffled when the meal list changes.

### TopMealsBanner

Shows top-2 most-ordered meals per meal-time from the last 90 days of `meal_plan_days` history.
Rendered at the top of `InteractiveMenuTab`.

## Organizations

`org_type`: `"business" | "family" | "personal"`

Settings page (`src/pages/app/Settings.tsx`) has:
- Org name / type editor (admins/owners)
- Food sharing toggle (admins/owners, visible when org has >1 member; auto-on for family orgs)
- Member list with role management
- Invite management

## Goals / habit tracking

Stored on the `tasks` table:
| column | type | meaning |
|---|---|---|
| `goal_period` | `"day" \| "week" \| "month" \| null` | null = not a goal |
| `goal_target` | `int` | completions required per period |
| `goal_min_streak_periods` | `int \| null` | null = forever |
| `goal_started_on` | `date` | tracking start (auto-set to today if null on save) |
| `goal_track_time` | `bool` | whether to also track actual time |

**Auto-enable recurrence**: when the user enables a goal (`setGoalEnabled(true)`) and no `recurrence_rule` is set, `TaskEditModal` auto-sets `FREQ=DAILY`.

**Warning**: `GoalConfigSection` shows an amber warning when `enabled && !hasRecurrence`.

**Period+target UX**: single row — `[לבצע] [− N +] [ביום/בשבוע/בחודש select]`, no `flex-wrap`.

## RrulePicker UX

- Interval: `−` / count / `+` stepper (fixed-width `w-8` buttons, `flex justify-center`)
- Freq: `<select>` (יום/שבוע/חודש/שנה with singular/plural) on the **same row** as the stepper, inside a shared `inline-flex` wrapper
- Time: optional checkbox "שעה ספציפית ביום" — unchecked by default for new rules
- Multi-time: nested checkbox "מספר פעמים ביום" — shows multiple time inputs

## Recordings module

### Thought recordings filter
`RecordingsFilterState` (in `RecordingFilters.tsx`) includes `thoughtOnly: boolean`.
- When `thoughtOnly = true`: show **only** recordings with `source === "thought"`, hide archived toggle.
- When `thoughtOnly = false` (default): hide thought recordings from the regular list entirely.
- `filterRecordings<T extends { title, audio_archived, source? }>` generic handles both modes.

### AI Insights tabs
`AiInsights.tsx` has four tabs: `"summary" | "action_items" | "topics" | "free_text"`.
- "שאלה חופשית" tab (last in DOM = leftmost in RTL) renders `<FreeTextSection>`.
- `FreeTextSection`: textarea + "עבד בקשה" button → calls `useAskRecordingFreeText()` → returns ephemeral plain-text response below.
- The "עיבוד AI מחדש" button triggers standard processing (no custom prompt).

### Free-text Q&A service flow
`askRecordingFreeText(recordingId, question)` in `recordings.ts` calls the `summarize` Edge Function with `{ recording_id, free_text: question }`.
Edge Function (`supabase/functions/summarize/index.ts`) detects `body.free_text` and calls `callClaudeFreeText()` — plain Claude call, no tool_use schema, **no DB writes** — returns `{ response: string }`.
Hook: `useAskRecordingFreeText()` in `useRecordings.ts`.

## Food module — TomorrowMenuBanner

### Responsive layout
- **Mobile (`< sm`)**: individual `DayBanner` per day, stacked vertically, each with its own `collapsed` state.
- **Desktop (`sm:` and above)**: one unified banner — N day-tab headers in a `flex flex-nowrap` row, single shared `collapsed` state, content in a CSS grid (`repeat(N, minmax(0, 1fr))`).
- Switch via Tailwind: `sm:hidden` wrapper for mobile, `hidden sm:block` wrapper for desktop.
- Max 7 days shown (`MAX_DAYS = 7`), `datesWithPlan` derived from `useMealPlanDays(today, today+13)`.

## Push mechanism

`git push` is proxied locally and may be blocked. Use the MCP GitHub `push_files` tool for all pushes to `main`:
```
mcp__github__push_files({ owner: "haroshccc", repo: "multitask", branch: "main", files: [...], message: "..." })
```
After a successful MCP push, sync local: `git fetch origin main && git reset --hard origin/main`.
**Always push to `main`** — production runs from `main` (Vercel auto-deploys on push).

### ⚠️ Sub-agents and `push_files` — placeholder corruption hazard

Spawning a sub-agent (`Agent` tool) to call `mcp__github__push_files` for **large files** has historically caused the agent to substitute the file content with placeholders like `__TASKROW__` or `// PLACEHOLDER`, **silently corrupting `main`**. This wiped TaskRow.tsx down to 11 bytes once.

**Rules:**
- Prefer calling `mcp__github__push_files` **directly from the main session** for any non-trivial file.
- If you must delegate, the sub-agent prompt MUST:
  - Tell the agent to Read the file with no offset/limit, then strip the line-number+tab prefix.
  - List exact pre-flight checks (expected byte size, expected substrings).
  - Explicitly forbid placeholder substitution.
  - Demand abort+report on any verification failure.
- After any MCP push, verify with `git fetch origin main && git show origin/main:<path> | wc -l` before assuming success — the deploy may roll back to the previous READY build, hiding corruption.

## Migrations applied

| File | Description |
|---|---|
| `20260508000001_food_sharing.sql` | Adds `food_shared` to orgs, `org_food_is_shared()` helper, updated RLS for all food tables |

## Common build errors to watch for

1. **Unused variable** (`noUnusedLocals`) — prefix with `_` or remove
2. **Prop is `(v: T) => void`**, not a React state setter — cannot pass a function, must pass a value directly
3. **`supabase` type lag** — cast to `any` as `const db = supabase as any` at top of service files
4. **Lucide icons don't accept `title`** — `<Target title="...">` fails TS2322. Wrap in `<span title="...">` and put colors/size on the icon's `className`.

## Goal sharing — icon color (5-variant share kind)

The `<Target>` icon on a goal task is colored by its `goalShareKind`:

| share kind | meaning | color |
|---|---|---|
| `private` | my goal, not shared | `text-amber-500` |
| `mine-read` / `mine-write` | my goal, shared with others | `text-pink-500` |
| `other-read` / `other-write` | someone else's goal, shared with me | `text-blue-500` |

In `TaskRow.tsx` the icon is wrapped in `<span title="...">` (Lucide doesn't accept `title`).

### Computing share kind in different surfaces

A goal can be shared **at the list level** (`task_list_shares`) **or at the task level** (`task_shares`). Both must be checked:

- **`Goals.tsx`** (`getShareKind`) — combines `useTaskSharesForTasks(goalTaskIds)` + `useSharesForTaskLists(goalListIds)`. ✅ correct.
- **`TaskColumn.tsx`** — historically only checked list-level shares, so a task-shared goal in a private list rendered amber. **Fixed**: column now also calls `useTaskSharesForTasks(allGoalTaskIds)` and exposes `getGoalShareKind(taskId)` per row. `collectGoalTaskIds(roots)` walks the tree to find all goal task IDs.

When adding a new surface that renders the `<Target>` icon, **never** infer share kind from list-level shares alone.

## Frameworks (מסגרות) — recurring schedule templates

A framework is an independent overlay on the calendar: per-day **labels** (כותרות) and timed **blocks** (מופעים), each recurring. Toggling a framework on/off is per-user (`framework_visibility`), separate from list visibility.

### Domain & projection

- Types: `src/lib/types/frameworks.ts` — `FrameworkScope = "weekly" | "date" | "monthly"`, `FrameworkPeriodUnit = "hour" | "day" | "week" | "month"`. `framework_blocks.all_day:boolean` → all-day occurrence (renders in the month/agenda/all-day areas, not the timed grid).
- Pure engine: `src/lib/frameworks/projection.ts` — `projectFrameworkBlocks` / `projectFrameworkDayLabels` expand into dated views keyed by **local `yyyy-mm-dd`** (`toDateKey`). `matchesPeriodic(anchorKey, interval, unit, cursor)` handles every-N hour/day/week/month. Date-scoped labels override weekly, weekly override monthly.
- Hooks: `src/lib/hooks/useFrameworks.ts` — `useFrameworks`, `useFrameworkContentForMany`, `useFrameworkVisibility` / `useSetFrameworkVisibility`, `useSetBlockOccurrence`. All gate on `enabled: ids.length > 0`.

### Calendar rendering rules (learned the hard way)

- **Label vs note positioning** (all 4 views): the **framework label is always on the start side (right in RTL), grouped with the date number in a `shrink-0` wrapper**; the regular `DayNoteSlot` always fills the **end side (left in RTL)**. Label style: bold colored text, **no border / no background** (`text-[10px..13px] font-bold` + framework color).
- **Day view "missing" label is usually data, not a bug**: the day shown (defaults to the anchor/today) simply has no label. Verify against `framework_day_labels` before debugging code — week view shows labels because the whole week (incl. the labeled day) is visible.
- **Chips**: `FrameworkBlockChip` (absolute, timed grid) vs `FrameworkInlineChip` (relative — month cells, agenda, all-day strip). Both: faded fill + `1px dashed` border. **Past occurrences fade hard (`opacity-30`) regardless of done/skipped** so pink frameworks clearly recede vs a dimmed regular past event.
- **Right-click (context menu) works in all 4 views**: month chips + agenda rows fire `onItemContextMenu` → `handleItemContextMenu` in `Calendar.tsx`; week/day already had it via `CalendarBlock`.
- **Day view must clamp block geometry to the visible window** (`hourStart..hourEnd`). A task starting before `hourStart` otherwise gets a negative `top` and **bleeds upward over the date/framework header**. Clamp: `top = max(0, toPercent(start))`, `height = min(100, toPercent(end)) - top`, skip if `≤ 0`. (Week view already clamps via `percentFor`.)
- **A task must not fully hide a framework block in the same slot**: `CalendarBlock` takes `startReservePx` — when a task overlaps a framework block in time, reserve a strip on the start side (day ≈ 86px, week ≈ 16px) so the framework stays visible beside the task.

### Scheduling panel

`TaskSchedulingPanel` accepts `wide` — the panel grows (`w-80 → sm:w-96 → lg:w-[28rem]`) in **day/agenda** views (more horizontal room); week/month keep `w-72`.

## Migrations applied (frameworks)

| File | Description |
|---|---|
| `20260603181000_frameworks_block_all_day.sql` | Adds `all_day` to `framework_blocks` (all-day occurrences) |
