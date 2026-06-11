import { useMemo, useState } from "react";
import {
  Plus,
  Loader2,
  Wallet,
  Trash2,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";
import { useProjectContext } from "@/pages/app/ProjectShell";
import { useProjectContacts } from "@/lib/hooks/useContacts";
import type { ProjectContact } from "@/lib/services/contacts";
import { useOrgScope, assertOrgScope } from "@/lib/hooks/useOrgScope";
import { findOrCreatePaymentsFolder } from "@/lib/services/document-links";
import { LinkedDocumentsSection } from "@/components/projects/LinkedDocumentsSection";
import {
  AddDocumentModal,
  type AddDocumentTarget,
} from "@/components/projects/AddDocumentModal";
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
import { DateField } from "@/components/ui/DateField";

const DIRECTION_OPTIONS: { value: string; label: string }[] = [
  { value: "in", label: "תקבול" },
  { value: "out", label: "תשלום" },
];

// New status model: draft | demand | paid | cancelled. Labels are
// direction-aware (in = תקבול / customer owes us, out = תשלום / we owe a
// supplier). "באיחור" is *derived* (not a stored status) — see isOverdue.
const STATUS_VALUES = ["draft", "demand", "paid", "cancelled"] as const;

function paymentStatusLabel(status: string, direction: string): string {
  switch (status) {
    case "draft":
      return "צפוי";
    case "demand":
      return direction === "in" ? "דרישה נשלחה" : "דרישה התקבלה";
    case "paid":
      return direction === "in" ? "התקבל" : "שולם";
    case "cancelled":
      return "בוטל";
    default:
      return status;
  }
}

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-ink-100 text-ink-600",
  demand: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-ink-100 text-ink-500",
};

/** Today (local) at midnight, as `yyyy-mm-dd`. */
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Derived overdue: a 'demand' whose due_date is strictly before today. */
function isOverdue(p: {
  status: string;
  due_date: string | null;
}): boolean {
  if (p.status !== "demand" || !p.due_date) return false;
  return todayKey() > p.due_date.slice(0, 10);
}

/** An "open" payment counts toward the to-collect / to-pay totals. */
function isOpenStatus(status: string): boolean {
  return status === "draft" || status === "demand";
}

// Payment terms (שוטף+N). null/0 = מיידי. "custom" is a UI-only sentinel.
const TERMS_PRESETS: { value: string; label: string }[] = [
  { value: "0", label: "מיידי" },
  { value: "30", label: "שוטף+30" },
  { value: "60", label: "שוטף+60" },
  { value: "90", label: "שוטף+90" },
  { value: "custom", label: "מותאם" },
];

function termsLabel(netDays: number | null): string {
  if (!netDays || netDays <= 0) return "מיידי";
  return `שוטף+${netDays}`;
}

/** due_date = demand_date + netDays (מיידי → demand_date). Returns yyyy-mm-dd. */
function computeDueDate(
  demandDate: string,
  netDays: number | null
): string | null {
  if (!demandDate) return null;
  const base = new Date(demandDate + "T00:00:00");
  if (Number.isNaN(base.getTime())) return null;
  const days = netDays && netDays > 0 ? netDays : 0;
  base.setDate(base.getDate() + days);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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

/** Compact DD/MM for inline hints. */
function formatDayMonth(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(dt.getTime())) return "";
  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

// ── Configurable-table column model for the payments table view ──────────────
// Mirrors the meetings table: same CSS-grid configurable table, no control
// columns, a small actions column for delete, fixed columns renamable/reorderable
// via `useEntityColumns({ entityType: "payment" })`.
type PaymentFixedKey =
  | "title"
  | "direction"
  | "contact"
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
    key: "contact",
    width: "minmax(120px, 0.7fr)",
    defaultLabel: "איש קשר",
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
  const { data: projectContacts = [] } = useProjectContacts(projectId);
  const createPayment = useCreateProjectPayment();
  const [openId, setOpenId] = useState<string | null>(null);
  const [demandsOnly, setDemandsOnly] = useState(false);

  // Map contact id → name for table/card rendering.
  const contactName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of projectContacts) m.set(c.id, c.name?.trim() || "");
    return m;
  }, [projectContacts]);

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

  // Summary: open to-collect (in) / open to-pay (out) / overdue count.
  // "Open" = draft|demand (not paid, not cancelled). Net balance = collect − pay.
  const summary = useMemo(() => {
    let toCollect = 0;
    let toPay = 0;
    let overdue = 0;
    for (const p of payments) {
      if (isOverdue(p)) overdue += 1;
      if (!isOpenStatus(p.status)) continue;
      if (p.direction === "in") toCollect += p.amount_cents ?? 0;
      else if (p.direction === "out") toPay += p.amount_cents ?? 0;
    }
    return { toCollect, toPay, overdue, balance: toCollect - toPay };
  }, [payments]);

  const summaryCurrency = payments[0]?.currency ?? "ILS";

  // Open-demands segment: only unpaid 'demand' rows when the toggle is on.
  const visiblePayments = useMemo(
    () =>
      demandsOnly ? payments.filter((p) => p.status === "demand") : payments,
    [payments, demandsOnly]
  );

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
          toCollect={summary.toCollect}
          toPay={summary.toPay}
          overdue={summary.overdue}
          balance={summary.balance}
          currency={summaryCurrency}
        />
        <div className="inline-flex items-center gap-2">
          {payments.some((p) => p.status === "demand") && (
            <label className="inline-flex items-center gap-1.5 text-xs text-ink-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={demandsOnly}
                onChange={(e) => setDemandsOnly(e.target.checked)}
                className="accent-primary-600"
              />
              רק דרישות פתוחות
            </label>
          )}
          <ColumnsMenu
            items={columnMenuItems}
            hiddenIds={hiddenIds}
            onToggle={toggleHidden}
          />
          {payments.length > 0 && (
            <ExportExcelButton
              filename="תשלומים"
              build={() =>
                buildPaymentsSheet(
                  payments,
                  customFields,
                  "תשלומים",
                  projectContacts
                )
              }
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
              {visiblePayments.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-ink-500">
                  אין דרישות פתוחות
                </div>
              ) : (
                visiblePayments.map((p) => (
                <PaymentRow
                  key={p.id}
                  payment={p}
                  projectId={projectId}
                  contactName={
                    p.contact_id ? contactName.get(p.contact_id) ?? null : null
                  }
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
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {openPayment && (
        <PaymentDetailModal
          payment={openPayment}
          projectId={projectId}
          contacts={projectContacts}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function SummaryStrip({
  toCollect,
  toPay,
  overdue,
  balance,
  currency,
}: {
  toCollect: number;
  toPay: number;
  overdue: number;
  balance: number;
  currency: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5">
        <div className="text-[10px] text-emerald-700 font-medium">
          לקבל (פתוח)
        </div>
        <div className="text-sm font-semibold text-emerald-800">
          {formatMoney(toCollect, currency)}
        </div>
      </div>
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5">
        <div className="text-[10px] text-rose-700 font-medium">לשלם (פתוח)</div>
        <div className="text-sm font-semibold text-rose-800">
          {formatMoney(toPay, currency)}
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
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-xl border px-3 py-1.5",
          overdue > 0
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-ink-200 bg-ink-50 text-ink-500"
        )}
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        <span className="text-[10px] font-medium">באיחור:</span>
        <span className="text-sm font-semibold tabular-nums">{overdue}</span>
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
  contactName,
  gridCols,
  orderedKeys,
  customFields,
  onSaveCustom,
  onOpen,
}: {
  payment: ProjectPayment;
  projectId: string;
  contactName: string | null;
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
      case "contact":
        return (
          <span className="text-xs text-ink-700 truncate">
            {contactName?.trim() || "—"}
          </span>
        );
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
      case "status": {
        if (isOverdue(payment)) {
          return (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-rose-100 text-rose-700">
              באיחור
            </span>
          );
        }
        return (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
              STATUS_CLASS[payment.status] ?? "bg-ink-100 text-ink-600"
            )}
          >
            {paymentStatusLabel(payment.status, payment.direction)}
          </span>
        );
      }
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
  contacts,
  onClose,
}: {
  payment: ProjectPayment;
  projectId: string;
  contacts: ProjectContact[];
  onClose: () => void;
}) {
  const updatePayment = useUpdateProjectPayment();
  const scope = useOrgScope();

  const [title, setTitle] = useState(payment.title);
  const [direction, setDirection] = useState(payment.direction);
  const [contactId, setContactId] = useState(payment.contact_id ?? "");

  // "צרף מסמך" flow — the payments folder id is resolved lazily on open.
  const [addOpen, setAddOpen] = useState(false);
  const [addFolderId, setAddFolderId] = useState<string | null>(null);
  const [addTargets, setAddTargets] = useState<AddDocumentTarget[]>([]);
  const [openingAdd, setOpeningAdd] = useState(false);

  const openAddDocument = async () => {
    setOpeningAdd(true);
    try {
      const { organizationId, userId } = assertOrgScope(scope);
      const folderId = await findOrCreatePaymentsFolder(
        projectId,
        organizationId,
        userId
      );
      const targets: AddDocumentTarget[] = [
        { type: "payment", id: payment.id, label: "התשלום" },
        ...(payment.contact_id
          ? [
              {
                type: "contact" as const,
                id: payment.contact_id,
                label: "איש הקשר",
              },
            ]
          : []),
      ];
      setAddFolderId(folderId);
      setAddTargets(targets);
      setAddOpen(true);
    } catch {
      alert("שגיאה בפתיחת חלון הוספת המסמך");
    } finally {
      setOpeningAdd(false);
    }
  };
  const [amount, setAmount] = useState(
    payment.amount_cents ? String(payment.amount_cents / 100) : ""
  );
  const [currency, setCurrency] = useState(payment.currency || "ILS");
  const [status, setStatus] = useState(payment.status);

  // Terms: preset select ("0"|"30"|"60"|"90"|"custom") + custom number input.
  const initialNet = payment.terms_net_days ?? 0;
  const isPreset = ["0", "30", "60", "90"].includes(String(initialNet));
  const [termsPreset, setTermsPreset] = useState(
    isPreset ? String(initialNet) : "custom"
  );
  const [customDays, setCustomDays] = useState(
    isPreset ? "" : String(initialNet)
  );
  const [demandDate, setDemandDate] = useState(payment.demand_date ?? "");
  const [paidDate, setPaidDate] = useState(payment.paid_date ?? "");
  const [notes, setNotes] = useState(payment.notes ?? "");

  // Resolve the effective net days from preset/custom.
  const netDays =
    termsPreset === "custom"
      ? Math.max(0, parseInt(customDays, 10) || 0)
      : parseInt(termsPreset, 10) || 0;

  const computedDue = computeDueDate(demandDate, netDays);

  // Contacts filtered by direction: in → customers, out → suppliers.
  const filteredContacts = useMemo(
    () =>
      contacts.filter((c) =>
        direction === "in" ? c.type === "customer" : c.type === "supplier"
      ),
    [contacts, direction]
  );

  const save = () => {
    const parsed = parseFloat(amount);
    const amountCents = Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
    // Setting status to paid fills paid_date (default today if empty).
    const nextPaidDate =
      status === "paid" ? paidDate || todayKey() : paidDate || null;
    updatePayment.mutate({
      id: payment.id,
      projectId,
      patch: {
        title: title.trim(),
        direction,
        contact_id: contactId || null,
        amount_cents: amountCents,
        currency,
        status,
        terms_net_days: netDays > 0 ? netDays : 0,
        demand_date: demandDate || null,
        due_date: computedDue,
        paid_date: nextPaidDate,
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
                onChange={(e) => {
                  setDirection(e.target.value);
                  setContactId(""); // contact list is direction-specific
                }}
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
                {STATUS_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {paymentStatusLabel(v, direction)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="eyebrow mb-1.5 block">
              {direction === "in" ? "לקוח" : "ספק"}
            </label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="field"
            >
              <option value="">— ללא —</option>
              {filteredContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name?.trim() || "ללא שם"}
                </option>
              ))}
            </select>
            {filteredContacts.length === 0 && (
              <p className="text-[11px] text-ink-400 mt-1">
                {direction === "in"
                  ? "אין לקוחות מקושרים לפרויקט"
                  : "אין ספקים מקושרים לפרויקט"}
              </p>
            )}
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
              <label className="eyebrow mb-1.5 block">תנאי תשלום</label>
              <div className="inline-flex items-center gap-2 w-full">
                <select
                  value={termsPreset}
                  onChange={(e) => setTermsPreset(e.target.value)}
                  className="field"
                >
                  {TERMS_PRESETS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {termsPreset === "custom" && (
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    placeholder="ימים"
                    className="field w-24 shrink-0"
                  />
                )}
              </div>
            </div>
            <div>
              <label className="eyebrow mb-1.5 block">תאריך דרישה</label>
              <DateField
                value={demandDate}
                onChange={setDemandDate}
                label="תאריך דרישה"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 -mt-1">
            <p className="text-[11px] text-ink-500">
              {termsLabel(netDays)}
              {computedDue ? ` · ליעד ${formatDayMonth(computedDue)}` : ""}
            </p>
          </div>

          <div>
            <label className="eyebrow mb-1.5 block">שולם בתאריך</label>
            <DateField
              value={paidDate}
              onChange={setPaidDate}
              label="שולם בתאריך"
            />
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

          <LinkedDocumentsSection
            targetType="payment"
            targetId={payment.id}
            projectId={projectId}
            onAttach={() => {
              if (!openingAdd) void openAddDocument();
            }}
          />
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

      {addOpen && (
        <AddDocumentModal
          projectId={projectId}
          defaultFolderId={addFolderId}
          targets={addTargets}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}
