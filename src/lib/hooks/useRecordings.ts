import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as service from "@/lib/services/recordings";
import { presignDownload } from "@/lib/services/storage";
import type {
  Recording,
  RecordingInsert,
  RecordingUpdate,
  RecordingSource,
  RecordingSpeaker,
} from "@/lib/types/domain";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

export function useRecordings(options?: {
  includeArchived?: boolean;
  source?: RecordingSource;
}) {
  const scope = useOrgScope();
  return useQuery<Recording[]>({
    queryKey: queryKeys.recordings(scope.organizationId ?? "", options),
    queryFn: () => service.listRecordings(scope.organizationId!, options),
    enabled: scope.enabled,
  });
}

export function useRecording(recordingId: string | null | undefined) {
  return useQuery<Recording | null>({
    queryKey: queryKeys.recording(recordingId ?? ""),
    queryFn: () => service.getRecording(recordingId!),
    enabled: !!recordingId,
  });
}

export function useCreateRecording() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (
      input: Omit<RecordingInsert, "organization_id" | "owner_id">
    ) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createRecording({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allRecordings(scope.organizationId),
        });
      }
    },
  });
}

export function useUpdateRecording() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      recordingId,
      patch,
    }: {
      recordingId: string;
      patch: RecordingUpdate;
    }) => service.updateRecording(recordingId, patch),
    onMutate: async ({ recordingId, patch }) => {
      await qc.cancelQueries({ queryKey: queryKeys.recording(recordingId) });
      const previous = qc.getQueryData<Recording>(queryKeys.recording(recordingId));
      if (previous) {
        qc.setQueryData<Recording>(queryKeys.recording(recordingId), {
          ...previous,
          ...patch,
        } as Recording);
      }
      return { previous };
    },
    onError: (_err, { recordingId }, ctx) => {
      if (ctx?.previous)
        qc.setQueryData(queryKeys.recording(recordingId), ctx.previous);
    },
    onSettled: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allRecordings(scope.organizationId),
        });
      }
    },
  });
}

/** Legacy Supabase-Storage upload mutation. R2 uploads use `useFileUpload`. */
export function useUploadRecordingBlobLegacy() {
  return useMutation({
    mutationFn: ({ storageKey, blob }: { storageKey: string; blob: Blob }) =>
      service.uploadRecordingBlobLegacy(storageKey, blob),
  });
}

/** Legacy Supabase-Storage signed URL. R2 rows use `presignDownload`. */
export function useRecordingAudioUrlLegacy(
  storageKey: string | null | undefined
) {
  return useQuery({
    queryKey: ["recording-audio-url-legacy", storageKey],
    queryFn: () => service.getRecordingAudioUrlLegacy(storageKey!),
    enabled: !!storageKey,
    staleTime: 50 * 60 * 1000, // slightly under the default 60m signed-url lifetime
  });
}

/**
 * Provider-aware signed URL for playback. Switches between R2
 * (`storage/presign-get` Edge Function) and the legacy Supabase Storage path
 * based on `recording.storage_provider`. Disabled when audio has been archived.
 */
export function useRecordingAudioUrl(recording: Recording | null | undefined) {
  return useQuery({
    queryKey: [
      "recording-audio-url",
      recording?.id,
      recording?.storage_provider,
      recording?.storage_key,
    ],
    queryFn: async (): Promise<string> => {
      if (!recording) throw new Error("no_recording");
      if (recording.storage_provider === "r2") {
        const { url } = await presignDownload(recording.storage_key);
        return url;
      }
      return service.getRecordingAudioUrlLegacy(recording.storage_key);
    },
    enabled: !!recording && !recording.audio_archived,
    staleTime: 50 * 60 * 1000,
  });
}

export function useTriggerRecordingProcessing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recordingId: string) => service.triggerProcessing(recordingId),
    onSuccess: (_data, recordingId) => {
      qc.invalidateQueries({ queryKey: queryKeys.recording(recordingId) });
    },
  });
}

/**
 * Polls Gladia directly via the `transcribe-poll` Edge Function. Used as a
 * fallback when the webhook is delayed or fails to deliver. Wire it up with
 * `enabled: status === 'transcribing'` and a `refetchInterval` ~30s.
 */
export function useTranscriptionPoll(recordingId: string, enabled: boolean) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["transcription-poll", recordingId],
    queryFn: async () => {
      const out = await service.pollTranscription(recordingId);
      if (out.status === "ready" || out.status === "error") {
        qc.invalidateQueries({ queryKey: queryKeys.recording(recordingId) });
      }
      return out;
    },
    enabled,
    refetchInterval: enabled ? 30_000 : false,
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });
}

export function useSaveRecordingTranscriptEdits() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      recordingId,
      edits,
    }: {
      recordingId: string;
      edits: { index: number; text: string }[];
    }) => service.saveRecordingTranscriptEdits(recordingId, edits),
    onSuccess: (data, { recordingId }) => {
      qc.setQueryData(queryKeys.recording(recordingId), data);
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allRecordings(scope.organizationId),
        });
      }
    },
  });
}

export function useTriggerAiProcessing() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ recordingId, customPrompt }: { recordingId: string; customPrompt?: string }) =>
      service.triggerAiProcessing(recordingId, customPrompt),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.recording(data.id), data);
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allRecordings(scope.organizationId),
        });
      }
    },
  });
}

export function useAskRecordingFreeText() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recordingId, question }: { recordingId: string; question: string }) =>
      service.askRecordingFreeText(recordingId, question),
    onSuccess: (_data, { recordingId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.recording(recordingId) });
      qc.invalidateQueries({
        queryKey: queryKeys.recordingFreeTextHistory(recordingId),
      });
    },
  });
}

export function useClearRecordingFreeTextHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recordingId: string) =>
      service.clearRecordingFreeTextHistory(recordingId),
    onSuccess: (_data, recordingId) => {
      qc.invalidateQueries({ queryKey: queryKeys.recording(recordingId) });
      qc.invalidateQueries({
        queryKey: queryKeys.recordingFreeTextHistory(recordingId),
      });
    },
  });
}

export function useRecordingFreeTextHistory(recordingId: string | null) {
  return useQuery({
    queryKey: queryKeys.recordingFreeTextHistory(recordingId ?? ""),
    queryFn: () => service.getRecordingFreeTextHistory(recordingId!),
    enabled: !!recordingId,
  });
}

export function useDeleteRecording() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (recordingId: string) => service.deleteRecording(recordingId),
    onSuccess: (_data, recordingId) => {
      qc.removeQueries({ queryKey: queryKeys.recording(recordingId) });
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allRecordings(scope.organizationId),
        });
      }
    },
  });
}

export function useMergeRecordingsMany() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (orderedIds: string[]) => service.mergeRecordingsMany(orderedIds),
    onSuccess: (survivor) => {
      qc.setQueryData(queryKeys.recording(survivor.id), survivor);
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allRecordings(scope.organizationId),
        });
      }
    },
  });
}

export function useMergeRecordings() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: { firstId: string; secondId: string }) =>
      service.mergeRecordings(input),
    onSuccess: (survivor) => {
      qc.setQueryData(queryKeys.recording(survivor.id), survivor);
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allRecordings(scope.organizationId),
        });
      }
    },
  });
}

export function useArchiveRecordingAudio() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (recordingId: string) => service.archiveRecordingAudio(recordingId),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allRecordings(scope.organizationId),
        });
      }
    },
  });
}

// Speakers ------------------------------------------------------------------

export function useSpeakerLabelSuggestions(projectId?: string | null) {
  const scope = useOrgScope();
  return useQuery<string[]>({
    queryKey: ["speaker-label-suggestions", scope.organizationId, projectId ?? "_none_"],
    queryFn: () =>
      service.listSpeakerLabelSuggestions({
        organizationId: scope.organizationId!,
        projectId: projectId ?? null,
      }),
    enabled: scope.enabled,
  });
}

export function useUpsertRecordingSpeakerLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      recordingId: string;
      speakerIndex: number;
      label: string;
    }) => service.upsertRecordingSpeakerLabel(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.recordingSpeakers(vars.recordingId),
      });
      qc.invalidateQueries({ queryKey: ["speaker-label-suggestions"] });
    },
  });
}

export function useRecordingSpeakers(recordingId: string | null | undefined) {
  return useQuery<RecordingSpeaker[]>({
    queryKey: queryKeys.recordingSpeakers(recordingId ?? ""),
    queryFn: () => service.listRecordingSpeakers(recordingId!),
    enabled: !!recordingId,
  });
}

export function useUpdateRecordingSpeaker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      speakerId,
      patch,
    }: {
      speakerId: string;
      recordingId: string;
      patch: Parameters<typeof service.updateRecordingSpeaker>[1];
    }) => service.updateRecordingSpeaker(speakerId, patch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.recordingSpeakers(vars.recordingId),
      });
    },
  });
}
