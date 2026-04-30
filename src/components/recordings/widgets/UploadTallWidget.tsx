import { useRecordingsPageCtx } from "./context";
import { RecordingDropZone } from "@/components/recordings/RecordingDropZone";

/**
 * Wraps RecordingDropZone in a full-height container so it can occupy a
 * tall narrow column. The drop-zone itself already uses flex-col + center
 * alignment, so giving it `h-full` makes it expand naturally.
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
