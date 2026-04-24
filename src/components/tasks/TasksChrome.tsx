import {
  SlidersHorizontal,
  BarChart3,
  Plus,
  Eye,
  EyeOff,
  Check,
  List as ListIcon2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ListIcon } from "@/components/tasks/list-icons";
import { ToggleButton, PopoverButton } from "@/components/layout/ChromeControls";

interface UnifiedList {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

interface TasksChromeProps {
  // Lists
  lists: UnifiedList[];
  hiddenListIds: Set<string>;
  onToggleListVisibility: (listId: string) => void;
  onCreateList: () => void;

  // Filter / stats panel toggles
  filtersActiveCount: number;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  statsOpen: boolean;
  onToggleStats: () => void;

  className?: string;
}

/**
 * Compact top chrome for the Tasks screen. Mirrors `CalendarChrome` but
 * scoped to the controls Tasks needs: lists popover + filter toggle + stats
 * toggle. All three are closed by default so the columns get maximum
 * vertical space (particularly important on mobile).
 *
 * Page-level settings (columns-in-view stepper, archive, statuses editor)
 * continue to live in the ScreenScaffold `actions` gear — those are rarely-
 * touched preferences.
 */
export function TasksChrome({
  lists,
  hiddenListIds,
  onToggleListVisibility,
  onCreateList,
  filtersActiveCount,
  filtersOpen,
  onToggleFilters,
  statsOpen,
  onToggleStats,
  className,
}: TasksChromeProps) {
  const visibleListCount = lists.length - hiddenListIds.size;

  return (
    <div
      className={cn(
        "card overflow-visible px-2 py-1.5 flex items-center gap-1.5 flex-wrap",
        className
      )}
    >
      <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider ps-1 pe-2 shrink-0 hidden sm:inline-block">
        סרגל
      </span>

      {/* Lists popover */}
      <PopoverButton
        icon={<ListIcon2 className="w-3.5 h-3.5" />}
        label={`רשימות (${visibleListCount}/${lists.length})`}
        title="בחירת רשימות בתצוגה"
        badge={hiddenListIds.size > 0 ? `−${hiddenListIds.size}` : undefined}
        wide
      >
        {() => (
          <div className="py-1 max-h-72 overflow-y-auto">
            <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1 border-b border-ink-100">
              רשימות פעילות בתצוגה
            </div>
            {lists.length === 0 ? (
              <p className="px-3 py-2 text-xs text-ink-500">
                עוד אין רשימות.
              </p>
            ) : (
              lists.map((l) => {
                const hidden = hiddenListIds.has(l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => onToggleListVisibility(l.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50"
                    type="button"
                  >
                    <span
                      className={cn(
                        "w-3 h-3 rounded-sm border flex items-center justify-center shrink-0",
                        hidden ? "border-ink-300 bg-white" : "border-transparent"
                      )}
                      style={hidden ? undefined : { backgroundColor: l.color ?? "#6b6b80" }}
                    >
                      {!hidden && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    {l.emoji && <ListIcon emoji={l.emoji} className="w-3.5 h-3.5" />}
                    <span
                      className={cn(
                        "truncate flex-1",
                        hidden ? "text-ink-500" : "text-ink-900"
                      )}
                    >
                      {l.name}
                    </span>
                    {hidden ? (
                      <EyeOff className="w-3 h-3 text-ink-400" />
                    ) : (
                      <Eye className="w-3 h-3 text-ink-400" />
                    )}
                  </button>
                );
              })
            )}
            <div className="border-t border-ink-100 mt-1 pt-1">
              <button
                onClick={onCreateList}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start text-primary-600 hover:bg-ink-50"
                type="button"
              >
                <Plus className="w-3.5 h-3.5" />
                רשימה חדשה
              </button>
            </div>
          </div>
        )}
      </PopoverButton>

      <ToggleButton
        active={filtersOpen}
        onClick={onToggleFilters}
        icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
        label="סינון"
        badge={filtersActiveCount > 0 ? String(filtersActiveCount) : undefined}
      />

      <ToggleButton
        active={statsOpen}
        onClick={onToggleStats}
        icon={<BarChart3 className="w-3.5 h-3.5" />}
        label="סטטיסטיקות"
      />
    </div>
  );
}

