import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, FileText, CheckSquare, Mic, Lightbulb, FolderKanban, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils/cn";
import { useGlobalSearch, type GlobalSearchResult } from "@/lib/hooks/useGlobalSearch";

interface GlobalSearchPaletteProps {
  open: boolean;
  onClose: () => void;
}

const ENTITY_ICONS: Record<string, typeof FileText> = {
  task: CheckSquare,
  project: FolderKanban,
  recording: Mic,
  thought: Lightbulb,
  event: Calendar,
};

const ENTITY_ROUTES: Record<string, (id: string) => string> = {
  task: () => `/app/tasks`,
  project: (id) => `/app/projects/${id}`,
  recording: () => `/app/recordings`,
  thought: () => `/app/thoughts`,
  event: () => `/app/calendar`,
};

export function GlobalSearchPalette({ open, onClose }: GlobalSearchPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebounced("");
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results = [], isLoading } = useGlobalSearch(debounced);

  const grouped = groupByType(results);

  const handleSelect = (r: GlobalSearchResult) => {
    const route = ENTITY_ROUTES[r.entity_type]?.(r.id) ?? "/app";
    navigate(route);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const flat = results;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flat.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && flat[selectedIndex]) {
        e.preventDefault();
        handleSelect(flat[selectedIndex]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-start justify-center p-4 pt-[10vh]"
        >
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-lift w-full max-w-xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-200">
              <Search className="w-5 h-5 text-ink-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="חיפוש משימות, הקלטות, מחשבות..."
                className="flex-1 bg-transparent outline-none text-ink-900"
              />
              <kbd className="hidden md:inline-block px-1.5 py-0.5 bg-ink-100 rounded text-xs font-mono text-ink-500">
                Esc
              </kbd>
              <button onClick={onClose} className="p-1 rounded hover:bg-ink-100 md:hidden">
                <X className="w-4 h-4 text-ink-600" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {debounced.length < 2 ? (
                <p className="text-sm text-ink-500 text-center py-8">
                  הקלידי לפחות 2 תווים לחיפוש
                </p>
              ) : isLoading ? (
                <p className="text-sm text-ink-500 text-center py-8">מחפש...</p>
              ) : results.length === 0 ? (
                <p className="text-sm text-ink-500 text-center py-8">
                  לא נמצאו תוצאות
                </p>
              ) : (
                Object.entries(grouped).map(([type, items]) => (
                  <div key={type} className="mb-2">
                    <div className="eyebrow px-2 mb-1">{typeLabel(type)}</div>
                    {items.map((r) => {
                      const flatIndex = results.indexOf(r);
                      return (
                        <ResultRow
                          key={`${type}:${r.id}`}
                          result={r}
                          selected={flatIndex === selectedIndex}
                          onClick={() => handleSelect(r)}
                        />
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ResultRow({
  result,
  selected,
  onClick,
}: {
  result: GlobalSearchResult;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = ENTITY_ICONS[result.entity_type] ?? FileText;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-start px-3 py-2 rounded-lg flex items-center gap-3 transition-colors",
        selected ? "bg-primary-50" : "hover:bg-ink-50"
      )}
    >
      <Icon className="w-4 h-4 text-ink-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink-900 truncate">{result.title}</div>
        {result.snippet && (
          <div className="text-xs text-ink-500 truncate">{result.snippet}</div>
        )}
      </div>
    </button>
  );
}

function groupByType(
  results: GlobalSearchResult[]
): Record<string, GlobalSearchResult[]> {
  const out: Record<string, GlobalSearchResult[]> = {};
  for (const r of results) {
    if (!out[r.entity_type]) out[r.entity_type] = [];
    out[r.entity_type].push(r);
  }
  return out;
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    task: "משימות",
    project: "פרויקטים",
    recording: "הקלטות",
    thought: "מחשבות",
    event: "אירועים",
  };
  return map[type] ?? type;
}
