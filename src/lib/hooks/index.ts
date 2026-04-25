/**
 * Barrel export for all data-layer hooks.
 * Screens should import from here:
 *   import { useTasks, useProjects } from "@/lib/hooks";
 */

export * from "./useOrgScope";
export * from "./useRealtimeSync";
export * from "./useTasks";
export * from "./useTaskLists";
export * from "./useProjects";
export * from "./useEvents";
export * from "./useRecordings";
export * from "./useThoughts";
export * from "./useThoughtLists";
export * from "./useQuestions";
export * from "./useTimer";
export * from "./useNotifications";
export * from "./useDashboardLayout";
export * from "./useListVisibility";
export * from "./useSavedFilters";
export * from "./useGlobalSearch";
export * from "./useUserTaskStatuses";
export * from "./useOrgMembers";
export * from "./useTimeUnit";
export * from "./useMaxVisibleColumns";
export * from "./useRowDisplayPrefs";
export * from "./useCalendarDayNotes";
export * from "./useEventCalendars";
