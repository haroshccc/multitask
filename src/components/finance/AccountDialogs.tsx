/**
 * Create-account and transfer-between-accounts dialogs.
 */
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Modal, LabeledField } from "./finance-bits";
import { useCreateAccount, useCreateTransfer } from "@/lib/hooks/useFinance";
import { toDateKey } from "@/lib/finance/calc";
import {
  ACCOUNT_KIND_META,
  type FinanceAccount,
  type AccountKind,
} from "@/lib/types/finance";

const ACCOUNT_COLORS = ["#6b6b80", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

export function CreateAccountDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateAccount();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("bank");
  const [color, setColor] = useState(ACCOUNT_COLORS[0]);
  const [opening, setOpening] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError("יש לתת שם לחשבון");
      return;
    }
    try {
      await create.mutateAsync({ name: name.trim(), kind, color, opening_balance: opening });
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "שגיאה");
    }
  }

  return (
    <Modal
      title="חשבון חדש"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>
            ביטול
          </button>
          <button type="button" className="btn-primary text-sm" onClick={save} disabled={create.isPending}>
            {create.isPending ? "שומר..." : "שמירה"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <LabeledField label="שם החשבון">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </LabeledField>
        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="סוג">
            <select className="field" value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
              {(Object.keys(ACCOUNT_KIND_META) as AccountKind[]).map((k) => (
                <option key={k} value={k}>
                  {ACCOUNT_KIND_META[k].label}
                </option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="יתרת פתיחה">
            <input
              type="number"
              className="field"
              value={Number.isFinite(opening) ? opening : 0}
              onChange={(e) => setOpening(Number(e.target.value))}
            />
          </LabeledField>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-600">צבע</span>
          <div className="flex flex-wrap gap-1.5">
            {ACCOUNT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "h-7 w-7 rounded-full border-2",
                  color === c ? "border-ink-900" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-danger-600">{error}</p>}
      </div>
    </Modal>
  );
}

export function TransferDialog({
  accounts,
  onClose,
}: {
  accounts: FinanceAccount[];
  onClose: () => void;
}) {
  const transfer = useCreateTransfer();
  const [from, setFrom] = useState(accounts[0]?.id ?? "");
  const [to, setTo] = useState(accounts[1]?.id ?? "");
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(toDateKey(new Date()));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!from || !to || from === to) {
      setError("בחרי חשבון מקור ויעד שונים");
      return;
    }
    if (amount <= 0) {
      setError("סכום חייב להיות חיובי");
      return;
    }
    try {
      await transfer.mutateAsync({
        from_account_id: from,
        to_account_id: to,
        amount,
        tx_date: date,
        note: note.trim() || null,
      });
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "שגיאה");
    }
  }

  return (
    <Modal
      title="העברה בין חשבונות"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>
            ביטול
          </button>
          <button type="button" className="btn-primary text-sm" onClick={save} disabled={transfer.isPending}>
            {transfer.isPending ? "מעביר..." : "העברה"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="מחשבון">
            <select className="field" value={from} onChange={(e) => setFrom(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="לחשבון">
            <select className="field" value={to} onChange={(e) => setTo(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </LabeledField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="סכום">
            <input
              type="number"
              className="field"
              value={Number.isFinite(amount) ? amount : 0}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={0}
            />
          </LabeledField>
          <LabeledField label="תאריך">
            <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
          </LabeledField>
        </div>
        <LabeledField label="הערה">
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
        </LabeledField>
        {error && <p className="text-sm text-danger-600">{error}</p>}
      </div>
    </Modal>
  );
}
