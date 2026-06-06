import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Save,
  Trash2,
  Upload,
  Download,
  Loader2,
  FolderKanban,
  ListChecks,
  Share2,
  CheckSquare,
  FileText,
  FileSpreadsheet,
  FileAudio,
  Image as ImageIcon,
  File as FileIcon,
  Plus,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useThoughtDevelopment,
  useUpdateThoughtDevelopment,
  useDeleteThoughtDevelopment,
  useThoughtDevelopmentFiles,
  useAddThoughtDevelopmentFile,
  useDeleteThoughtDevelopmentFile,
  useThoughtDevelopmentShares,
  useSetThoughtDevelopmentShare,
  useRemoveThoughtDevelopmentShare,
  useProjects,
  useTaskLists,
  useOrgMembers,
  useCreateTask,
  useOrgScope,
} from "@/lib/hooks";
import type { TaskInsert } from "@/lib/types/domain";
import { useFileUpload } from "@/lib/hooks/useFileUpload";
import { getThoughtDevelopmentFileUrl } from "@/lib/services/thought-developments";
import type {
  ThoughtDevelopmentFile,
  ThoughtDevelopmentFileRole,
} from "@/lib/types/thought-developments";

interface Props {
  developmentId: string | null;
  /** True when the row was just created as a blank draft — auto-deleted on
   *  close if the user added nothing. */
  isDraft?: boolean;
  onClose: () => void;
}

// ── datetime-local helpers ───────────────────────────────────────────────────
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function fileIconFor(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("audio/")) return FileAudio;
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv"))
    return FileSpreadsheet;
  if (mime.includes("pdf") || mime.includes("word") || mime.includes("text"))
    return FileText;
  return FileIcon;
}
function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function formatWhen(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ThoughtDevelopmentEditModal({
  developmentId,
  isDraft,
  onClose,
}: Props) {
  const open = !!developmentId;
  const { data: dev } = useThoughtDevelopment(developmentId);
  const { data: files = [] } = useThoughtDevelopmentFiles(developmentId);
  const { data: projects = [] } = useProjects();
  const { data: taskLists = [] } = useTaskLists();

  const update = useUpdateThoughtDevelopment();
  const remove = useDeleteThoughtDevelopment();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [summary, setSummary] = useState("");
  const [writtenAt, setWrittenAt] = useState("");
  // Link selection: "none" | "project" | "list"
  const [linkKind, setLinkKind] = useState<"none" | "project" | "list">("none");
  const [projectId, setProjectId] = useState<string>("");
  const [listId, setListId] = useState<string>("");

  const loadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!dev) return;
    if (loadedRef.current === dev.id) return;
    loadedRef.current = dev.id;
    setName(dev.name);
    setDescription(dev.description);
    setSummary(dev.summary_text);
    setWrittenAt(toLocalInput(dev.written_at));
    if (dev.project_id) {
      setLinkKind("project");
      setProjectId(dev.project_id);
      setListId("");
    } else if (dev.task_list_id) {
      setLinkKind("list");
      setListId(dev.task_list_id);
      setProjectId("");
    } else {
      setLinkKind("none");
      setProjectId("");
      setListId("");
    }
  }, [dev]);

  // Reset the load guard when the modal closes so re-opening reloads fields.
  useEffect(() => {
    if (!open) loadedRef.current = null;
  }, [open]);

  const sourceFiles = files.filter((f) => f.role === "source");
  const summaryFiles = files.filter((f) => f.role === "summary");

  const isEmptyDraft =
    !name.trim() &&
    !description.trim() &&
    !summary.trim() &&
    files.length === 0 &&
    linkKind === "none";

  const persist = async () => {
    if (!developmentId) return;
    await update.mutateAsync({
      id: developmentId,
      patch: {
        name: name.trim(),
        description: description.trim(),
        summary_text: summary,
        written_at: fromLocalInput(writtenAt) ?? dev?.written_at,
        project_id: linkKind === "project" ? projectId || null : null,
        task_list_id: linkKind === "list" ? listId || null : null,
      },
    });
  };

  const handleClose = async () => {
    if (developmentId) {
      // A blank draft the user never touched → discard it instead of leaving
      // an empty card behind.
      if (isDraft && isEmptyDraft) {
        await remove.mutateAsync(developmentId);
        onClose();
        return;
      }
      await persist();
    }
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-lift w-full max-w-4xl my-8 overflow-hidden"
            dir="rtl"
          >
            {/* Header */}
            <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="שם המחשבה"
                className="text-lg font-semibold text-ink-900 bg-transparent border-0 outline-none flex-1 min-w-0"
              />
              <div className="flex items-center gap-1">
                <button
                  onClick={async () => {
                    await persist();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-ink-900 text-white text-sm font-medium flex items-center gap-1.5 hover:bg-ink-700 disabled:opacity-50"
                  disabled={update.isPending}
                  type="button"
                >
                  {update.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  שמירה
                </button>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg hover:bg-ink-100"
                  type="button"
                >
                  <X className="w-4 h-4 text-ink-600" />
                </button>
              </div>
            </div>

            <div className="p-5 max-h-[calc(100vh-12rem)] overflow-y-auto space-y-5">
              {/* Description + dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <div className="eyebrow mb-1">תיאור קצר</div>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="field"
                    placeholder="במשפט אחד — על מה המחשבה"
                  />
                </label>
                <label className="block">
                  <div className="eyebrow mb-1">תאריך ושעת כתיבה</div>
                  <input
                    type="datetime-local"
                    value={writtenAt}
                    onChange={(e) => setWrittenAt(e.target.value)}
                    className="field"
                  />
                </label>
              </div>

              {/* Link to project OR list */}
              <LinkPicker
                linkKind={linkKind}
                setLinkKind={setLinkKind}
                projectId={projectId}
                setProjectId={setProjectId}
                listId={listId}
                setListId={setListId}
                projects={projects.map((p) => ({ id: p.id, name: p.name }))}
                lists={taskLists.map((l) => ({ id: l.id, name: l.name }))}
              />

              {/* Two columns: source files | summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <FileSection
                  title="קבצי מקור"
                  hint="התמונה / PDF / Excel / אודיו וכו' שעליהם פיתחת את המחשבה"
                  role="source"
                  developmentId={developmentId!}
                  files={sourceFiles}
                />
                <div className="space-y-3">
                  <label className="block">
                    <div className="eyebrow mb-1">סיכום המחשבה</div>
                    <textarea
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      className="field min-h-[140px] resize-y text-sm"
                      placeholder="הסיכום המעובד של המחשבה"
                    />
                  </label>
                  <FileSection
                    title="קבצי סיכום"
                    hint="הקובץ/ים המסכמים את המחשבה"
                    role="summary"
                    developmentId={developmentId!}
                    files={summaryFiles}
                  />
                </div>
              </div>

              {/* Sharing + task export */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ShareSection developmentId={developmentId!} />
                <TaskExportSection
                  developmentId={developmentId!}
                  name={name}
                  linkedProjectId={linkKind === "project" ? projectId : null}
                  linkedListId={linkKind === "list" ? listId : null}
                  taskLists={taskLists.map((l) => ({
                    id: l.id,
                    name: l.name,
                    project_id: (l as { project_id?: string | null })
                      .project_id ?? null,
                  }))}
                  onPersist={persist}
                />
              </div>

              {/* Danger */}
              <div className="pt-2 border-t border-ink-100">
                <button
                  onClick={async () => {
                    if (!developmentId) return;
                    if (!confirm("למחוק את פיתוח המחשבה לצמיתות?")) return;
                    await remove.mutateAsync(developmentId);
                    onClose();
                  }}
                  className="text-danger-600 text-sm flex items-center gap-1.5 hover:underline"
                  type="button"
                >
                  <Trash2 className="w-4 h-4" />
                  מחיקת פיתוח המחשבה
                </button>
              </div>

              {/* Metadata footer */}
              {dev && (
                <p className="text-[11px] text-ink-400">
                  נוצר: {formatWhen(dev.created_at)} · עודכן לאחרונה:{" "}
                  {formatWhen(dev.updated_at)}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Link picker (project OR list, exactly one) ───────────────────────────────
function LinkPicker({
  linkKind,
  setLinkKind,
  projectId,
  setProjectId,
  listId,
  setListId,
  projects,
  lists,
}: {
  linkKind: "none" | "project" | "list";
  setLinkKind: (k: "none" | "project" | "list") => void;
  projectId: string;
  setProjectId: (v: string) => void;
  listId: string;
  setListId: (v: string) => void;
  projects: { id: string; name: string }[];
  lists: { id: string; name: string }[];
}) {
  return (
    <div>
      <div className="eyebrow mb-1">שיוך (פרויקט או רשימה — אחד בלבד)</div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-ink-200 overflow-hidden">
          {(["none", "project", "list"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setLinkKind(k)}
              className={cn(
                "px-3 py-1.5 text-sm flex items-center gap-1.5",
                linkKind === k
                  ? "bg-ink-900 text-white"
                  : "bg-white text-ink-700 hover:bg-ink-50"
              )}
            >
              {k === "project" && <FolderKanban className="w-3.5 h-3.5" />}
              {k === "list" && <ListChecks className="w-3.5 h-3.5" />}
              {k === "none" ? "ללא" : k === "project" ? "פרויקט" : "רשימה"}
            </button>
          ))}
        </div>
        {linkKind === "project" && (
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="field max-w-xs"
          >
            <option value="">בחר/י פרויקט…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        {linkKind === "list" && (
          <select
            value={listId}
            onChange={(e) => setListId(e.target.value)}
            className="field max-w-xs"
          >
            <option value="">בחר/י רשימה…</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

// ── File section (upload + list) ─────────────────────────────────────────────
function FileSection({
  title,
  hint,
  role,
  developmentId,
  files,
}: {
  title: string;
  hint: string;
  role: ThoughtDevelopmentFileRole;
  developmentId: string;
  files: ThoughtDevelopmentFile[];
}) {
  const { upload, state } = useFileUpload();
  const addFile = useAddThoughtDevelopmentFile();
  const deleteFile = useDeleteThoughtDevelopmentFile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(list)) {
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const keySuffix = `thought-dev/${developmentId}/${role}/${Date.now()}-${safe}`;
        const { key } = await upload(file, {
          keySuffix,
          contentType: file.type || "application/octet-stream",
        });
        await addFile.mutateAsync({
          thought_development_id: developmentId,
          role,
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          storage_key: key,
        });
      }
    } catch (err) {
      console.error("thought-dev file upload failed:", err);
      alert("העלאת הקובץ נכשלה. נסה/י שוב.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const uploading = busy || state.status === "single-upload" || state.status === "multipart-uploading";

  return (
    <div className="space-y-2">
      <div>
        <div className="eyebrow">{title}</div>
        <p className="text-[11px] text-ink-400">{hint}</p>
      </div>
      <div className="space-y-1.5">
        {files.map((f) => (
          <FileRow
            key={f.id}
            file={f}
            onDelete={() =>
              deleteFile.mutate({ fileId: f.id, developmentId })
            }
          />
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full border border-dashed border-ink-300 rounded-xl py-3 text-sm text-ink-600 flex items-center justify-center gap-2 hover:bg-ink-50 disabled:opacity-50"
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            מעלה… {state.progress > 0 ? `${state.progress}%` : ""}
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            העלאת קובץ
          </>
        )}
      </button>
    </div>
  );
}

function FileRow({
  file,
  onDelete,
}: {
  file: ThoughtDevelopmentFile;
  onDelete: () => void;
}) {
  const Icon = fileIconFor(file.mime_type);
  const [downloading, setDownloading] = useState(false);
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = await getThoughtDevelopmentFileUrl(file.storage_key);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      console.error("download failed:", err);
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm">
      <Icon className="w-4 h-4 text-ink-500 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-ink-800">{file.file_name || "קובץ"}</div>
        <div className="text-[10px] text-ink-400">
          {formatBytes(file.size_bytes)} · הועלה {formatWhen(file.uploaded_at)}
          {file.edited_at ? ` · נערך ${formatWhen(file.edited_at)}` : ""}
        </div>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        className="p-1 rounded hover:bg-ink-100"
        title="הורדה"
      >
        {downloading ? (
          <Loader2 className="w-4 h-4 animate-spin text-ink-500" />
        ) : (
          <Download className="w-4 h-4 text-ink-500" />
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="p-1 rounded hover:bg-danger-50"
        title="מחיקה"
      >
        <Trash2 className="w-4 h-4 text-danger-500" />
      </button>
    </div>
  );
}

// ── Share section ────────────────────────────────────────────────────────────
function ShareSection({ developmentId }: { developmentId: string }) {
  const scope = useOrgScope();
  const { data: members = [] } = useOrgMembers();
  const { data: shares = [] } = useThoughtDevelopmentShares(developmentId);
  const setShare = useSetThoughtDevelopmentShare();
  const removeShare = useRemoveThoughtDevelopmentShare();

  const sharedByUser = useMemo(
    () => new Map(shares.map((s) => [s.user_id, s.permission])),
    [shares]
  );

  const others = members.filter((m) => m.profile?.id && m.profile.id !== scope.userId);

  return (
    <div className="space-y-2">
      <div className="eyebrow flex items-center gap-1.5">
        <Share2 className="w-3.5 h-3.5" />
        שיתוף
      </div>
      {others.length === 0 ? (
        <p className="text-[11px] text-ink-400">אין חברי ארגון נוספים לשיתוף.</p>
      ) : (
        <div className="space-y-1.5">
          {others.map((m) => {
            const uid = m.profile!.id;
            const perm = sharedByUser.get(uid);
            return (
              <div
                key={uid}
                className="flex items-center justify-between gap-2 rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm"
              >
                <span className="truncate text-ink-800">
                  {m.profile?.full_name || "משתמש"}
                </span>
                <div className="inline-flex rounded-lg border border-ink-200 overflow-hidden text-xs">
                  {(["none", "read", "write"] as const).map((p) => {
                    const active =
                      (p === "none" && !perm) || perm === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          if (p === "none") {
                            if (perm) removeShare.mutate({ id: developmentId, userId: uid });
                          } else {
                            setShare.mutate({
                              id: developmentId,
                              userId: uid,
                              permission: p,
                            });
                          }
                        }}
                        className={cn(
                          "px-2 py-1",
                          active
                            ? "bg-ink-900 text-white"
                            : "bg-white text-ink-600 hover:bg-ink-50"
                        )}
                      >
                        {p === "none" ? "ללא" : p === "read" ? "צפייה" : "עריכה"}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Task export ──────────────────────────────────────────────────────────────
function TaskExportSection({
  developmentId,
  name,
  linkedProjectId,
  linkedListId,
  taskLists,
  onPersist,
}: {
  developmentId: string;
  name: string;
  linkedProjectId: string | null;
  linkedListId: string | null;
  taskLists: { id: string; name: string; project_id: string | null }[];
  onPersist: () => Promise<void>;
}) {
  const createTask = useCreateTask();
  const [done, setDone] = useState(false);

  // Default target list: the linked list, else the linked project's list, else none.
  const defaultListId = useMemo(() => {
    if (linkedListId) return linkedListId;
    if (linkedProjectId) {
      const projectList = taskLists.find((l) => l.project_id === linkedProjectId);
      if (projectList) return projectList.id;
    }
    return "";
  }, [linkedListId, linkedProjectId, taskLists]);

  const [targetListId, setTargetListId] = useState<string>("");
  useEffect(() => {
    setTargetListId(defaultListId);
  }, [defaultListId]);

  const handleCreate = async () => {
    // Persist the latest name so the task title matches what the user sees.
    await onPersist();
    const title = `לסכם את פיתוח מחשבה "${name.trim() || "ללא שם"}"`;
    // `source_thought_development_id` is a fresh column the generated types
    // don't know about yet (Supabase type lag) — cast through `any`.
    const payload = {
      title,
      task_list_id: targetListId || null,
      source_thought_development_id: developmentId,
    } as unknown as Omit<TaskInsert, "organization_id" | "owner_id">;
    await createTask.mutateAsync(payload);
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  };

  return (
    <div className="space-y-2">
      <div className="eyebrow flex items-center gap-1.5">
        <CheckSquare className="w-3.5 h-3.5" />
        משימת סיכום
      </div>
      <p className="text-[11px] text-ink-400">
        יצירת משימה גנרית לסיכום פיתוח המחשבה הזה.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={targetListId}
          onChange={(e) => setTargetListId(e.target.value)}
          className="field max-w-[12rem]"
        >
          <option value="">ללא רשימה</option>
          {taskLists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleCreate}
          disabled={createTask.isPending}
          className="px-3 py-1.5 rounded-lg border border-ink-300 text-sm flex items-center gap-1.5 hover:bg-ink-50 disabled:opacity-50"
        >
          {createTask.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : done ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {done ? "נוצרה משימה" : "צור משימה"}
        </button>
      </div>
    </div>
  );
}
