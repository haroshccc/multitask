/**
 * Centralized query key factory — single source of truth for React Query.
 *
 * Every hook that reads or invalidates data MUST use these keys.
 * This guarantees Realtime events can find the correct caches to invalidate
 * and that optimistic updates hit the right entries.
 */

import type { FilterConfig } from "@/lib/types/domain";

export const queryKeys = {
  // Organizations + profiles
  currentProfile: () => ["profile", "me"] as const,
  organization: (orgId: string) => ["organization", orgId] as const,
  organizationMembers: (orgId: string) => ["organization", orgId, "members"] as const,

  // Tasks
  tasks: (orgId: string, filters?: FilterConfig) =>
    ["tasks", orgId, filters ?? {}] as const,
  task: (taskId: string) => ["task", taskId] as const,
  tasksByList: (orgId: string, listId: string | null) =>
    ["tasks", orgId, "list", listId ?? "__none__"] as const,
  tasksByProject: (orgId: string, projectId: string) =>
    ["tasks", orgId, "project", projectId] as const,
  taskDependencies: (taskId: string) => ["task", taskId, "dependencies"] as const,
  allTaskDependencies: (orgId: string) =>
    ["task-dependencies", orgId] as const,
  taskAttachments: (taskId: string) => ["task", taskId, "attachments"] as const,
  taskCustomFields: (projectId: string) =>
    ["project", projectId, "custom-fields"] as const,

  // Task lists
  taskLists: (orgId: string) => ["task-lists", orgId] as const,
  taskList: (listId: string) => ["task-list", listId] as const,

  // Goal plans (תוכניות עבודה)
  plans: (orgId: string) => ["plans", orgId] as const,
  plan: (planId: string) => ["plan", planId] as const,
  planTasks: (planId: string) => ["plan", planId, "tasks"] as const,
  planDecisions: (planId: string) => ["plan", planId, "decisions"] as const,
  planStageImpacts: (planId: string) => ["plan", planId, "impacts"] as const,

  // Projects
  projects: (orgId: string, filters?: FilterConfig) =>
    ["projects", orgId, filters ?? {}] as const,
  project: (projectId: string) => ["project", projectId] as const,
  projectExpenses: (projectId: string) => ["project", projectId, "expenses"] as const,
  projectTemplates: (orgId: string) => ["project-templates", orgId] as const,

  // Events
  events: (orgId: string, filters?: Record<string, unknown>) =>
    ["events", orgId, filters ?? {}] as const,
  event: (eventId: string) => ["event", eventId] as const,
  eventParticipants: (eventId: string) => ["event", eventId, "participants"] as const,

  // Recordings
  recordings: (orgId: string, filters?: Record<string, unknown>) =>
    ["recordings", orgId, filters ?? {}] as const,
  recording: (recordingId: string) => ["recording", recordingId] as const,
  recordingSpeakers: (recordingId: string) =>
    ["recording", recordingId, "speakers"] as const,
  recordingTasks: (recordingId: string) =>
    ["recording", recordingId, "tasks"] as const,
  recordingLists: (orgId: string) => ["recording-lists", orgId] as const,
  recordingListAssignments: (recordingId: string) =>
    ["recording", recordingId, "lists"] as const,
  recordingFreeTextHistory: (recordingId: string) =>
    ["recording", recordingId, "free-text-qa"] as const,

  // Thoughts
  thoughts: (orgId: string, filters?: Record<string, unknown>) =>
    ["thoughts", orgId, filters ?? {}] as const,
  thought: (thoughtId: string) => ["thought", thoughtId] as const,
  thoughtLists: (orgId: string) => ["thought-lists", orgId] as const,
  thoughtProcessings: (thoughtId: string) =>
    ["thought", thoughtId, "processings"] as const,

  // Questions
  questions: (projectId: string) => ["questions", projectId] as const,

  // Time entries / timer
  timeEntries: (taskId: string) => ["task", taskId, "time-entries"] as const,
  timeEntriesByRange: (orgId: string, from: string, to: string) =>
    ["time-entries-range", orgId, from, to] as const,
  activeTimer: () => ["timer", "active"] as const,

  // Task edit history
  taskEdits: (taskId: string) => ["task", taskId, "edits"] as const,

  // Notifications
  notifications: (userId: string) => ["notifications", userId] as const,
  unreadNotificationsCount: (userId: string) =>
    ["notifications", userId, "unread-count"] as const,

  // User preferences
  dashboardLayout: (userId: string, screenKey: string, scopeId?: string | null) =>
    ["dashboard-layout", userId, screenKey, scopeId ?? "__global__"] as const,
  listVisibility: (userId: string, screenKey: string) =>
    ["list-visibility", userId, screenKey] as const,
  savedFilters: (userId: string, screenKey: string) =>
    ["saved-filters", userId, screenKey] as const,
  userTaskStatuses: (scope: string) => ["user-task-statuses", scope] as const,
  userThoughtPreferences: (userId: string) =>
    ["user-thought-preferences", userId] as const,

  // Global search
  search: (orgId: string, query: string) =>
    ["search", orgId, query] as const,

  // Daily brief (Phase 8.2 / 8.3)
  dailyBrief: (userId: string, view: string, anchor: string) =>
    ["daily-brief", userId, view, anchor] as const,

  // Food planning
  meals: (orgId: string) => ["meals", orgId] as const,
  ingredients: (orgId: string) => ["ingredients", orgId] as const,
  mealCategories: (orgId: string) => ["meal-categories", orgId] as const,
  ingredientCategories: (orgId: string) => ["ingredient-categories", orgId] as const,
  mealPlanTemplate: (orgId: string) => ["meal-plan-template", orgId] as const,
  mealPlanDays: (orgId: string, from: string, to: string) =>
    ["meal-plan-days", orgId, from, to] as const,
  mealPlanShares: (orgId: string) => ["meal-plan-shares", orgId] as const,

  // Shopping — staples, store connections, runs
  householdStaples: (orgId: string) => ["household-staples", orgId] as const,
  storeConnections: (orgId: string) => ["store-connections", orgId] as const,
  shoppingRuns: (orgId: string) => ["shopping-runs", orgId] as const,
  shoppingRun: (runId: string) => ["shopping-run", runId] as const,

  // Frameworks ("מסגרת")
  frameworks: (orgId: string) => ["frameworks", orgId] as const,
  framework: (frameworkId: string) => ["framework", frameworkId] as const,
  frameworkContent: (frameworkId: string) =>
    ["framework", frameworkId, "content"] as const,
  frameworkShares: (frameworkId: string) =>
    ["framework", frameworkId, "shares"] as const,
  frameworkHistory: (frameworkId: string) =>
    ["framework", frameworkId, "history"] as const,
  frameworkVisibility: (userId: string, orgId: string) =>
    ["framework-visibility", userId, orgId] as const,
} as const;

/**
 * Invalidation families — for Realtime events, invalidate the whole family.
 * Use `queryClient.invalidateQueries({ queryKey: queryFamilies.tasks(orgId) })`
 * instead of trying to invalidate specific filter permutations.
 */
export const queryFamilies = {
  allTasks: (orgId: string) => ["tasks", orgId] as const,
  allTimeEntriesRange: (orgId: string) => ["time-entries-range", orgId] as const,
  allProjects: (orgId: string) => ["projects", orgId] as const,
  allEvents: (orgId: string) => ["events", orgId] as const,
  allRecordings: (orgId: string) => ["recordings", orgId] as const,
  allThoughts: (orgId: string) => ["thoughts", orgId] as const,
  allTaskLists: (orgId: string) => ["task-lists", orgId] as const,
  allThoughtLists: (orgId: string) => ["thought-lists", orgId] as const,
  allRecordingLists: (orgId: string) => ["recording-lists", orgId] as const,
  allProjectTemplates: (orgId: string) => ["project-templates", orgId] as const,
  taskFamily: (taskId: string) => ["task", taskId] as const,
  projectFamily: (projectId: string) => ["project", projectId] as const,
  recordingFamily: (recordingId: string) => ["recording", recordingId] as const,
  thoughtFamily: (thoughtId: string) => ["thought", thoughtId] as const,
  eventFamily: (eventId: string) => ["event", eventId] as const,
  allMeals: (orgId: string) => ["meals", orgId] as const,
  allIngredients: (orgId: string) => ["ingredients", orgId] as const,
  allMealCategories: (orgId: string) => ["meal-categories", orgId] as const,
  allIngredientCategories: (orgId: string) => ["ingredient-categories", orgId] as const,
  allMealPlanTemplate: (orgId: string) => ["meal-plan-template", orgId] as const,
  allMealPlanDays: (orgId: string) => ["meal-plan-days", orgId] as const,
  allMealPlanShares: (orgId: string) => ["meal-plan-shares", orgId] as const,
  allHouseholdStaples: (orgId: string) => ["household-staples", orgId] as const,
  allStoreConnections: (orgId: string) => ["store-connections", orgId] as const,
  allShoppingRuns: (orgId: string) => ["shopping-runs", orgId] as const,
  shoppingRunFamily: (runId: string) => ["shopping-run", runId] as const,
  allFrameworks: (orgId: string) => ["frameworks", orgId] as const,
  frameworkFamily: (frameworkId: string) => ["framework", frameworkId] as const,
  allPlans: (orgId: string) => ["plans", orgId] as const,
  planFamily: (planId: string) => ["plan", planId] as const,
} as const;
