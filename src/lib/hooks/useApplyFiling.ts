import { useUpdateRecording, useUpsertRecordingSpeakerLabel } from "./useRecordings";
import { useCreateProject } from "./useProjects";
import {
  useCreateRecordingList,
  useAssignRecordingToList,
} from "./useRecordingLists";
import { mapSuggestedName } from "@/lib/utils/filing-suggestions";
import type { RecordingAiOutput } from "@/lib/services/recordings";
import type { Recording, RecordingSource } from "@/lib/types/domain";

/** A project / recording-list choice: keep existing, pick existing, or create. */
export type FilingSel =
  | { kind: "none" }
  | { kind: "existing"; id: string }
  | { kind: "new"; name: string };

export interface FilingPlan {
  /** Only applied when defined. `null` clears the title. */
  title?: string | null;
  source?: RecordingSource;
  sourceCustom?: string | null;
  tags?: string[];
  project?: FilingSel;
  list?: FilingSel;
  /** speakerIndex → label; only changed labels are written. */
  speakerLabels?: Record<number, string>;
}

export interface ApplyContext {
  currentProjectId: string | null;
  existingAssignments: string[];
  existingSpeakers: Array<{ speaker_index: number; label: string | null }>;
}

/** Turn an AI `suggested_filing` into a concrete selection for the plan. */
export function selFromMatch(
  match: { matchId: string | null; proposeNew?: string },
): FilingSel {
  if (match.matchId) return { kind: "existing", id: match.matchId };
  if (match.proposeNew) return { kind: "new", name: match.proposeNew };
  return { kind: "none" };
}

/**
 * Build a FilingPlan purely from the AI suggestions on a recording. Used by the
 * one-tap "תייק ✨" action and to pre-fill the wizard. Fields with no suggestion
 * are left `undefined` so they aren't touched.
 */
export function planFromAiSuggestions(
  ai: RecordingAiOutput | null,
  projects: Array<{ id: string; name: string }>,
  lists: Array<{ id: string; name: string }>,
): FilingPlan {
  if (!ai) return {};
  const projectMatch = mapSuggestedName(ai.suggested_filing?.project, projects);
  const listMatch = mapSuggestedName(ai.suggested_filing?.recording_list, lists);
  return {
    title: ai.suggested_title?.trim() ? ai.suggested_title.trim() : undefined,
    source: (ai.suggested_source as RecordingSource | undefined) || undefined,
    sourceCustom: ai.suggested_source_custom ?? undefined,
    tags:
      Array.isArray(ai.suggested_tags) && ai.suggested_tags.length
        ? ai.suggested_tags
        : undefined,
    project: ai.suggested_filing?.project ? selFromMatch(projectMatch) : undefined,
    list: ai.suggested_filing?.recording_list
      ? selFromMatch(listMatch)
      : undefined,
  };
}

/** True when the plan would actually file the recording somewhere meaningful. */
export function planHasFiling(plan: FilingPlan): boolean {
  const sel = (s?: FilingSel) => s && s.kind !== "none";
  return Boolean(sel(plan.project) || sel(plan.list) || plan.tags?.length);
}

/**
 * Shared save path for ALL filing surfaces (one-tap, inline quick panel, full
 * wizard). Touches only the recordings-side tables — never the task-save path.
 * Writes one recording patch + at most one list assignment + changed speaker
 * labels, creating a project / list first when the plan asks for a new one.
 */
export function useApplyFiling() {
  const update = useUpdateRecording();
  const createProject = useCreateProject();
  const createList = useCreateRecordingList();
  const assignToList = useAssignRecordingToList();
  const upsertSpeaker = useUpsertRecordingSpeakerLabel();

  return async function apply(
    recording: Recording,
    plan: FilingPlan,
    ctx?: Partial<ApplyContext>,
  ): Promise<void> {
    const currentProjectId = ctx?.currentProjectId ?? recording.project_id;
    const existingAssignments = ctx?.existingAssignments ?? [];
    const existingSpeakers = ctx?.existingSpeakers ?? [];

    // 1) Resolve the project link (create if new) so it joins the single patch.
    let projectId: string | null | undefined;
    if (plan.project?.kind === "new" && plan.project.name.trim()) {
      const created = await createProject.mutateAsync({ name: plan.project.name.trim() });
      projectId = created?.id ?? undefined;
    } else if (plan.project?.kind === "existing") {
      projectId = plan.project.id;
    } else if (plan.project?.kind === "none") {
      projectId = currentProjectId ? null : undefined; // clear only if set
    }

    // 2) One recording patch with all row-level fields.
    const patch: Record<string, unknown> = {};
    if (plan.title !== undefined) patch.title = plan.title;
    if (plan.source !== undefined) {
      patch.source = plan.source;
      patch.source_custom =
        plan.source === "other" ? plan.sourceCustom?.trim() || null : null;
    }
    if (plan.tags !== undefined) patch.tags = plan.tags;
    if (projectId !== undefined) patch.project_id = projectId;
    if (Object.keys(patch).length > 0) {
      await update.mutateAsync({ recordingId: recording.id, patch });
    }

    // 3) Recording list (create if new, then assign — never unassign here).
    if (plan.list?.kind === "new" && plan.list.name.trim()) {
      const created = await createList.mutateAsync({ name: plan.list.name.trim() });
      if (created?.id)
        await assignToList.mutateAsync({ recordingId: recording.id, listId: created.id });
    } else if (plan.list?.kind === "existing") {
      if (!existingAssignments.includes(plan.list.id))
        await assignToList.mutateAsync({ recordingId: recording.id, listId: plan.list.id });
    }

    // 4) Speaker labels (only changed ones).
    if (plan.speakerLabels) {
      for (const s of existingSpeakers) {
        const next = plan.speakerLabels[s.speaker_index]?.trim() ?? "";
        if (next && next !== (s.label?.trim() ?? "")) {
          await upsertSpeaker.mutateAsync({
            recordingId: recording.id,
            speakerIndex: s.speaker_index,
            label: next,
          });
        }
      }
    }
  };
}
