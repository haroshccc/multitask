import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  Loader2,
  Mic,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { RecordingDropZone } from "@/components/recordings/RecordingDropZone";
import { useRecordings } from "@/lib/hooks";
import type { Recording } from "@/lib/types/domain";

/**
 * Project upload block.
 *  - Desktop: full RecordingDropZone (drag-drop + click).
 *  - Mobile: compact button (drag-drop on touch is not ergonomic for files).
 *  - Below either variant: collapsible list of recordings already tagged to
 *    this project, with status badge + AI-summary preview + deep link to the
 *    recording's detail page.
 */
export function UploadBlock({ scopeId }: { scopeId?: string | null }) {
  const projectId = scopeId ?? null;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Drop zone — full visual on desktop only. */}
      <div className="hidden md:block shrink-0">
        <RecordingDropZone source="other" projectId={projectId} />
      </div>
      {/* Compact uploader on mobile — just a button. */}
      <div className="md:hidden shrink-0">
        <MobileUploadButton projectId={projectId} />
      </div>

      <ProjectRecordingsList projectId={projectId} />
    </div>
  );
}

// ─── Mobile compact button ──────────────────────────────────────────────────

/**
 * Pinned button replacement for the drop zone. Clicking opens the native file
 * picker via the same RecordingDropZone pipeline — we render the zone with a
 * 0-height container so its hidden `<input type="file">` still receives clicks
 * but the visuals (drop UI) never appear.
 */
function MobileUploadButton({ projectId }: { projectId: string | null }) {
  const [resetCounter, setResetCounter] = useState(0);
  const wrapperId = `mobile-upload-zone-${resetCounter}`;
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => {
          const root = document.getElementById(wrapperId);
          const input = root?.querySelector(
            'input[type="file"]'
          ) as HTMLInputElement | null;
          input?.click();
        }}
        className="btn-accent text-sm w-full flex items-center justify-center gap-1.5"
      >
        <Upload className="w-4 h-4" />
        העלי הקלטה
      </button>
      <div id={wrapperId} className="h-0 overflow-hidden">
        <RecordingDropZone
          source="other"
          projectId={projectId}
          onUploaded={() => setResetCounter((k) => k + 1)}
        />
      </div>
    </div>
  );
}

// ─── Recordings list (project-scoped) ──────────────────────────────────────

function ProjectRecordingsList({ projectId }: { projectId: string | null }) {
  const { data: allRecordings = [], isLoading } = useRecordings();
  const list = useMemo(
    () => allRecordings.filter((r) => r.project_id === projectId),
    [allRecordings, projectId]
  );

  if (!projectId) return null;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
      <header className="flex items-center justify-between mb-1.5 sticky top-0 bg-white pb-1">
        <span className="eyebrow">הקלטות בפרויקט</span>
        <span className="text-[10px] text-ink-400 tabular-nums">
          {list.length}
        </span>
      </header>
      {isLoading ? (
        <div className="text-center py-4">
          <Loader2 className="w-4 h-4 animate-spin mx-auto text-ink-400" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-[11px] text-ink-400 text-center py-4">
          עוד אין הקלטות בפרויקט.
        </p>
      ) : (
        <ul className="space-y-1">
          {list.map((r) => (
            <RecordingRow key={r.id} recording={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RecordingRow({ recording }: { recording: Recording }) {
  const [open, setOpen] = useState(false);
  const status = humanizeStatus(recording);
  const summary = pickSummary(recording);

  return (
    <li className="rounded-md border border-ink-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-ink-50 rounded-md text-start"
      >
        <Mic className="w-3.5 h-3.5 text-ink-400 shrink-0" />
        <span className="text-[12px] text-ink-900 truncate flex-1 min-w-0">
          {recording.title || "(ללא שם)"}
        </span>
        <StatusPill status={status} />
        {open ? (
          <ChevronDown className="w-3 h-3 text-ink-400 shrink-0" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-ink-400 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-3 py-2 border-t border-ink-100 space-y-1.5">
          <p className="text-[11px] text-ink-700 leading-relaxed whitespace-pre-wrap">
            {summary || (
              <span className="text-ink-400">
                {status.kind === "processing"
                  ? "סיכום AI יופיע כאן בסיום העיבוד."
                  : "אין סיכום עדיין."}
              </span>
            )}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-ink-400">
              {new Date(recording.created_at).toLocaleString("he-IL")}
            </span>
            <Link
              to={`/app/recordings?id=${recording.id}`}
              className="text-[11px] text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
            >
              פתחי את ההקלטה
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

type HumanStatus = {
  kind: "uploading" | "processing" | "ready" | "failed" | "other";
  label: string;
};

function humanizeStatus(r: Recording): HumanStatus {
  if (r.status === "error") return { kind: "failed", label: "כשל" };
  if (r.status === "recording" || r.status === "uploaded") {
    return { kind: "uploading", label: "מעלה" };
  }
  if (
    r.status === "transcribing" ||
    r.status === "extracting" ||
    r.status === "processing" ||
    r.ai_status === "pending"
  ) {
    return { kind: "processing", label: "בעיבוד" };
  }
  if (
    r.status === "ready" ||
    r.status === "processed" ||
    r.ai_status === "done" ||
    r.summary
  ) {
    return { kind: "ready", label: "סיכום מוכן" };
  }
  return { kind: "other", label: r.status };
}

function pickSummary(r: Recording): string | null {
  // User-edited summary wins. Falls back to the AI's short summary.
  const userSummary = r.summary?.trim();
  if (userSummary) return userSummary;
  const aiOutput = r.ai_output as { short_summary?: string } | null;
  const aiShort = aiOutput?.short_summary?.trim();
  return aiShort || null;
}

function StatusPill({ status }: { status: HumanStatus }) {
  const cls = cn(
    "shrink-0 inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-[10px] font-medium",
    status.kind === "ready" && "bg-success/10 text-success-600",
    status.kind === "processing" && "bg-primary-50 text-primary-700",
    status.kind === "uploading" && "bg-ink-100 text-ink-600",
    status.kind === "failed" && "bg-danger/10 text-danger",
    status.kind === "other" && "bg-ink-100 text-ink-600"
  );
  return <span className={cls}>{status.label}</span>;
}
