import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Shown in the fallback so the user can still identify the recording. */
  title?: string | null;
}

interface State {
  failed: boolean;
}

/**
 * Defense-in-depth: a single recording with malformed `ai_output` must never
 * white-screen the whole insights feed. If a card throws while rendering, show
 * a compact fallback instead and keep the rest of the feed alive.
 */
export class CardErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("InsightCard render failed:", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">
              {this.props.title?.trim() || "הקלטה"} — לא ניתן להציג את הסיכום
            </p>
            <p className="text-[12px] text-amber-700 mt-0.5">
              נתוני ה-AI של ההקלטה פגומים. אפשר לפתוח אותה ב״קבצים״ ולהריץ ״עיבוד
              AI מחדש״.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
