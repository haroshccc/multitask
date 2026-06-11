import { useState } from "react";
import { Copy } from "lucide-react";
import { useDuplicatePlan } from "@/lib/hooks/usePlans";
import { PLAN_HORIZONS } from "@/lib/types/plans";
import { addMonthsToDate, todayIso } from "./plan-format";
import { DateField } from "@/components/ui/DateField";

/** Clone a plan into a shorter, linked plan (full copy + parent link). */
export function ClonePlanDialog({
  sourcePlanId,
  sourceName,
  onClose,
  onCloned,
}: {
  sourcePlanId: string;
  sourceName: string;
  onClose: () => void;
  onCloned: (newId: string) => void;
}) {
  const duplicate = useDuplicatePlan();
  const [name, setName] = useState(`${sourceName} — רבעון`);
  const [horizonId, setHorizonId] = useState("quarter");
  const [start, setStart] = useState(todayIso());

  const horizon = PLAN_HORIZONS.find((h) => h.id === horizonId) ?? PLAN_HORIZONS[0];
  const end = horizon.months ? addMonthsToDate(start, horizon.months) : null;

  const submit = () => {
    duplicate.mutate(
      {
        sourcePlanId,
        name: name.trim() || null,
        horizon: horizonId,
        start: start || null,
        end,
      },
      { onSuccess: (newId) => onCloned(newId) }
    );
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-ink-900/40 flex items-center justify-center p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white rounded-2xl shadow-lift w-full max-w-md p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-ink-900 flex items-center gap-2">
          <Copy className="w-4 h-4 text-primary-600" />
          שכפול לתוכנית קצרה
        </h3>
        <p className="text-xs text-ink-500">
          העתקה מלאה של השלבים, המשימות, ההחלטות והמטריצה. התוכנית החדשה תישאר
          מקושרת למקור אך ניתנת לעריכה מלאה ועצמאית.
        </p>

        <label className="block text-sm">
          <span className="text-ink-600 text-xs">שם</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field text-sm w-full mt-1" />
        </label>

        <div className="flex gap-2">
          <label className="block text-sm flex-1">
            <span className="text-ink-600 text-xs">טווח</span>
            <select value={horizonId} onChange={(e) => setHorizonId(e.target.value)} className="field text-sm w-full mt-1">
              {PLAN_HORIZONS.filter((h) => h.id !== "custom").map((h) => (
                <option key={h.id} value={h.id}>{h.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm flex-1">
            <span className="text-ink-600 text-xs">התחלה</span>
            <DateField value={start} onChange={setStart} className="w-full mt-1" required />
          </label>
        </div>
        {end && (
          <p className="text-xs text-ink-400">סיום משוער: {end.split("-").reverse().join("/")}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">ביטול</button>
          <button
            type="button"
            onClick={submit}
            disabled={duplicate.isPending}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {duplicate.isPending ? "משכפל…" : "שכפל"}
          </button>
        </div>
      </div>
    </div>
  );
}
