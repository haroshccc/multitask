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
  onToggleCharged,
  onToggleWithdrawn,
  onArchive,
}: {
  occ: FinanceOccurrence;
  expense?: FinanceExpense;
  account?: FinanceAccount;
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
        "group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
        occ.withdrawn
          ? "bg-ink-50"
          : occ.budget_charged
          ? "bg-sky-50/60"
          : "hover:bg-ink-50",
        overdueManual && "bg-danger-50/60"
      )}
    >
      {/* charged-to-budget vee */}
      <button
        type="button"
        onClick={() => onToggleCharged(!occ.budget_charged)}
        title={occ.budget_charged ? "חויב לתקציב" : "סמן חיוב לתקציב"}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
          occ.budget_charged
            ? "border-primary-500 bg-primary-500 text-white"
            : "border-ink-300 text-transparent hover:border-primary-400"
        )}
      >
        <Check className="h-3.5 w-3.5" />
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

      <span className="shrink-0 text-xs text-ink-400 tabular-nums">
        {shortDate(occ.due_date)}
      </span>

      {/* account / withdrawal state */}
      <button
        type="button"
        onClick={() => onToggleWithdrawn(!occ.withdrawn)}
        title={
          occ.withdrawn
            ? "ירד מהחשבון בפועל"
            : future
            ? "ירידה עתידית — סמן כשירד בפועל"
            : "סמן כירד בפועל"
        }
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
          occ.withdrawn
            ? "border-success-300 bg-success-50 text-success-700"
            : future
            ? "border-ink-300 text-ink-500 hover:bg-ink-100"
            : "border-ink-300 text-ink-500 hover:bg-ink-100"
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

      {onArchive && (
        <button
          type="button"
          onClick={onArchive}
          title="הסר הוצאה"
          className="shrink-0 rounded p-1 text-ink-300 opacity-0 transition-opacity hover:bg-danger-50 hover:text-danger-600 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
