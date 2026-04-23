import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare,
  FolderKanban,
  Lightbulb,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface SearchResult {
  kind: "task" | "thought" | "project";
  id: string;
  title: string;
  hint?: string | null;
}

export function GlobalSearch({ open, onClose }: Props) {
  const { activeOrganizationId } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setActiveIndex(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    if (!activeOrganizationId) return;
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const term = `%${debouncedQuery}%`;

    Promise.all([
      supabase
        .from("tasks")
        .select("id, title, status")
        .eq("organization_id", activeOrganizationId)
        .ilike("title", term)
        .limit(8),
      supabase
        .from("thoughts")
        .select("id, text_content, ai_generated_title, status")
        .eq("organization_id", activeOrganizationId)
        .ilike("text_content", term)
        .limit(8),
      supabase
        .from("projects")
        .select("id, name, description")
        .eq("organization_id", activeOrganizationId)
        .ilike("name", term)
        .limit(8),
    ])
      .then(([tasksRes, thoughtsRes, projectsRes]) => {
        if (cancelled) return;
        const out: SearchResult[] = [];
        for (const t of tasksRes.data ?? []) {
          out.push({
            kind: "task",
            id: t.id,
            title: t.title,
            hint: t.status,
          });
        }
        for (const th of thoughtsRes.data ?? []) {
          out.push({
            kind: "thought",
            id: th.id,
            title:
              th.ai_generated_title ||
              firstLine(th.text_content ?? "(ללא תוכן)") ||
              "(ללא תוכן)",
            hint: th.status,
          });
        }
        for (const pr of projectsRes.data ?? []) {
          out.push({
            kind: "project",
            id: pr.id,
            title: pr.name,
            hint: pr.description ?? null,
          });
        }
        setResults(out);
        setActiveIndex(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, activeOrganizationId, open]);

  const choose = (r: SearchResult) => {
    onClose();
    if (r.kind === "task") {
      navigate("/app/tasks");
    } else if (r.kind === "thought") {
      navigate("/app/thoughts");
    } else {
      navigate(`/app/projects/${r.id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[activeIndex];
      if (r) choose(r);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-sm flex items-start justify-center pt-[12vh] p-4"
        >
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-lift w-full max-w-xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-200">
              <Search className="w-5 h-5 text-ink-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="חיפוש משימות, מחשבות, פרויקטים…"
                className="flex-1 bg-transparent border-0 outline-none text-base text-ink-900 placeholder:text-ink-400"
              />
              {loading && <Loader2 className="w-4 h-4 animate-spin text-ink-400" />}
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-ink-100">
                <X className="w-4 h-4 text-ink-500" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
              {debouncedQuery.length < 2 ? (
                <div className="p-8 text-center text-sm text-ink-500">
                  הקלידי לפחות 2 תווים כדי לחפש.
                </div>
              ) : results.length === 0 && !loading ? (
                <div className="p-8 text-center text-sm text-ink-500">
                  לא נמצאו תוצאות עבור "{debouncedQuery}".
                </div>
              ) : (
                <ul>
                  {results.map((r, i) => (
                    <li key={`${r.kind}-${r.id}`}>
                      <button
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => choose(r)}
                        className={cn(
                          "w-full text-start px-4 py-2.5 flex items-center gap-3 border-b border-ink-100 last:border-0",
                          i === activeIndex
                            ? "bg-primary-50/50"
                            : "hover:bg-ink-50"
                        )}
                      >
                        <KindIcon kind={r.kind} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-ink-900 truncate">
                            {r.title}
                          </div>
                          {r.hint && (
                            <div className="text-xs text-ink-500 truncate">
                              {r.hint}
                            </div>
                          )}
                        </div>
                        <span className="chip shrink-0">
                          {r.kind === "task"
                            ? "משימה"
                            : r.kind === "thought"
                              ? "מחשבה"
                              : "פרויקט"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="px-4 py-2 border-t border-ink-200 text-[10px] text-ink-400 flex items-center gap-3">
              <span>↑↓ ניווט</span>
              <span>↵ פתיחה</span>
              <span>Esc סגירה</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function KindIcon({ kind }: { kind: SearchResult["kind"] }) {
  const Icon =
    kind === "task" ? CheckSquare : kind === "thought" ? Lightbulb : FolderKanban;
  return (
    <div
      className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
        kind === "task"
          ? "bg-primary-500/10 text-primary-700"
          : kind === "thought"
            ? "bg-accent-purple/10 text-accent-purple"
            : "bg-success-500/10 text-success-600"
      )}
    >
      <Icon className="w-4 h-4" />
    </div>
  );
}

function firstLine(text: string): string {
  const line = text.split("\n")[0]?.trim() ?? "";
  return line.length > 80 ? line.slice(0, 77) + "…" : line;
}
