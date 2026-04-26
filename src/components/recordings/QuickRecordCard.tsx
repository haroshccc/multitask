import { Mic } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Props {
  onStart: () => void;
  className?: string;
}

export function QuickRecordCard({ onStart, className }: Props) {
  return (
    <button
      type="button"
      onClick={onStart}
      className={cn(
        "card p-5 sm:p-6 text-center transition-all",
        "hover:-translate-y-0.5 hover:shadow-lift",
        "border-primary-200 hover:border-primary-400 bg-gradient-to-br from-primary-50 to-white",
        className
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center shadow-accent">
          <Mic className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-900">הקלטה מהירה</p>
          <p className="text-xs text-ink-500 mt-1">
            ישירות מהמערכת — השהי, המשיכי, סיימי, שמרי.
          </p>
        </div>
        <span className="btn-primary !py-1.5 !px-3 pointer-events-none">
          <Mic className="w-4 h-4" />
          הקליטי עכשיו
        </span>
      </div>
    </button>
  );
}
