import { useRef, useState } from "react";
import {
  X,
  FileText,
  Image,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCreateTask } from "@/lib/hooks/useTasks";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import type { TaskList } from "@/lib/types/domain";

// ---------------------------------------------------------------------------

type ImportTab = "text" | "image" | "google";

interface ImportTasksModalProps {
  onClose: () => void;
}

// ---------------------------------------------------------------------------

export function ImportTasksModal({ onClose }: ImportTasksModalProps) {
  const [tab, setTab] = useState<ImportTab>("text");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="relative w-full sm:max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl
                   max-h-[90vh] flex flex-col overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-lg font-semibold text-ink-800">ייבוא משימות</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pb-3 shrink-0 border-b border-ink-100">
          <TabButton active={tab === "text"} onClick={() => setTab("text")} icon={FileText}>
            טקסט
          </TabButton>
          <TabButton active={tab === "image"} onClick={() => setTab("image")} icon={Image}>
            תמונה
          </TabButton>
          <TabButton active={tab === "google"} onClick={() => setTab("google")} icon={ExternalLink}>
            Google Tasks
          </TabButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4">
          {tab === "text" && <TextImportTab onClose={onClose} />}
          {tab === "image" && <ImageImportTab onClose={onClose} />}
          {tab === "google" && <GoogleTasksStubTab />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab button

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-brand-100 text-brand-700"
          : "text-ink-500 hover:bg-ink-100 hover:text-ink-700"
      )}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("networkerror")) {
    return "לא ניתן להגיע לשרת — ייתכן שהפיצ'ר עדיין לא פרוס. נסה שוב מאוחר יותר.";
  }
  return msg;
}

// ---------------------------------------------------------------------------
// Text import tab

type ParsedTask = { title: string; selected: boolean };

function TextImportTab({ onClose }: { onClose: () => void }) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedTask[] | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: lists = [] } = useTaskLists();
  const createTask = useCreateTask();

  const handleParse = () => {
    const lines = raw
      .split("\n")
      .map((l) => l.replace(/^[-*•·✓✗]\s*/, "").trim())
      .filter(Boolean);
    setParsed(lines.map((title) => ({ title, selected: true })));
    setDone(false);
    setError(null);
  };

  const toggleTask = (i: number) => {
    if (!parsed) return;
    setParsed(parsed.map((t, idx) => (idx === i ? { ...t, selected: !t.selected } : t)));
  };

  const handleImport = async () => {
    if (!parsed) return;
    const toImport = parsed.filter((t) => t.selected);
    if (!toImport.length) return;
    setImporting(true);
    setError(null);
    try {
      for (const t of toImport) {
        await createTask.mutateAsync({
          title: t.title,
          task_list_id: selectedListId,
          status: "todo",
        });
      }
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בייבוא");
    } finally {
      setImporting(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        <p className="text-sm font-medium text-ink-700">
          {parsed?.filter((t) => t.selected).length} משימות נוספו בהצלחה
        </p>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-500">
          הדבק רשימת משימות — כל שורה תהפוך למשימה. ניתן להשתמש ב- -, *, •, ✓ בתחילת שורה.
        </p>
        <textarea
          className="field w-full h-44 resize-none font-mono text-sm"
          placeholder={"קנות חלב\nלהתקשר לרופא\n- לשלוח דוח שבועי\n* לתאם ישיבה"}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          dir="auto"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleParse}
            disabled={!raw.trim()}
            className="btn btn-primary"
          >
            המשך
          </button>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            ביטול
          </button>
        </div>
      </div>
    );
  }

  const selectedCount = parsed.filter((t) => t.selected).length;

  return (
    <div className="space-y-3">
      {/* List selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-ink-600 shrink-0">הוסף לרשימה:</label>
        <select
          className="field flex-1 text-sm"
          value={selectedListId ?? ""}
          onChange={(e) => setSelectedListId(e.target.value || null)}
        >
          <option value="">ללא רשימה</option>
          {lists.map((l: TaskList) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      {/* Task list preview */}
      <div className="rounded-xl border border-ink-200 divide-y divide-ink-100 max-h-56 overflow-y-auto">
        {parsed.map((t, i) => (
          <label
            key={i}
            className={cn(
              "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
              t.selected ? "bg-surface" : "bg-ink-50"
            )}
          >
            <input
              type="checkbox"
              checked={t.selected}
              onChange={() => toggleTask(i)}
              className="rounded"
            />
            <span
              className={cn(
                "text-sm flex-1 truncate",
                t.selected ? "text-ink-800" : "text-ink-400 line-through"
              )}
              dir="auto"
            >
              {t.title}
            </span>
          </label>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={handleImport}
          disabled={importing || selectedCount === 0}
          className="btn btn-primary flex items-center gap-2"
        >
          {importing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          הוסף {selectedCount} משימות
        </button>
        <button
          type="button"
          onClick={() => setParsed(null)}
          className="btn btn-secondary text-sm"
        >
          חזרה
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image import tab

function ImageImportTab({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "analyzing" | "preview" | "importing" | "done" | "error">("idle");
  const [parsed, setParsed] = useState<ParsedTask[] | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: lists = [] } = useTaskLists();
  const createTask = useCreateTask();

  const handleFile = async (file: File) => {
    setState("analyzing");
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => {
          const result = e.target?.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/parse-image-tasks`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ image_base64: base64, media_type: file.type }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        const code = body?.error ?? "";
        const msg =
          code === "anthropic_not_configured" ? "מפתח AI לא מוגדר בשרת" :
          code === "image_too_large" ? "התמונה גדולה מדי (מקסימום 5MB)" :
          code === "unsupported media type" ? "סוג קובץ לא נתמך" :
          code === "unauthorized" ? "שגיאת הרשאה" :
          "שגיאת שרת — נסה שוב";
        throw new Error(msg);
      }

      const { tasks: titles } = await res.json() as { tasks: string[] };
      if (!titles?.length) throw new Error("לא נמצאו משימות בתמונה");
      setParsed(titles.map((title) => ({ title, selected: true })));
      setState("preview");
    } catch (err) {
      setError(friendlyError(err));
      setState("error");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleFile(file);
  };

  const toggleTask = (i: number) => {
    if (!parsed) return;
    setParsed(parsed.map((t, idx) => (idx === i ? { ...t, selected: !t.selected } : t)));
  };

  const handleImport = async () => {
    if (!parsed) return;
    const toImport = parsed.filter((t) => t.selected);
    if (!toImport.length) return;
    setState("importing");
    try {
      for (const t of toImport) {
        await createTask.mutateAsync({ title: t.title, task_list_id: selectedListId, status: "todo" });
      }
      setState("done");
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בייבוא");
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        <p className="text-sm font-medium text-ink-700">
          {parsed?.filter((t) => t.selected).length} משימות נוספו בהצלחה
        </p>
      </div>
    );
  }

  if (state === "idle" || state === "error") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-500">
          העלה תמונה של רשימת משימות, לוח מחיקה, פתק — Claude יחלץ את המשימות אוטומטית.
        </p>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-ink-300 rounded-xl p-8 text-center cursor-pointer
                     hover:border-brand-400 hover:bg-brand-50 transition-colors space-y-2"
        >
          <Image className="w-8 h-8 text-ink-300 mx-auto" />
          <p className="text-sm text-ink-500">גרור תמונה לכאן או לחץ לבחירה</p>
          <p className="text-xs text-ink-400">PNG, JPG, WEBP</p>
        </div>
        {state === "error" && error && (
          <div className="flex items-center gap-2 text-sm text-rose-700 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  if (state === "analyzing") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        {previewUrl && (
          <img src={previewUrl} alt="" className="h-32 rounded-lg object-contain opacity-60" />
        )}
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        <p className="text-sm text-ink-500">Claude מנתח את התמונה...</p>
      </div>
    );
  }

  // preview state
  const selectedCount = parsed?.filter((t) => t.selected).length ?? 0;

  return (
    <div className="space-y-3">
      {previewUrl && (
        <img src={previewUrl} alt="" className="h-20 rounded-lg object-contain mx-auto" />
      )}

      <div className="flex items-center gap-2">
        <label className="text-sm text-ink-600 shrink-0">הוסף לרשימה:</label>
        <select
          className="field flex-1 text-sm"
          value={selectedListId ?? ""}
          onChange={(e) => setSelectedListId(e.target.value || null)}
        >
          <option value="">ללא רשימה</option>
          {lists.map((l: TaskList) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-ink-200 divide-y divide-ink-100 max-h-52 overflow-y-auto">
        {(parsed ?? []).map((t, i) => (
          <label
            key={i}
            className={cn(
              "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
              t.selected ? "bg-surface" : "bg-ink-50"
            )}
          >
            <input type="checkbox" checked={t.selected} onChange={() => toggleTask(i)} className="rounded" />
            <span
              className={cn("text-sm flex-1 truncate", t.selected ? "text-ink-800" : "text-ink-400 line-through")}
              dir="auto"
            >
              {t.title}
            </span>
          </label>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleImport}
          disabled={state === "importing" || selectedCount === 0}
          className="btn btn-primary flex items-center gap-2"
        >
          {state === "importing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          הוסף {selectedCount} משימות
        </button>
        <button type="button" onClick={() => { setState("idle"); setParsed(null); setPreviewUrl(null); }} className="btn btn-secondary text-sm">
          חזרה
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Google Tasks stub

function GoogleTasksStubTab() {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-ink-100 flex items-center justify-center">
        <ExternalLink className="w-7 h-7 text-ink-400" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-ink-700">ייבוא מ-Google Tasks</p>
        <p className="text-sm text-ink-500 max-w-xs">
          פיצ'ר זה בפיתוח. בקרוב תוכל לחבר את חשבון Google ולייבא משימות ישירות.
        </p>
      </div>
      <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-xs text-ink-500 text-start max-w-xs w-full space-y-1">
        <p className="font-medium text-ink-600">מה יהיה אפשרי:</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>חיבור OAuth לחשבון Google</li>
          <li>בחירת רשימות לייבוא</li>
          <li>סנכרון דו-כיווני (בעתיד)</li>
        </ul>
      </div>
    </div>
  );
}
