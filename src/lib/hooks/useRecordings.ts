import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as service from "@/lib/services/recordings";
import { inferExtension, type UploadProgress } from "@/lib/storage/r2";
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

export type UploadRecordingInput = {
  blob: Blob;
  source: RecordingSource;
  title?: string | null;
  durationSeconds?: number | null;
  filename?: string | null;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
};

/**
 * High-level upload: presigns + PUTs to R2, then inserts the DB row with the
 * R2-chosen key and status='uploaded'. Returns the persisted Recording.
 */
export function useUploadRecording() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: async (input: UploadRecordingInput): Promise<Recording> => {
      const { organizationId, userId } = assertOrgScope(scope);
      const ext = inferExtension({
        mimeType: input.blob.type,
        filename: input.filename ?? undefined,
      });
      const { key } = await service.uploadRecordingBlob({
        blob: input.blob,
        extension: ext,
        onProgress: input.onProgress,
        signal: input.signal,
      });
      return service.createRecording({
        organization_id: organizationId,
        owner_id: userId,
        source: input.source,
        title: input.title ?? null,
        storage_path: key,
        size_bytes: input.blob.size,
        duration_seconds: input.durationSeconds ?? null,
        mime_type: input.blob.type || `audio/${ext}`,
        status: "uploaded",
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

/**
 * Stateful wrapper around `useUploadRecording` that tracks per-upload progress
 * (0..1). Progress resets on the next call.
 */
export function useUploadRecordingWithProgress() {
  const upload = useUploadRecording();
  const [progress, setProgress] = useState<number | null>(null);

  const start = async (
    input: Omit<UploadRecordingInput, "onProgress">
  ): Promise<Recording> => {
    setProgress(0);
    try {
      return await upload.mutateAsync({
        ...input,
        onProgress: ({ loaded, total }) => {
          setProgress(total > 0 ? loaded / total : 0);
        },
      });
    } finally {
      setProgress(null);
    }
  };

  return {
    start,
    progress,
    isUploading: upload.isPending,
    error: upload.error,
    reset: () => {
      upload.reset();
      setProgress(null);
    },
  };
}

export function useRecordingAudioUrl(
  storagePath: string | null | undefined
) {
  return useQuery({
    queryKey: ["recording-audio-url", storagePath],
    queryFn: () => service.getRecordingAudioUrl(storagePath!),
    enabled: !!storagePath,
    staleTime: 50 * 60 * 1000, // R2 GET is presigned for 60m
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
