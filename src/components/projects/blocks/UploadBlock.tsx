import { RecordingDropZone } from "@/components/recordings/RecordingDropZone";

/**
 * Drop zone that auto-tags new recordings with the current project — when the
 * user drags audio onto the project page, the recording row is created with
 * `project_id` set so it shows up later in the project's history without an
 * extra "assign to project" step.
 */
export function UploadBlock({ scopeId }: { scopeId?: string | null }) {
  return (
    <RecordingDropZone
      source="other"
      projectId={scopeId}
      className="h-full"
    />
  );
}
