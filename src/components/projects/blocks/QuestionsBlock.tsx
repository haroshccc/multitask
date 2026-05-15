import { useMemo, useState } from "react";
import {
  HelpCircle,
  Plus,
  Loader2,
  Check,
  RotateCcw,
  Trash2,
  Link2,
  Sparkles,
} from "lucide-react";
import {
  useProjectQuestions,
  useCreateQuestion,
  useAnswerQuestion,
  useReopenQuestion,
  useDeleteQuestion,
  useUpdateQuestion,
  useTasksByProject,
  useRecordings,
  useExtractQuestions,
} from "@/lib/hooks";
import type { Question, Task, Recording } from "@/lib/types/domain";
import { pushUndo } from "@/lib/undo/store";

/**
 * Questions panel — the spec MD's "qNotepads" surface, simplified to one flat
 * list per project (the existing `questions` table doesn't have notepads).
 * Users add open questions, attach answers, optionally link them to a task,
 * and re-open answered ones.
 */
export function QuestionsBlock({ scopeId }: { scopeId?: string | null }) {
  const projectId = scopeId ?? null;
  const { data: questions = [], isLoading } = useProjectQuestions(projectId);
  const { data: tasks = [] } = useTasksByProject(projectId);
  const create = useCreateQuestion();
  const answer = useAnswerQuestion();
  const reopen = useReopenQuestion();
  const remove = useDeleteQuestion();
  const update = useUpdateQuestion();
  const extract = useExtractQuestions();
  const { data: allRecordings = [] } = useRecordings();

  // Recordings tagged to this project that have a transcript ready.
  const projectRecordings = useMemo(
    () =>
      allRecordings.filter(
        (r) =>
          r.project_id === projectId &&
          (r.transcript_text ?? "").trim().length > 0
      ),
    [allRecordings, projectId]
  );

  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const { open, answered } = useMemo(() => {
    const o: Question[] = [];
    const a: Question[] = [];
    for (const q of questions) {
      if (q.answered_at) a.push(q);
      else o.push(q);
    }
    return { open: o, answered: a };
  }, [questions]);

  const handleAdd = () => {
    if (!projectId || !draft.trim()) return;
    const payload = { project_id: projectId, text: draft.trim() };
    create.mutate(payload, {
      onSuccess: (q) => {
        setDraft("");
        let currentId = q.id;
        const pid = projectId;
        pushUndo({
          description: "הוספת שאלה",
          undo: () =>
            remove.mutate({ questionId: currentId, projectId: pid }),
          redo: () => {
            create.mutate(payload, {
              onSuccess: (again) => {
                currentId = again.id;
              },
            });
          },
        });
      },
    });
  };

  const handleExtract = (recording: Recording) => {
    if (!projectId) return;
    extract.mutate(
      {
        recordingId: recording.id,
        projectId,
        replace: false,
      },
      {
        onSuccess: (res) => {
          setPickerOpen(false);
          if (res.count === 0) {
            alert("לא נמצאו שאלות פתוחות בתמלול.");
          }
        },
        onError: (err) => {
          alert(`חילוץ שאלות נכשל: ${err instanceof Error ? err.message : err}`);
        },
      }
    );
  };

  if (!projectId) {
    return (
      <div className="text-xs text-ink-500 text-center py-6">בחרי פרויקט.</div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2.5">
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="שאלה חדשה ללקוח / לעצמך…"
          className="field py-1.5 text-xs flex-1 min-w-[120px]"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={create.isPending || !draft.trim()}
          className="btn-accent text-xs flex items-center gap-1 shrink-0 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          הוסיפי
        </button>
      </div>

      {projectRecordings.length > 0 && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            disabled={extract.isPending}
            className="btn-outline text-[11px] w-full flex items-center justify-center gap-1 disabled:opacity-50"
          >
            {extract.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {extract.isPending
              ? "מחלץ שאלות מהקלטה…"
              : `חלצי שאלות מהקלטה (${projectRecordings.length})`}
          </button>
          {pickerOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setPickerOpen(false)}
              />
              <div className="absolute end-0 top-full mt-1 z-40 bg-white border border-ink-200 rounded-md shadow-lift w-full max-h-64 overflow-y-auto py-1">
                {projectRecordings.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleExtract(r)}
                    className="w-full text-start text-[11px] hover:bg-ink-50 px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{r.title || "(ללא שם)"}</span>
                    <span className="text-[9px] text-ink-400 shrink-0">
                      {new Date(r.created_at).toLocaleDateString("he-IL")}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 space-y-2">
        {isLoading ? (
          <div className="text-xs text-ink-500 text-center py-6">
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-8">
            <HelpCircle className="w-5 h-5 text-ink-400 mx-auto mb-2" />
            <p className="text-xs text-ink-500">
              אין שאלות פתוחות. הקלידי שאלה למעלה והוסיפי.
            </p>
          </div>
        ) : (
          <>
            {open.length > 0 && (
              <Section
                label={`פתוחות (${open.length})`}
                accent="primary"
              >
                {open.map((q) => (
                  <QuestionRow
                    key={q.id}
                    question={q}
                    tasks={tasks}
                    onAnswer={(text) => {
                      answer.mutate({
                        questionId: q.id,
                        projectId: q.project_id,
                        answer: text,
                      });
                      pushUndo({
                        description: "מענה לשאלה",
                        undo: () =>
                          reopen.mutate({
                            questionId: q.id,
                            projectId: q.project_id,
                          }),
                        redo: () =>
                          answer.mutate({
                            questionId: q.id,
                            projectId: q.project_id,
                            answer: text,
                          }),
                      });
                    }}
                    onLinkTask={(taskId) => {
                      const prevTaskId = q.task_id;
                      update.mutate({
                        questionId: q.id,
                        projectId: q.project_id,
                        patch: { task_id: taskId },
                      });
                      pushUndo({
                        description: "קישור שאלה למשימה",
                        undo: () =>
                          update.mutate({
                            questionId: q.id,
                            projectId: q.project_id,
                            patch: { task_id: prevTaskId },
                          }),
                        redo: () =>
                          update.mutate({
                            questionId: q.id,
                            projectId: q.project_id,
                            patch: { task_id: taskId },
                          }),
                      });
                    }}
                    onDelete={() => {
                      const snapshot = {
                        project_id: q.project_id,
                        text: q.text,
                      };
                      let currentId = q.id;
                      remove.mutate({
                        questionId: currentId,
                        projectId: q.project_id,
                      });
                      pushUndo({
                        description: "מחיקת שאלה",
                        undo: () => {
                          create.mutate(snapshot, {
                            onSuccess: (again) => {
                              currentId = again.id;
                            },
                          });
                        },
                        redo: () =>
                          remove.mutate({
                            questionId: currentId,
                            projectId: q.project_id,
                          }),
                      });
                    }}
                  />
                ))}
              </Section>
            )}

            {answered.length > 0 && (
              <Section
                label={`נענו (${answered.length})`}
                accent="muted"
              >
                {answered.map((q) => (
                  <QuestionRow
                    key={q.id}
                    question={q}
                    tasks={tasks}
                    onLinkTask={(taskId) => {
                      const prevTaskId = q.task_id;
                      update.mutate({
                        questionId: q.id,
                        projectId: q.project_id,
                        patch: { task_id: taskId },
                      });
                      pushUndo({
                        description: "קישור שאלה למשימה",
                        undo: () =>
                          update.mutate({
                            questionId: q.id,
                            projectId: q.project_id,
                            patch: { task_id: prevTaskId },
                          }),
                        redo: () =>
                          update.mutate({
                            questionId: q.id,
                            projectId: q.project_id,
                            patch: { task_id: taskId },
                          }),
                      });
                    }}
                    onReopen={() => {
                      const prevAnswer = q.answer;
                      reopen.mutate({
                        questionId: q.id,
                        projectId: q.project_id,
                      });
                      pushUndo({
                        description: "פתיחה מחדש של שאלה",
                        undo: () =>
                          answer.mutate({
                            questionId: q.id,
                            projectId: q.project_id,
                            answer: prevAnswer ?? "",
                          }),
                        redo: () =>
                          reopen.mutate({
                            questionId: q.id,
                            projectId: q.project_id,
                          }),
                      });
                    }}
                    onDelete={() => {
                      const snapshot = {
                        project_id: q.project_id,
                        text: q.text,
                      };
                      let currentId = q.id;
                      remove.mutate({
                        questionId: currentId,
                        projectId: q.project_id,
                      });
                      pushUndo({
                        description: "מחיקת שאלה",
                        undo: () => {
                          create.mutate(snapshot, {
                            onSuccess: (again) => {
                              currentId = again.id;
                            },
                          });
                        },
                        redo: () =>
                          remove.mutate({
                            questionId: currentId,
                            projectId: q.project_id,
                          }),
                      });
                    }}
                  />
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Section header + body ─────────────────────────────────────────────────

function Section({
  label,
  accent,
  children,
}: {
  label: string;
  accent: "primary" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4
        className={
          "text-[10px] font-semibold uppercase tracking-wider mb-1.5 " +
          (accent === "primary" ? "text-primary-700" : "text-ink-500")
        }
      >
        {label}
      </h4>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

// ─── Single question row ───────────────────────────────────────────────────

function QuestionRow({
  question,
  tasks,
  onAnswer,
  onReopen,
  onLinkTask,
  onDelete,
}: {
  question: Question;
  tasks: Task[];
  onAnswer?: (text: string) => void;
  onReopen?: () => void;
  onLinkTask: (taskId: string | null) => void;
  onDelete: () => void;
}) {
  const [answering, setAnswering] = useState(false);
  const [draftAnswer, setDraftAnswer] = useState("");
  const linkedTask = tasks.find((t) => t.id === question.task_id) ?? null;
  const isAnswered = !!question.answered_at;

  return (
    <li className="rounded-md border border-ink-200 bg-white p-2 group/q">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p
            className={
              "text-xs " +
              (isAnswered ? "text-ink-500 line-through" : "text-ink-900")
            }
          >
            {question.text}
          </p>
          {linkedTask && (
            <div className="text-[10px] text-primary-700 inline-flex items-center gap-1 mt-1">
              <Link2 className="w-2.5 h-2.5" />
              {linkedTask.title}
            </div>
          )}
          {question.answer && (
            <p className="text-[11px] text-ink-700 mt-1.5 bg-ink-50 rounded px-2 py-1">
              {question.answer}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover/q:opacity-100 transition-opacity">
          <select
            value={question.task_id ?? ""}
            onChange={(e) => onLinkTask(e.target.value || null)}
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] bg-transparent border border-ink-200 rounded px-1 py-0.5 max-w-[110px]"
            title="קשרי למשימה"
          >
            <option value="">— ללא משימה —</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          {!isAnswered && onAnswer && (
            <button
              type="button"
              onClick={() => setAnswering((v) => !v)}
              className="p-1 rounded hover:bg-ink-100 text-ink-500 hover:text-success"
              title="ענה"
              aria-label="ענה"
            >
              <Check className="w-3 h-3" />
            </button>
          )}
          {isAnswered && onReopen && (
            <button
              type="button"
              onClick={onReopen}
              className="p-1 rounded hover:bg-ink-100 text-ink-500 hover:text-primary-600"
              title="פתחי מחדש"
              aria-label="פתחי מחדש"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (confirm("למחוק את השאלה?")) onDelete();
            }}
            className="p-1 rounded hover:bg-ink-100 text-ink-500 hover:text-danger"
            title="מחקי"
            aria-label="מחקי"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {answering && onAnswer && (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            autoFocus
            value={draftAnswer}
            onChange={(e) => setDraftAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draftAnswer.trim()) {
                onAnswer(draftAnswer.trim());
                setDraftAnswer("");
                setAnswering(false);
              }
              if (e.key === "Escape") {
                setDraftAnswer("");
                setAnswering(false);
              }
            }}
            placeholder="התשובה…"
            className="field py-1 text-xs flex-1"
          />
          <button
            type="button"
            onClick={() => {
              if (!draftAnswer.trim()) return;
              onAnswer(draftAnswer.trim());
              setDraftAnswer("");
              setAnswering(false);
            }}
            className="btn-accent text-xs"
            disabled={!draftAnswer.trim()}
          >
            שמרי
          </button>
        </div>
      )}
    </li>
  );
}
