/**
 * Account card — shows the live balance (opening + transactions) and a compact
 * recent-transactions list.
 */
import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Money, AccountIcon } from "./finance-bits";
import { ACCOUNT_KIND_META } from "@/lib/types/finance";
import { accountBalance } from "@/lib/finance/calc";
import type {
  FinanceAccount,
  FinanceAccountTransaction,
} from "@/lib/types/finance";

export function AccountCard({
  account,
  transactions,
}: {
  account: FinanceAccount;
  transactions: FinanceAccountTransaction[];
}) {
  const mine = useMemo(
    () => transactions.filter((t) => t.account_id === account.id),
    [transactions, account.id]
  );
  const balance = accountBalance(Number(account.opening_balance), mine);
  const recent = mine.slice(0, 6);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: account.color }}
        >
          <AccountIcon kind={account.kind} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-ink-900">{account.name}</h3>
          <p className="text-[11px] text-ink-400">{ACCOUNT_KIND_META[account.kind].label}</p>
        </div>
      </div>

      <div className="px-4 pt-2">
        <div
          className={cn(
            "text-2xl font-bold tabular-nums",
            balance < 0 ? "text-danger-600" : "text-ink-900"
          )}
        >
          <Money value={balance} />
        </div>
        <p className="text-xs text-ink-500">יתרה נוכחית</p>
      </div>

      <div className="mt-2 space-y-0.5 px-2 pb-3">
        {recent.length === 0 ? (
          <p className="px-2 py-2 text-center text-xs text-ink-400">אין תנועות</p>
        ) : (
          recent.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 rounded px-2 py-1 text-sm"
            >
              {Number(t.amount) < 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-danger-500" />
              ) : (
                <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-success-500" />
              )}
              <span className="min-w-0 flex-1 truncate text-ink-600">
                {t.note || txKindLabel(t.kind)}
              </span>
              <span className="shrink-0 text-[11px] text-ink-400 tabular-nums">
                {t.tx_date.slice(5)}
              </span>
              <Money
                value={Number(t.amount)}
                className={cn(
                  "shrink-0 font-medium",
                  Number(t.amount) < 0 ? "text-danger-600" : "text-success-600"
                )}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function txKindLabel(kind: string): string {
  switch (kind) {
    case "transfer_in":
      return "העברה נכנסת";
    case "transfer_out":
      return "העברה יוצאת";
    case "income":
      return "הכנסה";
    case "adjustment":
      return "התאמה";
    default:
      return "הוצאה";
  }
}
