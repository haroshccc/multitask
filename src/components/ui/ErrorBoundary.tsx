import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * App-level error boundary. Before this existed, any render crash blanked
 * the whole app with no recovery path. Renders a friendly RTL card with a
 * reload action; the error itself goes to console.error for debugging.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center bg-ink-50 p-6"
      >
        <div className="card p-8 max-w-md w-full text-center space-y-4">
          <span
            className="mx-auto w-12 h-12 rounded-full bg-danger-50 flex items-center justify-center"
            aria-hidden="true"
          >
            <AlertTriangle className="w-6 h-6 text-danger-600" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-ink-900 mb-1">
              משהו השתבש
            </h1>
            <p className="text-sm text-ink-600 leading-relaxed">
              קרתה שגיאה לא צפויה. הנתונים שלך שמורים — רענון יחזיר אותך
              לאפליקציה.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary text-sm inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            רענון
          </button>
          <p className="text-[10px] text-ink-400 break-all" dir="ltr">
            {this.state.error.message}
          </p>
        </div>
      </div>
    );
  }
}
