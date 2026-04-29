import { RecordingDropZone } from "@/components/recordings/RecordingDropZone";

/**
 * Thin wrapper around the existing RecordingDropZone — gives the project
 * page a quick way to attach an audio file (briefing call, voice notes, …)
 * that goes through the standard recording pipeline (transcription, AI
 * summary). Future enhancement: filter the recordings list to those tagged
 * with this project.
 */
export function UploadBlock() {
  return <RecordingDropZone source="other" className="h-full" />;
}
