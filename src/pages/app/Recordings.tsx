import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mic,
  Play,
  Sparkles,
  Upload,
} from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/lib/supabase/client";
import type { Recording, RecordingStatus } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

const STATUS_META: Record<
  RecordingStatus,
  { label: string; icon: typeof Loader2; className: string }
> = {
  uploaded: { label: "הועלה", icon: Upload, className: "bg-ink-200 text-ink-700" },
  transcribing: {
    label: "מתמלל",
    icon: Loader2,
    className: "bg-primary-500/10 text-primary-700",
  },
  extracting: {
    label: "מחלץ משימות",
    icon: Sparkles,
    className: "bg-accent-purple/10 text-accent-purple",
  },
  ready: { label: "מוכן", icon: CheckCircle2, className: "bg-success-500/10 text-success-600" },
  error: { label: "שגיאה", icon: AlertTriangle, className: "bg-danger-500/10 text-danger-600" },
};

export function Recordings() {
  const { activeOrganizationId } = useAuth();

  const recordings = useQuery({
    queryKey: ["recordings", activeOrganizationId ?? "none"],
    enabled: Boolean(activeOrganizationId),
    queryFn: async (): Promise<Recording[]> => {
      const { data, error } = await supabase
        .from("recordings")
        .select("*")
        .eq("organization_id", activeOrganizationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <ScreenScaffold
      title="הקלטות"
      subtitle="תמלול, הפרדת דוברים, וחילוץ משימות אוטומטי"
    >
      <div className="card p-4 mb-4 bg-gradient-to-br from-primary-50 via-white to-ink-50 border-primary-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white shadow-soft flex items-center justify-center">
            <Mic className="w-5 h-5 text-primary-600" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-ink-900 mb-0.5">העלאת אודיו</div>
            <p className="text-sm text-ink-600">
              העלאה, תמלול ב-Gladia, והפרדת דוברים יופעלו ברגע שהחשבונות
              החיצוניים יחוברו. בינתיים, השתמשי ב"הקלטה מהירה" מה-+ למעלה כדי
              ליצור מחשבות.
            </p>
          </div>
          <button disabled className="btn-outline shrink-0">
            <Upload className="w-4 h-4" />
            בקרוב
          </button>
        </div>
      </div>

      {recordings.isLoading ? (
        <div className="card p-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-ink-400" />
        </div>
      ) : !recordings.data || recordings.data.length === 0 ? (
        <div className="card p-8 md:p-12 text-center">
          <Mic className="w-10 h-10 text-ink-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-ink-900 mb-1">אין עדיין הקלטות</h2>
          <p className="text-sm text-ink-600">
            כשיש חשבון Gladia פעיל — תוכלי להעלות אודיו, לקבל תמלול בעברית עם
            הפרדת דוברים, וחילוץ משימות אוטומטי.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {recordings.data.map((rec) => {
            const meta = STATUS_META[rec.status];
            const Icon = meta.icon;
            return (
              <li key={rec.id} className="card-lift p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-ink-100 text-ink-700 flex items-center justify-center shrink-0">
                  <Mic className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">
                    {rec.title ?? "(ללא כותרת)"}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={cn("chip", meta.className)}>
                      <Icon
                        className={cn(
                          "w-3 h-3",
                          (rec.status === "transcribing" || rec.status === "extracting") &&
                            "animate-spin"
                        )}
                      />
                      {meta.label}
                    </span>
                    {rec.duration_seconds && (
                      <span className="chip">
                        {formatDuration(rec.duration_seconds)}
                      </span>
                    )}
                    <span className="text-xs text-ink-500">
                      {formatDistanceToNow(new Date(rec.created_at), {
                        addSuffix: true,
                        locale: he,
                      })}
                    </span>
                  </div>
                  {rec.summary && (
                    <p className="text-xs text-ink-600 mt-1 line-clamp-2">{rec.summary}</p>
                  )}
                </div>
                <button
                  disabled
                  className="btn-ghost shrink-0"
                  aria-label="נגן"
                  title="נגן (בקרוב)"
                >
                  <Play className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </ScreenScaffold>
  );
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
