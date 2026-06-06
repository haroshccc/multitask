import { useMemo, useState } from "react";
import {
  Plus,
  Loader2,
  Wallet,
  Trash2,
  X,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { useProjectContext } from "@/pages/app/ProjectShell";
import {
  useProjectPayments,
  useCreateProjectPayment,
  useUpdateProjectPayment,
  useDeleteProjectPayment,
  type ProjectPayment,
} from "@/lib/hooks/useProjectPayments";
import {
  useProjectCustomFields,
  useCreateCustomField,
  useUpdateCustomField,
  useDeleteCustomField,
} from "@/lib/hooks/useTaskCustomFields";
import { useEntityColumns } from "@/lib/hooks/useEntityColumns";
import { useEntityColumnVisibility } from "@/lib/hooks/useEntityColumnVisibility";
import {
  buildGridCols,
  buildGridMinWidth,
  type FixedColumnDescriptor,
} from "@/components/configurable-table/gridLayout";
import { TableHeader } from "@/components/configurable-table/ConfigurableTableHeader";
import {
  ColumnsMenu,
  type ColumnsMenuItem,
} from "@/components/configurable-table/ColumnsMenu";
import { ExportExcelButton } from "@/components/configurable-table/ExportExcelButton";
import { buildPaymentsSheet } from "@/lib/export/projectSheets";
import {
  DynCell,
  OptionsEditorModal,
  readCustomField,
  writeCustomField,
  type SelectOption,
} from "@/components/configurable-table/fieldCells";
import type { CustomFieldType, TaskCustomField } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

const DIRECTION_OPTIONS: { value: string; label: string }[] = [
  { value: "in", label: "תקבול" },
  { value: "out", label: "תשלום" },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "pending", label: "ממתין" },
  { value: "paid", label: "שולם" },
  { value: "overdue", label: "באיחור" },
  { value: "cancelled", label: "בוטל" },
];
const STATUS_LABEL = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label])
);
const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-rose-100 text-rose-700",
  cancelled: "bg-ink-100 text-ink-500",
};

const CURRENCY_SYMBOL: Record<string, string> = {
  ILS: "₪",
  USD: "$",
  EUR: "€",
};

function formatMoney(cents: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] ?? "";
  const amount = (cents ?? 0) / 100;
  const formatted = amount.toLocaleString("he-IL", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return sym ? `${sym}${formatted}` : `${formatted} ${currency}`;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Configurable-table column model for the payments table view ──────────────
// Mirrors the meetings table: same CSS-grid configurable table, no control
// columns, a small actions column for delete, fixed columns renamable/reorderable
// via `useEntityColumns({ entityType: "payment" })`.
type PaymentFixedKey =
  | "title"
  | "direction"
  | "amount"
  | "status"
  | "due_date"
  | "paid_date";

const PAYMENT_FIXED_DESCRIPTORS: FixedColumnDescriptor<PaymentFixedKey>[] = [
  {
    key: "title",
    width: "minmax(160px, 1fr)",
    defaultLabel: "תיאור",
    align: "start",
    sortable: false,
    sortKey: null,
  },
  {
    key: "direction",
    width: "90px",
    defaultLabel: "סוג",
    align: "start",
    sortable: false,
    sortKey: null,
  },
  {
    key: "amount",
    width: "minmax(110px, 0.5fr)",
    defaultLabel: "סכום",
    align: "start",
    sortable: false,
    sortKey: null,
  },
  {
    key: "status",
    width: "90px",
    defaultLabel: "סטטוס",
    align: "start",
    sortable: false,
    sortKey: null,
  },
  {
    key: "due_date",
    width: "minmax(110px, 0.5fr)",
    defaultLabel: "לתשלום עד",
    align: "start",
    sortable: false,
    sortKey: null,
  },
  {
    key: "paid_date",
    width: "minmax(110px, 0.5fr)",
    defaultLabel: "שולם בתאריך",
    align: "start",
    sortable: false,
    sortKey: null,
  },
];

const PAYMENT_FIXED_WIDTHS = Object.fromEntries(
  PAYMENT_FIXED_DESCRIPTORS.map((d) => [d.key, d.width])
) as Record<PaymentFixedKey, string>;

const PAYMENT_CONTROL_COLS = ""; // payments have no drag/expand/checkbox chrome
const PAYMENT_ACTIONS_COL = "40px"; // delete button
const PAYMENT_DYN_COL_WIDTH = 160;
const PAYMENT_CONTROL_AND_ACTIONS_WIDTH = 40;

export function ProjectPaymentsTab() {
  const { projectId } = useProjectContext();
  const { data: payments = [], isLoading } = useProjectPayments(projectId);
  const createPayment = useCreateProjectPayment();
  const [openId, setOpenId] = useState<string | null>(null);

  // Configurable custom columns (payment entity).
  const { data: customFields = [] } = useProjectCustomFields(
    projectId,
    "payment"
  );
  const createField = useCreateCustomField();
  const updateField = useUpdateCustomField();
  const deleteField = useDeleteCustomField();
  const updatePayment = useUpdateProjectPayment();
  const { fixedLabels, orderedKeys, renameFixed, reorderFixed } =
    useEntityColumns<PaymentFixedKey>({
      entityType: "payment",
      projectId,
      descriptors: PAYMENT_FIXED_DESCRIPTORS,
    });
  const { hiddenIds, toggleHidden } = useEntityColumnVisibility({
    entityType: "payment",
    projectId,
  });
  const [optionsFieldId, setOptionsFieldId] = useState<string | null>(null);
  const optionsField = useMemo(
    () => customFields.find((f) => f.id === optionsFieldId) ?? null,
    [customFields, optionsFieldId]
  );

  // Visible (non-hidden) columns drive the table; the full lists drive the
  // "עמודות" menu so hidden columns can be toggled back on.
  const visibleKeys = useMemo(
    () => orderedKeys.filter((k) => !hiddenIds.has(k)),
    [orderedKeys, hiddenIds]
  );
  const visibleFields = useMemo(
    () => customFields.filter((f) => !hiddenIds.has(f.id)),
    [customFields, hiddenIds]
  );
  const columnMenuItems = useMemo<ColumnsMenuItem[]>(
    () => [
      ...orderedKeys.map((k) => ({
        id: k,
        kind: "fixed" as const,
        label:
          fixedLabels[k] ??
          PAYMENT_FIXED_DESCRIPTORS.find((d) => d.key === k)?.defaultLabel ??
          k,
      })),
      ...customFields.map((f) => ({
        id: f.id,
        kind: "custom" as const,
        label: f.field_label,
      })),
    ],
    [orderedKeys, customFields, fixedLabels]
  );

  const orderedDescriptors = useMemo(
    () =>
      visibleKeys.map((k) => PAYMENT_FIXED_DESCRIPTORS.find((d) => d.key === k)!),
    [visibleKeys]
  );

  const gridCols = useMemo(
    () =>
      buildGridCols(visibleKeys, visibleFields.length, PAYMENT_FIXED_WIDTHS, {
        controlCols: PAYMENT_CONTROL_COLS,
        actionsCol: PAYMENT_ACTIONS_COL,
        dynColWidth: PAYMENT_DYN_COL_WIDTH,
      }),
    [visibleKeys, visibleFields.length]
  );
  const gridMinWidth = useMemo(
    () =>
      buildGridMinWidth(visibleKeys, visibleFields.length, PAYMENT_FIXED_WIDTHS, {
        controlAndActionsWidth: PAYMENT_CONTROL_AND_ACTIONS_WIDTH,
        dynColWidth: PAYMENT_DYN_COL_WIDTH,
      }),
    [visibleKeys, visibleFields.length]
  );

  const handleAddField = (type: CustomFieldType, label: string) => {
    if (!projectId) return;
    const fieldKey = `f_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    createField.mutate({
      project_id: projectId,
      field_key: fieldKey,
      field_label: label,
      field_type: type,
      is_visible: true,
      entity_type: "payment",
    });
  };
  const handleRenameField = (fieldId: string, label: string) =>
    updateField.mutate({ fieldId, patch: { field_label: label } });
  const handleReorderFields = (newOrder: TaskCustomField[]) => {
    newOrder.forEach((field, i) => {
      const next = (i + 1) * 1000;
      if (field.sort_order !== next) {
        updateField.mutate({ fieldId: field.id, patch: { sort_order: next } });
      }
    });
  };
  const handleDeleteField = (fieldId: string) => deleteField.mutate(fieldId);
  const handleSaveOptions = (fieldId: string, options: SelectOption[]) => {
    updateField.mutate({
      fieldId,
      patch: { options: options as unknown as TaskCustomField["options"] },
    });
    setOptionsFieldId(null);
  };

  // Summary: income / expense / balance (cancelled excluded from totals).
  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const p of payments) {
      if (p.status === "cancelled") continue;
      if (p.direction === "in") income += p.amount_cents ?? 0;
      else if (p.direction === "out") expense += p.amount_cents ?? 0;
    }
    return { income, expense, balance: income - expense };
  }, [payments]);

  const summaryCurrency = payments[0]?.currency ?? "ILS";

  const openPayment = payments.find((p) => p.id === openId) ?? null;

  const handleCreate = async () => {
    const p = await createPayment.mutateAsync({ projectId });
    setOpenId(p.id);
  };

  if (isLoading) {
    return (
      <div className="card p-10 text-center text-ink-500 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
        טוען תשלומים…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <SummaryStrip
          income={summary.income}
          expense={summary.expense}
          balance={summary.balance}
          currency={summaryCurrency}
        />
        <div className="inline-flex items-center gap-2">
          <ColumnsMenu
            items={columnMenuItems}
            hiddenIds={hiddenIds}
            onToggle={toggleHidden}
          />
          {payments.length > 0 && (
            <ExportExcelButton
              filename="תשלומים"
              build={() => buildPaymentsSheet(payments, customFields)}
            />
          )}
          <button
            type="button"
            onClick={handleCreate}
            disabled={createPayment.isPending}
            className="btn-accent text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            תשלום חדש
          </button>
        </div>
      </div>

      {optionsField && (
        <OptionsEditorModal
          field={optionsField}
          onSave={(opts) => handleSaveOptions(optionsField.id, opts)}
          onClose={() => setOptionsFieldId(null)}
        />
      )}

      {payments.length === 0 ? (
        <EmptyState onCreate={handleCreate} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-auto">
            <div style={{ minWidth: gridMinWidth }}>
              <TableHeader
                controlSpacerCount={0}
                gridCols={gridCols}
                customFields={visibleFields}
                fixedLabels={fixedLabels}
                orderedDescriptors={orderedDescriptors}
                sortKey={null}
                sortDir="asc"
                onSort={() => {}}
                onRenameFixed={renameFixed}
                onReorderFixed={reorderFixed}
                onAddField={handleAddField}
                onDeleteField={handleDeleteField}
                onRenameField={handleRenameField}
                onReorderFields={handleReorderFields}
                onEditFieldOptions={(fieldId) => setOptionsFieldId(fieldId)}
              />
              {payments.map((p) => (
                <PaymentRow
                  key={p.id}
                  payment={p}
                  projectId={projectId}
                  gridCols={gridCols}
                  orderedKeys={visibleKeys}
                  customFields={visibleFields}
                  onSaveCustom={(field, value) =>
                    updatePayment.mutate({
                      id: p.id,
                      projectId,
                      patch: {
                        custom_fields: writeCustomField(
                          p,
                          field.field_key,
                          value
                        ),
                      },
                    })
                  }
                  onOpen={() => setOpenId(p.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {openPayment && (
        <PaymentDetailModal
          payment={openPayment}
          projectId={projectId}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function SummaryStrip({
  income,
  expense,
  balance,
  currency,
}: {
  income: number;
  expense: number;
  balance: number;
  currency: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5">
        <div className="text-[10px] text-emerald-700 font-medium">תקבולים</div>
        <div className="text-sm font-semibold text-emerald-800">
          {formatMoney(income, currency)}
        </div>
      </div>
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5">
        <div className="text-[10px] text-rose-700 font-medium">תשלומים</div>
        <div className="text-sm font-semibold text-rose-800">
          {formatMoney(expense, currency)}
        </div>
      </div>
      <div
        className={cn(
          "rounded-xl border px-3 py-1.5",
          balance >= 0
            ? "border-ink-200 bg-ink-50"
            : "border-amber-200 bg-amber-50"
        )}
      >
        <div className="text-[10px] text-ink-500 font-medium">מאזן</div>
        <div
          className={cn(
            "text-sm font-semibold",
            balance >= 0 ? "text-ink-900" : "text-amber-700"
          )}
        >
          {formatMoney(balance, currency)}
        </div>
      </div>
    </div>
  );
}

function DirectionChip({ direction }: { direction: string }) {
  const isIn = direction === "in";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        isIn ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
      )}
    >
      {isIn ? (
        <ArrowDownLeft className="w-3 h-3" />
      ) : (
        <ArrowUpRight className="w-3 h-3" />
      )}
      {isIn ? "תקבול" : "תשלום"}
    </span>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card p-8 text-center">
      <Wallet className="w-9 h-9 text-ink-300 mx-auto mb-2" />
      <h3 className="text-base font-semibold text-ink-900 mb-1">
        עוד אין תשלומים
      </h3>
      <p className="text-xs text-ink-500 mb-4 max-w-sm mx-auto">
        עקבו אחר תקבולים ותשלומים של הפרויקט — סכום, סטטוס, תאריך יעד ותאריך
        תשלום. אפשר להוסיף עמודות מותאמות אישית.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="btn-accent text-sm inline-flex items-center gap-1.5"
      >
        <Plus className="w-4 h-4" />
        תשלום ראשון
      </button>
    </div>
  );
}

function PaymentRow({
  payment,
  projectId,
  gridCols,
  orderedKeys,
  customFields,
  onSaveCustom,
  onOpen,
}: {
  payment: ProjectPayment;
  projectId: string;
  gridCols: string;
  orderedKeys: PaymentFixedKey[];
  customFields: TaskCustomField[];
  onSaveCustom: (field: TaskCustomField, value: unknown) => void;
  onOpen: () => void;
}) {
  const del = useDeleteProjectPayment();

  const renderFixed = (key: PaymentFixedKey) => {
    switch (key) {
      case "title":
        return (
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 truncate text-start font-medium text-ink-900 hover:text-primary-700"
          >
            {payment.title.trim() || "תשלום ללא שם"}
          </button>
        );
      case "direction":
        return <DirectionChip direction={payment.direction} />;
      case "amount":
        return (
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              payment.direction === "in" ? "text-emerald-700" : "text-rose-700"
            )}
          >
            {formatMoney(payment.amount_cents, payment.currency)}
          </span>
        );
      case "status":
        return (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
              STATUS_CLASS[payment.status] ?? "bg-ink-100 text-ink-600"
            )}
          >
            {STATUS_LABEL[payment.status] ?? payment.status}
          </span>
        );
      case "due_date":
        return (
          <span className="text-xs text-ink-600 truncate">
            {formatDate(payment.due_date)}
          </span>
        );
      case "paid_date":
        return (
          <span className="text-xs text-ink-600 truncate">
            {formatDate(payment.paid_date)}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="grid items-center gap-1 px-1.5 py-1.5 border-b border-ink-100 hover:bg-ink-50"
      style={{ gridTemplateColumns: gridCols }}
    >
      {orderedKeys.map((key) => (
        <div key={key} className="min-w-0 flex items-center">
          {renderFixed(key)}
        </div>
      ))}
      {customFields.map((f) => (
        <div key={f.id} className="min-w-0 flex items-center">
          <DynCell
            field={f}
            value={readCustomField(payment, f.field_key)}
            onSave={(v) => onSaveCustom(f, v)}
          />
        </div>
      ))}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => {
            if (confirm("למחוק את התשלום?"))
              del.mutate({ id: payment.id, projectId });
          }}
          className="p-1 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger/10"
          aria-label="מחק תשלום"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function PaymentDetailModal({
  payment,
  projectId,
  onClose,
}: {
  payment: ProjectPayment;
  projectId: string;
  onClose: () => void;
}) {
  const updatePayment = useUpdateProjectPayment();

  const [title, setTitle] = useState(payment.title);
  const [direction, setDirection] = useState(payment.direction);
  const [amount, setAmount] = useState(
    payment.amount_cents ? String(payment.amount_cents / 100) : ""
  );
  const [currency, setCurrency] = useState(payment.currency || "ILS");
  const [status, setStatus] = useState(payment.status);
  const [dueDate, setDueDate] = useState(payment.due_date ?? "");
  const [paidDate, setPaidDate] = useState(payment.paid_date ?? "");
  const [notes, setNotes] = useState(payment.notes ?? "");

  const save = () => {
    const parsed = parseFloat(amount);
    const amountCents = Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
    updatePayment.mutate({
      id: payment.id,
      projectId,
      patch: {
        title: title.trim(),
        direction,
        amount_cents: amountCents,
        currency,
        status,
        due_date: dueDate || null,
        paid_date: paidDate || null,
        notes: notes.trim() || null,
      },
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-lift w-full max-w-xl my-8 flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-ink-900">פרטי תשלום</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-ink-100"
          >
            <X className="w-4 h-4 text-ink-600" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto min-h-0">
          <div>
            <label className="eyebrow mb-1.5 block">תיאור</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="למשל: מקדמה / חשבונית ספק"
              className="field"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="eyebrow mb-1.5 block">סוג</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                className="field"
              >
                {DIRECTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="eyebrow mb-1.5 block">סטטוס</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="field"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="eyebrow mb-1.5 block">סכום</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="field"
              />
            </div>
            <div>
              <label className="eyebrow mb-1.5 block">מטבע</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="field"
              >
                <option value="ILS">₪ שקל (ILS)</option>
                <option value="USD">$ דולר (USD)</option>
                <option value="EUR">€ אירו (EUR)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="eyebrow mb-1.5 block">לתשלום עד</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="field"
              />
            </div>
            <div>
              <label className="eyebrow mb-1.5 block">שולם בתאריך</label>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className="field"
              />
            </div>
          </div>

          <div>
            <label className="eyebrow mb-1.5 block">הערות</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="פרטים נוספים…"
              className="field resize-y"
            />
          </div>
        </div>

        <div className="px-5 py-3 bg-ink-50 border-t border-ink-200 flex items-center justify-end gap-2 shrink-0">
          <button onClick={onClose} className="btn-ghost text-sm">
            ביטול
          </button>
          <button
            onClick={save}
            disabled={updatePayment.isPending}
            className={cn(
              "btn-accent text-sm",
              updatePayment.isPending && "opacity-50"
            )}
          >
            {updatePayment.isPending ? "שומר…" : "שמירה"}
          </button>
        </div>
      </div>
    </div>
  );
}
