/**
 * One occurrence row with the two separate states (spec §4.3):
 *  - charged-to-budget (left checkbox; auto or manual vee)
 *  - withdrawn-from-account ("paid in practice"; immediate / future-dated)
 */
import { Check, Zap, CalendarClock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Money, AccountIcon } from "./finance-bits";
import { toDateKey } from "@/lib/finance/calc";
import type {
  FinanceOccurrence,
  FinanceExpense,
  FinanceAccount,
} from "@/lib/types/finance";

function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

export function ExpenseRow({
  occ,
  expense,
  account,
  readOnly,
  onToggleCharged,
  onToggleWithdrawn,
  onArchive,
}: {
  occ: FinanceOccurrence;
  expense?: FinanceExpense;
  account?: FinanceAccount;
  readOnly?: boolean;
  onToggleCharged: (charged: boolean) => void;
  onToggleWithdrawn: (withdrawn: boolean) => void;
  onArchive?: () => void;
}) {
  const today = toDateKey(new Date());
  const overdueManual =
    !occ.budget_charged &&
    expense?.budget_charge_mode === "manual_check" &&
    occ.due_date < today;

  const future = occ.withdrawal_date && occ.withdrawal_date > today;

  return (
    <div
      className={cn(
        "group flex min-h-[40px] items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm transition-colors sm:gap-2 sm:px-2",
        occ.withdrawn
          ? "bg-ink-50"
          : occ.budget_charged
          ? "bg-sky-50/60"
          : "hover:bg-ink-50",
        overdueManual && "bg-danger-50/60"
      )}
    >
      {/* charged-to-budget vee — generous tap target for touch */}
      <button
        type="button"
        onClick={() => !readOnly && onToggleCharged(!occ.budget_charged)}
        disabled={readOnly}
        aria-pressed={occ.budget_charged}
        aria-label={occ.budget_charged ? "חויב לתקציב" : "סמן חיוב לתקציב"}
        title={occ.budget_charged ? "חויב לתקציב" : "סמן חיוב לתקציב"}
        className="flex h-9 w-7 shrink-0 items-center justify-center disabled:cursor-default"
      >
        <span
          className={cn(
            "flex h-[22px] w-[22px] items-center justify-center rounded-md border transition-colors",
            occ.budget_charged
              ? "border-primary-500 bg-primary-500 text-white"
              : "border-ink-300 text-transparent group-hover:border-primary-400"
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      </button>

      <span className="min-w-0 flex-1 truncate text-ink-900">
        {expense?.title || "—"}
      </span>

      <Money
        value={Number(occ.amount)}
        className={cn(
          "shrink-0 font-medium",
          occ.budget_charged ? "text-ink-900" : "text-ink-400"
        )}
      />

      <span className="hidden shrink-0 text-xs text-ink-400 tabular-nums min-[360px]:inline">
        {shortDate(occ.due_date)}
      </span>

      {/* account / withdrawal state */}
      <button
        type="button"
        onClick={() => !readOnly && onToggleWithdrawn(!occ.withdrawn)}
        disabled={readOnly}
        aria-pressed={occ.withdrawn}
        aria-label={
          occ.withdrawn
            ? "ירד מהחשבון בפועל — בטל סימון"
            : future
            ? "ירידה עתידית — סמן כשירד בפועל"
            : "סמן כירד בפועל"
        }
        title={
          occ.withdrawn
            ? "ירד מהחשבון בפועל"
            : future
            ? "ירידה עתידית — סמן כשירד בפועל"
            : "סמן כירד בפועל"
        }
        className={cn(
          "flex h-7 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] transition-colors",
          occ.withdrawn
            ? "border-success-300 bg-success-50 text-success-700"
            : "border-ink-300 text-ink-500 hover:bg-ink-100",
          readOnly && "cursor-default opacity-70 hover:bg-transparent"
        )}
      >
        {account ? (
          <AccountIcon kind={account.kind} className="h-3 w-3" />
        ) : future ? (
          <CalendarClock className="h-3 w-3" />
        ) : (
          <Zap className="h-3 w-3" />
        )}
        <span>{occ.withdrawn ? "שולם" : future ? "עתידי" : "ירד?"}</span>
      </button>

      {onArchive && !readOnly && (
        <button
          type="button"
          onClick={onArchive}
          aria-label="הסר הוצאה"
          title="הסר הוצאה"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-300 transition-opacity hover:bg-danger-50 hover:text-danger-600 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
