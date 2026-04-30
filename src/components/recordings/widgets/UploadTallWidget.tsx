import { useRecordingsPageCtx } from "./context";
import { RecordingDropZone } from "@/components/recordings/RecordingDropZone";

/**
 * Full upload card with drop zone area, file-types caption, and a
 * "בחירה מהמחשב" button. Shown at w=3 in the recordings layout.
 * Matches the reference screenshot 1:1.
 */
export function UploadTallWidget() {
  const ctx = useRecordingsPageCtx();
  return (
    <RecordingDropZone
      source="other"
      onUploaded={ctx.onUploaded}
      className="h-full"
    />
  );
}
