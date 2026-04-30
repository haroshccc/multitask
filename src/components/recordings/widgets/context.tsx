import { createContext, useContext } from "react";
import type { Recording } from "@/lib/types/domain";
import type { RecordingsFilterState } from "@/components/recordings/RecordingFilters";
import type { ListGroupingState } from "@/components/recordings/RecordingsListBanner";

/**
 * Shared state passed from <Recordings/> down to every widget on the page.
 * Widgets only get a `scopeId` from DashboardGrid, so anything page-wide
 * (filters, selection, the recording rows themselves) flows through this
 * context.
 */
export interface RecordingsPageCtx {
  // Data
  allRecordings: Recording[];
  filteredRecordings: Recording[];
  isLoading: boolean;
  listsByRecording: Map<string, Set<string>>;

  // Filters / grouping
  filters: RecordingsFilterState;
  setFilters: (next: RecordingsFilterState) => void;
  grouping: ListGroupingState;
  setGrouping: (next: ListGroupingState) => void;
  clearAll: () => void;

  // Selection
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;

  // Actions
  onStartRecording: () => void;
  onUploaded: (id: string) => void;
}

export const RecordingsPageContext = createContext<RecordingsPageCtx | null>(
  null,
);

export function useRecordingsPageCtx(): RecordingsPageCtx {
  const v = useContext(RecordingsPageContext);
  if (!v) throw new Error("RecordingsPageContext missing");
  return v;
}
