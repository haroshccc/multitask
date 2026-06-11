import { useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  ListChecks,
  Plus,
  Sparkles,
  Tag,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useUpdateRecording, useRecordingSpeakers, useUpsertRecordingSpeakerLabel, useSpeakerLabelSuggestions } from "@/lib/hooks/useRecordings";
import { useProjects, useCreateProject } from "@/lib/hooks/useProjects";
import {
  useRecordingLists,
  useRecordingListAssignments,
  useAssignRecordingToList,
  useCreateRecordingList,
} from "@/lib/hooks/useRecordingLists";
import { mapSuggestedName } from "@/lib/utils/filing-suggestions";
import type { RecordingAiOutput } from "@/lib/services/recordings";
import type { Recording, RecordingSource } from "@/lib/types/domain";

interface Props {
  recording: Recording;
  onClose: () => void;
}

type Sel =
  | { kind: "none" }
  | { kind: "existing"; id: string }
  | { kind: "new"; name: string };

const STEPS = ["title", "speakers", "filing", "tags", "review"] as const;
type StepId = (typeof STEPS)[number];

const STEP_TITLES: Record<StepId, string> = {
  title: "איך לקרוא לזה?",
  speakers: "בין מי למי השיחה?",
  filing: "לאן לשייך?",
  tags: "תגיות וסוג",
  review: "הכל מוכן ✓",
};

const SOURCE_OPTIONS: Array<{ value: RecordingSource; label: string }> = [
  { value: "call", label: "שיחה" },
  { value: "meeting", label: "פגישה" },
  { value: "thought", label: "מחשבה" },
  { value: "whatsapp", label: "וואטסאפ" },
  { value: "recording", label: "הקלטה" },
  { value: "upload", label: "העלאה" },
  { value: "other", label: "אחר" },
];

export function FilingWizard({ recording, onClose }: Props) {
  const ai = (recording.ai_output as RecordingAiOutput | null) ?? null;

  const { data: projects = [] } = useProjects();
  const { data: lists = [] } = useRecordingLists();
  const { data: assignments = [] } = useRecordingListAssignments(recording.id);
  const { data: speakers = [] } = useRecordingSpeakers(recording.id);
  const { data: labelSuggestions = [] } = useSpeakerLabelSuggestions(recording.project_id);

  const update = useUpdateRecording();
  const createProject = useCreateProject();
  const createList = useCreateRecordingList();
  const assignToList = useAssignRecordingToList();
  const upsertSpeaker = useUpsertRecordingSpeakerLabel();

  // --- Initial values from AI suggestions (falling back to current row) ------
  const [title, setTitle] = useState(
    () => ai?.suggested_title?.trim() || recording.title || "",
  );

  const [speakerLabels, setSpeakerLabels] = useState<Record<number, string>>(() => {
    const m: Record<number, string> = {};
    for (const s of speakers) if (s.label?.trim()) m[s.speaker_index] = s.label.trim();
    return m;
  });
  // Re-seed labels once speakers load (state init ran before the query resolved).
  const seeded = useRef(false);
  if (!seeded.current && speakers.length > 0) {
    seeded.current = true;
    const m: Record<number, string> = {};
    for (const s of speakers) if (s.label?.trim()) m[s.speaker_index] = s.label.trim();
    if (Object.keys(m).length) setSpeakerLabels((prev) => ({ ...m, ...prev }));
  }

  const projectSel0 = useMemo<Sel>(() => {
    if (recording.project_id) return { kind: "existing", id: recording.project_id };
    const m = mapSuggestedName(ai?.suggested_filing?.project, projects);
    if (m.matchId) return { kind: "existing", id: m.matchId };
    if (m.proposeNew) return { kind: "new", name: m.proposeNew };
    return { kind: "none" };
  }, [recording.project_id, ai, projects]);

  const listSel0 = useMemo<Sel>(() => {
    if (assignments[0]) return { kind: "existing", id: assignments[0].list_id };
    const m = mapSuggestedName(ai?.suggested_filing?.recording_list, lists);
    if (m.matchId) return { kind: "existing", id: m.matchId };
    if (m.proposeNew) return { kind: "new", name: m.proposeNew };
    return { kind: "none" };
  }, [assignments, ai, lists]);

  const [projectSel, setProjectSel] = useState<Sel | null>(null);
  const [listSel, setListSel] = useState<Sel | null>(null);
  const project = projectSel ?? projectSel0;
  const list = listSel ?? listSel0;

  const [tags, setTags] = useState<string[]>(
    () => ai?.suggested_tags?.filter(Boolean) ?? recording.tags ?? [],
  );
  const [tagDraft, setTagDraft] = useState("");
  const [source, setSource] = useState<RecordingSource>(
    () => (ai?.suggested_source as RecordingSource) || recording.source,
  );
  const [sourceCustom, setSourceCustom] = useState(
    () => ai?.suggested_source_custom?.trim() || recording.source_custom || "",
  );

  // --- Step navigation -------------------------------------------------------
  const [step, setStep] = useState(0);
  const dir = useRef<"next" | "prev">("next");
  const [saving, setSaving] = useState(false);

  const go = (next: number) => {
    if (next < 0 || next >= STEPS.length) return;
    dir.current = next > step ? "next" : "prev";
    setStep(next);
  };
  const stepId = STEPS[step];

  // Swipe (RTL: swipe left → next).
  const swipeX = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    swipeX.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (swipeX.current == null) return;
    const dx = e.clientX - swipeX.current;
    swipeX.current = null;
    if (Math.abs(dx) < 60) return;
    if (dx < 0) go(step + 1);
    else go(step - 1);
  };

  const finish = async () => {
    setSaving(true);
    try {
      // 1) recording fields
      await update.mutateAsync({
        recordingId: recording.id,
        patch: {
          title: title.trim() || null,
          source,
          source_custom: source === "other" ? sourceCustom.trim() || null : null,
          tags,
        },
      });
      // 2) project link (create if new)
      if (project.kind === "new" && project.name.trim()) {
        const created = await createProject.mutateAsync({ name: project.name.trim() });
        if (created?.id)
          await update.mutateAsync({
            recordingId: recording.id,
            patch: { project_id: created.id },
          });
      } else if (project.kind === "existing") {
        await update.mutateAsync({
          recordingId: recording.id,
          patch: { project_id: project.id },
        });
      }
      // 3) recording list (create if new, then assign)
      if (list.kind === "new" && list.name.trim()) {
        const created = await createList.mutateAsync({ name: list.name.trim() });
        if (created?.id)
          await assignToList.mutateAsync({ recordingId: recording.id, listId: created.id });
      } else if (list.kind === "existing") {
        if (!assignments.some((a) => a.list_id === list.id))
          await assignToList.mutateAsync({ recordingId: recording.id, listId: list.id });
      }
      // 4) speaker labels (only changed ones)
      for (const s of speakers) {
        const next = speakerLabels[s.speaker_index]?.trim() ?? "";
        if (next && next !== (s.label?.trim() ?? "")) {
          await upsertSpeaker.mutateAsync({
            recordingId: recording.id,
            speakerIndex: s.speaker_index,
            label: next,
          });
        }
      }
      onClose();
    } catch (err) {
      console.error("filing wizard save failed:", err);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div
        className={cn(
          "relative w-full sm:max-w-md bg-white shadow-lift",
          "rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col",
        )}
      >
        {/* Header: progress dots + close */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-5 bg-primary-500" : "w-1.5 bg-ink-200",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-ink-400 hover:bg-ink-100"
            title="מאוחר יותר"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div
          className="px-5 pb-2 pt-1 overflow-y-auto"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <div className="text-[11px] text-ink-400 mb-1">
            שלב {step + 1} מתוך {STEPS.length}
          </div>
          <h3 className="text-base font-bold text-ink-900 mb-3">
            {STEP_TITLES[stepId]}
          </h3>

          <div
            key={step}
            style={{
              animation: `${dir.current === "next" ? "mtSlideLeft" : "mtSlideRight"} .18s ease`,
            }}
          >
            {stepId === "title" && (
              <TitleStep
                value={title}
                onChange={setTitle}
                suggestion={ai?.suggested_title}
                onConfirm={() => go(step + 1)}
              />
            )}
            {stepId === "speakers" && (
              <SpeakersStep
                speakers={speakers}
                labels={speakerLabels}
                onChange={(idx, v) =>
                  setSpeakerLabels((p) => ({ ...p, [idx]: v }))
                }
                suggestions={labelSuggestions}
              />
            )}
            {stepId === "filing" && (
              <FilingStep
                projects={projects}
                lists={lists}
                project={project}
                list={list}
                onProject={(s) => {
                  setProjectSel(s);
                }}
                onList={(s) => {
                  setListSel(s);
                  go(step + 1);
                }}
              />
            )}
            {stepId === "tags" && (
              <TagsStep
                tags={tags}
                onToggleTag={(t) =>
                  setTags((p) =>
                    p.includes(t) ? p.filter((x) => x !== t) : [...p, t],
                  )
                }
                suggested={ai?.suggested_tags ?? []}
                draft={tagDraft}
                onDraft={setTagDraft}
                onAddDraft={() => {
                  const t = tagDraft.trim();
                  if (t && !tags.includes(t)) setTags((p) => [...p, t]);
                  setTagDraft("");
                }}
                source={source}
                onSource={setSource}
                sourceCustom={sourceCustom}
                onSourceCustom={setSourceCustom}
              />
            )}
            {stepId === "review" && (
              <ReviewStep
                title={title}
                project={describeSel(project, projects)}
                list={describeSel(list, lists)}
                tags={tags}
                sourceLabel={
                  SOURCE_OPTIONS.find((o) => o.value === source)?.label ?? source
                }
              />
            )}
          </div>
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-ink-100">
          <button
            type="button"
            onClick={() => (step === 0 ? onClose() : go(step - 1))}
            className="btn-ghost !text-sm inline-flex items-center gap-1"
          >
            {step === 0 ? (
              "מאוחר יותר"
            ) : (
              <>
                <ChevronRight className="w-4 h-4" />
                חזרה
              </>
            )}
          </button>
          {stepId === "review" ? (
            <button
              type="button"
              onClick={finish}
              disabled={saving}
              className="btn-primary !text-sm inline-flex items-center gap-1 disabled:opacity-60"
            >
              <Check className="w-4 h-4" />
              {saving ? "שומרת…" : "שמור תיוק"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => go(step + 1)}
              className="btn-primary !text-sm inline-flex items-center gap-1"
            >
              אשר והמשך
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Steps -------------------------------------------------------------------

function SuggestionBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary-600">
      <Sparkles className="w-3 h-3" />
      הצעת AI
    </span>
  );
}

function TitleStep({
  value,
  onChange,
  suggestion,
  onConfirm,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestion?: string;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-2">
      {suggestion?.trim() && <SuggestionBadge />}
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onConfirm();
          }
        }}
        placeholder="כותרת להקלטה"
        className="field w-full !text-base !py-2.5"
        dir="auto"
      />
    </div>
  );
}

function SpeakersStep({
  speakers,
  labels,
  onChange,
  suggestions,
}: {
  speakers: Array<{ speaker_index: number; label: string | null }>;
  labels: Record<number, string>;
  onChange: (idx: number, v: string) => void;
  suggestions: string[];
}) {
  if (speakers.length === 0) {
    return (
      <p className="text-sm text-ink-500 py-2 inline-flex items-center gap-2">
        <Users className="w-4 h-4 text-ink-400" />
        לא זוהו דוברים נפרדים בהקלטה זו.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {speakers.map((s) => (
        <div key={s.speaker_index} className="space-y-1">
          <label className="text-xs text-ink-500">דובר {s.speaker_index + 1}</label>
          <input
            value={labels[s.speaker_index] ?? ""}
            onChange={(e) => onChange(s.speaker_index, e.target.value)}
            placeholder={`שם דובר ${s.speaker_index + 1}`}
            className="field w-full"
            dir="auto"
          />
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {suggestions.slice(0, 6).map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => onChange(s.speaker_index, sug)}
                  className="rounded-md bg-ink-100 hover:bg-primary-50 hover:text-primary-700 text-ink-600 px-2 py-0.5 text-[11px]"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SelectChip({
  active,
  suggested,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  suggested?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
        active
          ? "border-primary-500 bg-primary-50 text-primary-800 font-medium"
          : suggested
            ? "border-primary-300 bg-white text-ink-700"
            : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
      )}
    >
      {icon}
      <span className="truncate max-w-[10rem]">{children}</span>
      {active && <Check className="w-3 h-3" />}
    </button>
  );
}

function FilingStep({
  projects,
  lists,
  project,
  list,
  onProject,
  onList,
}: {
  projects: Array<{ id: string; name: string }>;
  lists: Array<{ id: string; name: string }>;
  project: Sel;
  list: Sel;
  onProject: (s: Sel) => void;
  onList: (s: Sel) => void;
}) {
  return (
    <div className="space-y-4">
      <Group label="פרויקט" icon={<FolderOpen className="w-3.5 h-3.5" />}>
        <SelectChip active={project.kind === "none"} onClick={() => onProject({ kind: "none" })}>
          ללא
        </SelectChip>
        {project.kind === "new" && (
          <SelectChip active suggested onClick={() => {}} icon={<Plus className="w-3 h-3" />}>
            {project.name} (חדש)
          </SelectChip>
        )}
        {projects.map((p) => (
          <SelectChip
            key={p.id}
            active={project.kind === "existing" && project.id === p.id}
            onClick={() => onProject({ kind: "existing", id: p.id })}
          >
            {p.name}
          </SelectChip>
        ))}
      </Group>

      <Group label="רשימת הקלטות" icon={<ListChecks className="w-3.5 h-3.5" />}>
        <SelectChip active={list.kind === "none"} onClick={() => onList({ kind: "none" })}>
          ללא
        </SelectChip>
        {list.kind === "new" && (
          <SelectChip active suggested onClick={() => {}} icon={<Plus className="w-3 h-3" />}>
            {list.name} (חדש)
          </SelectChip>
        )}
        {lists.map((l) => (
          <SelectChip
            key={l.id}
            active={list.kind === "existing" && list.id === l.id}
            onClick={() => onList({ kind: "existing", id: l.id })}
          >
            {l.name}
          </SelectChip>
        ))}
      </Group>
      <p className="text-[11px] text-ink-400">בחירת רשימה תעבור אוטומטית לשלב הבא.</p>
    </div>
  );
}

function Group({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 text-xs font-semibold text-ink-500">
        {icon}
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function TagsStep({
  tags,
  onToggleTag,
  suggested,
  draft,
  onDraft,
  onAddDraft,
  source,
  onSource,
  sourceCustom,
  onSourceCustom,
}: {
  tags: string[];
  onToggleTag: (t: string) => void;
  suggested: string[];
  draft: string;
  onDraft: (v: string) => void;
  onAddDraft: () => void;
  source: RecordingSource;
  onSource: (s: RecordingSource) => void;
  sourceCustom: string;
  onSourceCustom: (v: string) => void;
}) {
  const allTags = Array.from(new Set([...suggested, ...tags]));
  return (
    <div className="space-y-4">
      <Group label="תגיות" icon={<Tag className="w-3.5 h-3.5" />}>
        {allTags.map((t) => (
          <SelectChip
            key={t}
            active={tags.includes(t)}
            suggested={suggested.includes(t)}
            onClick={() => onToggleTag(t)}
          >
            {t}
          </SelectChip>
        ))}
      </Group>
      <div className="flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAddDraft();
            }
          }}
          placeholder="הוסף תגית…"
          className="field flex-1 !py-1.5 !text-xs"
          dir="auto"
        />
        <button
          type="button"
          onClick={onAddDraft}
          disabled={!draft.trim()}
          className="btn-ghost !py-1.5 !px-2 disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-ink-500">סוג</div>
        <div className="flex flex-wrap gap-1.5">
          {SOURCE_OPTIONS.map((o) => (
            <SelectChip
              key={o.value}
              active={source === o.value}
              onClick={() => onSource(o.value)}
            >
              {o.label}
            </SelectChip>
          ))}
        </div>
        {source === "other" && (
          <input
            value={sourceCustom}
            onChange={(e) => onSourceCustom(e.target.value)}
            placeholder="פרט…"
            className="field w-full !py-1.5 !text-xs mt-1"
            dir="auto"
          />
        )}
      </div>
    </div>
  );
}

function ReviewStep({
  title,
  project,
  list,
  tags,
  sourceLabel,
}: {
  title: string;
  project: string;
  list: string;
  tags: string[];
  sourceLabel: string;
}) {
  return (
    <dl className="space-y-2 text-sm">
      <Row label="כותרת" value={title.trim() || "—"} />
      <Row label="פרויקט" value={project} />
      <Row label="רשימה" value={list} />
      <Row label="סוג" value={sourceLabel} />
      <Row label="תגיות" value={tags.length ? tags.join(" · ") : "—"} />
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="w-16 shrink-0 text-xs text-ink-400 pt-0.5">{label}</dt>
      <dd className="flex-1 text-ink-800" dir="auto">
        {value}
      </dd>
    </div>
  );
}

function describeSel(sel: Sel, options: Array<{ id: string; name: string }>): string {
  if (sel.kind === "none") return "ללא";
  if (sel.kind === "new") return `${sel.name} (חדש)`;
  return options.find((o) => o.id === sel.id)?.name ?? "—";
}
