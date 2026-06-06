import {
  FolderKanban,
  ListChecks,
  Paperclip,
  FileText,
  Users,
  UserCheck,
  Calendar as CalendarIcon,
} from "lucide-react";
import type { ThoughtDevelopment } from "@/lib/types/thought-developments";

/** Visual ownership/sharing state for a development. */
export type DevShareState = "private" | "mine-shared" | "shared-with-me";

export interface DevCardMeta {
  sourceCount: number;
  summaryCount: number;
  shareState: DevShareState;
  linkLabel: string | null;
  linkKind: "project" | "list" | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ThoughtDevelopmentCard({
  dev,
  meta,
  onOpen,
}: {
  dev: ThoughtDevelopment;
  meta: DevCardMeta;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card text-start p-3 flex flex-col gap-2 hover:shadow-lift transition-shadow"
      dir="rtl"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-ink-900 leading-tight line-clamp-2">
          {dev.name || "ללא שם"}
        </h3>
        <ShareBadge state={meta.shareState} />
      </div>

      {dev.description && (
        <p className="text-xs text-ink-500 line-clamp-2">{dev.description}</p>
      )}

      {meta.linkLabel && (
        <span className="inline-flex items-center gap-1 self-start rounded-full bg-ink-100 text-ink-700 text-[11px] px-2 py-0.5 max-w-full">
          {meta.linkKind === "project" ? (
            <FolderKanban className="w-3 h-3 shrink-0" />
          ) : (
            <ListChecks className="w-3 h-3 shrink-0" />
          )}
          <span className="truncate">{meta.linkLabel}</span>
        </span>
      )}

      <div className="flex items-center gap-3 text-[11px] text-ink-400 mt-auto pt-1">
        <span className="inline-flex items-center gap-1" title="קבצי מקור">
          <Paperclip className="w-3 h-3" />
          {meta.sourceCount}
        </span>
        <span className="inline-flex items-center gap-1" title="קבצי סיכום">
          <FileText className="w-3 h-3" />
          {meta.summaryCount}
        </span>
        <span className="inline-flex items-center gap-1 ms-auto">
          <CalendarIcon className="w-3 h-3" />
          {formatDate(dev.written_at)}
        </span>
      </div>
    </button>
  );
}

function ShareBadge({ state }: { state: DevShareState }) {
  if (state === "private") return null;
  if (state === "shared-with-me") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0.5 shrink-0"
        title="שותף איתי"
      >
        <UserCheck className="w-3 h-3" />
        שותף איתי
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-pink-50 text-pink-600 text-[10px] px-1.5 py-0.5 shrink-0"
      title="שיתפתי עם אחרים"
    >
      <Users className="w-3 h-3" />
      שיתפתי
    </span>
  );
}

export { formatDate as formatDevDate };
