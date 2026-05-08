# Multitask – Project Notes for Claude

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

## RRULE format

Rules are stored in `tasks.recurrence_rule` as RFC 5545 strings (no `RRULE:` prefix).

- `FREQ=DAILY` / `FREQ=WEEKLY;BYDAY=SU,MO` / `FREQ=MONTHLY` / `FREQ=YEARLY`
- `INTERVAL=N` – omitted when 1
- `BYHOUR=H;BYMINUTE=M` – single time slot (standard)
- `BYSLOT=HH:MM,HH:MM,...` – custom extension for multi-slot rules
- **No BYHOUR/BYMINUTE** = "no specific time" → occurrences land at **00:00** (midnight)

`expandRrule` in `calendar-utils.ts` expands a rule into `Date[]` given an anchor and a window.
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

## RrulePicker UX

- Interval: `−` / count / `+` stepper (no text input)
- Freq: `<select>` (יום/שבוע/חודש/שנה with singular/plural) on the **same row** as the stepper
- Time: optional checkbox "שעה ספציפית ביום" — unchecked by default for new rules
- Multi-time: nested checkbox "מספר פעמים ביום" — shows multiple time inputs

## Migrations applied this session

| File | Description |
|---|---|
| `20260508000001_food_sharing.sql` | Adds `food_shared` to orgs, `org_food_is_shared()` helper, updated RLS for all food tables |

## Common build errors to watch for

1. **Unused variable** (`noUnusedLocals`) — prefix with `_` or remove
2. **Prop is `(v: T) => void`**, not a React state setter — cannot pass a function, must pass a value
3. **`supabase` type lag** — cast to `any` as `const db = supabase as any` at top of service files
