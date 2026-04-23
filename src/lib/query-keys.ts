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
  taskAttachments: (taskId: string) => ["task", taskId, "attachments"] as const,
  taskCustomFields: (projectId: string) =>
    ["project", projectId, "custom-fields"] as const,

  // Task lists
  taskLists: (orgId: string) => ["task-lists", orgId] as const,
  taskList: (listId: string) => ["task-list", listId] as const,

  // Projects
  projects: (orgId: string, filters?: FilterConfig) =>
    ["projects", orgId, filters ?? {}] as const,
  project: (projectId: string) => ["project", projectId] as const,
  projectExpenses: (projectId: string) => ["project", projectId, "expenses"] as const,
  projectTemplates: (orgId: string) => ["project-templates", orgId] as const,

  // Events
  events: (orgId: string, filters?: FilterConfig) =>
    ["events", orgId, filters ?? {}] as const,
  event: (eventId: string) => ["event", eventId] as const,
  eventParticipants: (eventId: string) => ["event", eventId, "participants"] as const,

  // Recordings
  recordings: (orgId: string, filters?: FilterConfig) =>
    ["recordings", orgId, filters ?? {}] as const,
  recording: (recordingId: string) => ["recording", recordingId] as const,
  recordingSpeakers: (recordingId: string) =>
    ["recording", recordingId, "speakers"] as const,
  recordingTasks: (recordingId: string) =>
    ["recording", recordingId, "tasks"] as const,

  // Thoughts
  thoughts: (orgId: string, filters?: FilterConfig) =>
    ["thoughts", orgId, filters ?? {}] as const,
  thought: (thoughtId: string) => ["thought", thoughtId] as const,
  thoughtLists: (orgId: string) => ["thought-lists", orgId] as const,
  thoughtProcessings: (thoughtId: string) =>
    ["thought", thoughtId, "processings"] as const,

  // Questions
  questions: (projectId: string) => ["questions", projectId] as const,

  // Time entries / timer
  timeEntries: (taskId: string) => ["task", taskId, "time-entries"] as const,
  activeTimer: () => ["timer", "active"] as const,

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

  // Global search
  search: (orgId: string, query: string) =>
    ["search", orgId, query] as const,
} as const;

/**
 * Invalidation families — for Realtime events, invalidate the whole family.
 * Use `queryClient.invalidateQueries({ queryKey: queryFamilies.tasks(orgId) })`
 * instead of trying to invalidate specific filter permutations.
 */
export const queryFamilies = {
  allTasks: (orgId: string) => ["tasks", orgId] as const,
  allProjects: (orgId: string) => ["projects", orgId] as const,
  allEvents: (orgId: string) => ["events", orgId] as const,
  allRecordings: (orgId: string) => ["recordings", orgId] as const,
  allThoughts: (orgId: string) => ["thoughts", orgId] as const,
  allTaskLists: (orgId: string) => ["task-lists", orgId] as const,
  allThoughtLists: (orgId: string) => ["thought-lists", orgId] as const,
  allProjectTemplates: (orgId: string) => ["project-templates", orgId] as const,
  taskFamily: (taskId: string) => ["task", taskId] as const,
  projectFamily: (projectId: string) => ["project", projectId] as const,
  recordingFamily: (recordingId: string) => ["recording", recordingId] as const,
  thoughtFamily: (thoughtId: string) => ["thought", thoughtId] as const,
  eventFamily: (eventId: string) => ["event", eventId] as const,
} as const;
