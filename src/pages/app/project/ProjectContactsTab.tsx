import { useMemo, useState } from "react";
import {
  Plus,
  Loader2,
  Users,
  Trash2,
  X,
  Table2,
  LayoutGrid,
  Phone,
  Mail,
  Building2,
  Link2,
} from "lucide-react";
import { useProjectContext } from "@/pages/app/ProjectShell";
import {
  useProjectContacts,
  useOrgContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useLinkContact,
  useUnlinkContact,
  type ProjectContact,
  type ContactType,
} from "@/lib/hooks/useContacts";
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
import { buildContactsSheet } from "@/lib/export/projectSheets";
import {
  DynCell,
  OptionsEditorModal,
  readCustomField,
  writeCustomField,
  type SelectOption,
} from "@/components/configurable-table/fieldCells";
import type { CustomFieldType, TaskCustomField } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

const VIEW_KEY = "multitask.projectContacts.view";
type ViewMode = "table" | "cards";

const TYPE_OPTIONS: { value: ContactType; label: string }[] = [
  { value: "customer", label: "לקוח" },
  { value: "supplier", label: "ספק" },
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TYPE_OPTIONS.map((o) => [o.value, o.label])
);

function TypeChip({ type }: { type: string }) {
  const isSupplier = type === "supplier";
  return (
    <span
      className={cn(
        "chip text-[10px]",
        isSupplier
          ? "bg-amber-100 text-amber-700"
          : "bg-primary-100 text-primary-700"
      )}
    >
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}

// ── Configurable-table column model for the contacts table view ──────────────
type ContactFixedKey = "name" | "type" | "company" | "phone" | "email" | "tax_id";

const CONTACT_FIXED_DESCRIPTORS: FixedColumnDescriptor<ContactFixedKey>[] = [
  {
    key: "name",
    width: "minmax(160px, 1fr)",
    defaultLabel: "שם",
    align: "start",
    sortable: false,
    sortKey: null,
  },
  {
    key: "type",
    width: "80px",
    defaultLabel: "סוג",
    align: "start",
    sortable: false,
    sortKey: null,
  },
  {
    key: "company",
    width: "minmax(120px, 0.6fr)",
    defaultLabel: "חברה",
    align: "start",
    sortable: false,
    sortKey: null,
  },
  {
    key: "phone",
    width: "120px",
    defaultLabel: "טלפון",
    align: "start",
    sortable: false,
    sortKey: null,
  },
  {
    key: "email",
    width: "minmax(140px, 0.6fr)",
    defaultLabel: "אימייל",
    align: "start",
    sortable: false,
    sortKey: null,
  },
  {
    key: "tax_id",
    width: "110px",
    defaultLabel: "ח.פ / ע.מ",
    align: "start",
    sortable: false,
    sortKey: null,
  },
];

const CONTACT_FIXED_WIDTHS = Object.fromEntries(
  CONTACT_FIXED_DESCRIPTORS.map((d) => [d.key, d.width])
) as Record<ContactFixedKey, string>;

const CONTACT_CONTROL_COLS = "";
const CONTACT_ACTIONS_COL = "40px";
const CONTACT_DYN_COL_WIDTH = 160;
const CONTACT_CONTROL_AND_ACTIONS_WIDTH = 40;

export function ProjectContactsTab() {
  const { projectId } = useProjectContext();
  const { data: contacts = [], isLoading } = useProjectContacts(projectId);
  const createContact = useCreateContact();
  const linkContact = useLinkContact();
  const updateContact = useUpdateContact();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Configurable custom columns (contact entity).
  const { data: customFields = [] } = useProjectCustomFields(
    projectId,
    "contact"
  );
  const createField = useCreateCustomField();
  const updateField = useUpdateCustomField();
  const deleteField = useDeleteCustomField();
  const { fixedLabels, orderedKeys, renameFixed, reorderFixed } =
    useEntityColumns<ContactFixedKey>({
      entityType: "contact",
      projectId,
      descriptors: CONTACT_FIXED_DESCRIPTORS,
    });
  const { hiddenIds, toggleHidden } = useEntityColumnVisibility({
    entityType: "contact",
    projectId,
  });
  const [optionsFieldId, setOptionsFieldId] = useState<string | null>(null);
  const optionsField = useMemo(
    () => customFields.find((f) => f.id === optionsFieldId) ?? null,
    [customFields, optionsFieldId]
  );

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
          CONTACT_FIXED_DESCRIPTORS.find((d) => d.key === k)?.defaultLabel ??
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
      visibleKeys.map(
        (k) => CONTACT_FIXED_DESCRIPTORS.find((d) => d.key === k)!
      ),
    [visibleKeys]
  );

  const gridCols = useMemo(
    () =>
      buildGridCols(visibleKeys, visibleFields.length, CONTACT_FIXED_WIDTHS, {
        controlCols: CONTACT_CONTROL_COLS,
        actionsCol: CONTACT_ACTIONS_COL,
        dynColWidth: CONTACT_DYN_COL_WIDTH,
      }),
    [visibleKeys, visibleFields.length]
  );
  const gridMinWidth = useMemo(
    () =>
      buildGridMinWidth(
        visibleKeys,
        visibleFields.length,
        CONTACT_FIXED_WIDTHS,
        {
          controlAndActionsWidth: CONTACT_CONTROL_AND_ACTIONS_WIDTH,
          dynColWidth: CONTACT_DYN_COL_WIDTH,
        }
      ),
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
      entity_type: "contact",
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

  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "table";
    return localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "table";
  });
  const setViewPersist = (v: ViewMode) => {
    setView(v);
    if (typeof window !== "undefined") localStorage.setItem(VIEW_KEY, v);
  };

  const openContact = contacts.find((c) => c.id === openId) ?? null;

  const handleCreate = async () => {
    setCreating(true);
    try {
      const c = await createContact.mutateAsync({ type: "customer" });
      await linkContact.mutateAsync({ projectId, contactId: c.id });
      setOpenId(c.id);
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card p-10 text-center text-ink-500 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
        טוען אנשי קשר…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <ViewToggle view={view} onChange={setViewPersist} />
        <div className="inline-flex items-center gap-2 flex-wrap">
          {view === "table" && (
            <ColumnsMenu
              items={columnMenuItems}
              hiddenIds={hiddenIds}
              onToggle={toggleHidden}
            />
          )}
          {contacts.length > 0 && (
            <ExportExcelButton
              filename="אנשי קשר"
              build={() => buildContactsSheet(contacts, customFields)}
            />
          )}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="btn-ghost text-sm inline-flex items-center gap-1.5"
          >
            <Link2 className="w-4 h-4" />
            קשר קיים
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="btn-accent text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            איש קשר חדש
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

      {contacts.length === 0 ? (
        <EmptyState onCreate={handleCreate} />
      ) : view === "table" ? (
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
              {contacts.map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  projectId={projectId}
                  gridCols={gridCols}
                  orderedKeys={visibleKeys}
                  customFields={visibleFields}
                  onSaveCustom={(field, value) =>
                    updateContact.mutate({
                      id: c.id,
                      projectId,
                      patch: {
                        custom_fields: writeCustomField(
                          c,
                          field.field_key,
                          value
                        ),
                      },
                    })
                  }
                  onOpen={() => setOpenId(c.id)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {contacts.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              onOpen={() => setOpenId(c.id)}
            />
          ))}
        </div>
      )}

      {pickerOpen && (
        <ExistingContactPicker
          projectId={projectId}
          linkedIds={new Set(contacts.map((c) => c.id))}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {openContact && (
        <ContactDetailModal
          contact={openContact}
          projectId={projectId}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card p-8 text-center">
      <Users className="w-9 h-9 text-ink-300 mx-auto mb-2" />
      <h3 className="text-base font-semibold text-ink-900 mb-1">
        עוד אין אנשי קשר
      </h3>
      <p className="text-xs text-ink-500 mb-4 max-w-sm mx-auto">
        נהלי כאן את הלקוחות והספקים של הפרויקט — שם, חברה, פרטי התקשרות והערות.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="btn-accent text-sm inline-flex items-center gap-1.5"
      >
        <Plus className="w-4 h-4" />
        איש קשר ראשון
      </button>
    </div>
  );
}

function ContactRow({
  contact,
  projectId,
  gridCols,
  orderedKeys,
  customFields,
  onSaveCustom,
  onOpen,
}: {
  contact: ProjectContact;
  projectId: string;
  gridCols: string;
  orderedKeys: ContactFixedKey[];
  customFields: TaskCustomField[];
  onSaveCustom: (field: TaskCustomField, value: unknown) => void;
  onOpen: () => void;
}) {
  const unlink = useUnlinkContact();

  const renderFixed = (key: ContactFixedKey) => {
    switch (key) {
      case "name":
        return (
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 truncate text-start font-medium text-ink-900 hover:text-primary-700"
          >
            {contact.name.trim() || "איש קשר ללא שם"}
          </button>
        );
      case "type":
        return <TypeChip type={contact.type} />;
      case "company":
        return (
          <span className="text-xs text-ink-600 truncate">
            {contact.company?.trim() || "—"}
          </span>
        );
      case "phone":
        return contact.phone?.trim() ? (
          <a
            href={`tel:${contact.phone}`}
            className="text-xs text-ink-700 hover:text-primary-700 truncate"
            dir="ltr"
          >
            {contact.phone}
          </a>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        );
      case "email":
        return contact.email?.trim() ? (
          <a
            href={`mailto:${contact.email}`}
            className="text-xs text-primary-700 hover:underline truncate"
            dir="ltr"
          >
            {contact.email}
          </a>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        );
      case "tax_id":
        return (
          <span className="text-xs text-ink-600 truncate" dir="ltr">
            {contact.tax_id?.trim() || "—"}
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
            value={readCustomField(contact, f.field_key)}
            onSave={(v) => onSaveCustom(f, v)}
          />
        </div>
      ))}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => {
            if (confirm("להסיר את איש הקשר מהפרויקט? (איש הקשר עצמו יישאר בארגון)"))
              unlink.mutate({ projectId, contactId: contact.id });
          }}
          className="p-1 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger/10"
          aria-label="הסר מהפרויקט"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ContactCard({
  contact,
  onOpen,
}: {
  contact: ProjectContact;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card p-4 text-start hover:shadow-lift transition-shadow flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-ink-900 leading-snug">
          {contact.name.trim() || "איש קשר ללא שם"}
        </h4>
        <span className="shrink-0">
          <TypeChip type={contact.type} />
        </span>
      </div>
      {contact.company?.trim() && (
        <div className="text-xs text-ink-500 inline-flex items-center gap-1">
          <Building2 className="w-3.5 h-3.5" />
          {contact.company}
        </div>
      )}
      <div className="flex flex-col gap-1 text-xs text-ink-600 mt-auto pt-1">
        {contact.phone?.trim() && (
          <span className="inline-flex items-center gap-1" dir="ltr">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            {contact.phone}
          </span>
        )}
        {contact.email?.trim() && (
          <span
            className="inline-flex items-center gap-1 text-primary-700 truncate"
            dir="ltr"
          >
            <Mail className="w-3.5 h-3.5 shrink-0" />
            {contact.email}
          </span>
        )}
      </div>
    </button>
  );
}

function ExistingContactPicker({
  projectId,
  linkedIds,
  onClose,
}: {
  projectId: string;
  linkedIds: Set<string>;
  onClose: () => void;
}) {
  const { data: orgContacts = [], isLoading } = useOrgContacts();
  const link = useLinkContact();
  const available = useMemo(
    () => orgContacts.filter((c) => !linkedIds.has(c.id)),
    [orgContacts, linkedIds]
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-lift w-full max-w-md my-8 flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-ink-900">קישור איש קשר קיים</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100">
            <X className="w-4 h-4 text-ink-600" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="py-8 text-center text-ink-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              טוען…
            </div>
          ) : available.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-500">
              אין אנשי קשר נוספים בארגון לקישור.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {available.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      link.mutate({ projectId, contactId: c.id });
                      onClose();
                    }}
                    className="w-full text-start px-3 py-2 rounded-lg border border-ink-200 hover:bg-ink-50 flex items-center justify-between gap-2"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-ink-900 truncate">
                        {c.name.trim() || "איש קשר ללא שם"}
                      </span>
                      {c.company?.trim() && (
                        <span className="block text-xs text-ink-500 truncate">
                          {c.company}
                        </span>
                      )}
                    </span>
                    <TypeChip type={c.type} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactDetailModal({
  contact,
  projectId,
  onClose,
}: {
  contact: ProjectContact;
  projectId: string;
  onClose: () => void;
}) {
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const unlink = useUnlinkContact();

  const [name, setName] = useState(contact.name);
  const [type, setType] = useState<ContactType>(contact.type);
  const [company, setCompany] = useState(contact.company ?? "");
  const [taxId, setTaxId] = useState(contact.tax_id ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [address, setAddress] = useState(contact.address ?? "");
  const [notes, setNotes] = useState(contact.notes ?? "");
  const [sharedWithOrg, setSharedWithOrg] = useState(contact.shared_with_org);

  const save = () => {
    updateContact.mutate({
      id: contact.id,
      projectId,
      patch: {
        name: name.trim(),
        type,
        company: company.trim() || null,
        tax_id: taxId.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        shared_with_org: sharedWithOrg,
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
        className="bg-white rounded-3xl shadow-lift w-full max-w-2xl my-8 flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-ink-900">פרטי איש קשר</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100">
            <X className="w-4 h-4 text-ink-600" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="eyebrow mb-1.5 block">שם</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="למשל: ישראל ישראלי"
                className="field"
              />
            </div>
            <div>
              <label className="eyebrow mb-1.5 block">סוג</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ContactType)}
                className="field"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="eyebrow mb-1.5 block">חברה</label>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="שם חברה…"
                className="field"
              />
            </div>
            <div>
              <label className="eyebrow mb-1.5 block">ח.פ / ע.מ</label>
              <input
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="מספר עוסק / ח.פ"
                className="field"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="eyebrow mb-1.5 block">אימייל</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="field"
                dir="ltr"
              />
            </div>
            <div>
              <label className="eyebrow mb-1.5 block">טלפון</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-0000000"
                className="field"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="eyebrow mb-1.5 block">כתובת</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="רחוב, עיר…"
              className="field"
            />
          </div>

          <div>
            <label className="eyebrow mb-1.5 block">הערות</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="הערות על איש הקשר…"
              className="field resize-y"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-700 select-none">
            <input
              type="checkbox"
              checked={sharedWithOrg}
              onChange={(e) => setSharedWithOrg(e.target.checked)}
              className="rounded"
            />
            משותף עם הארגון
          </label>
          <p className="text-[11px] text-ink-400 -mt-2">
            כשמסומן, כל חברי הארגון יכולים לראות את איש הקשר.
          </p>
        </div>

        <div className="px-5 py-3 bg-ink-50 border-t border-ink-200 flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (confirm("להסיר את איש הקשר מהפרויקט? (הוא יישאר בארגון)")) {
                  unlink.mutate({ projectId, contactId: contact.id });
                  onClose();
                }
              }}
              className="btn-ghost text-sm text-ink-600"
            >
              הסר מהפרויקט
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("למחוק את איש הקשר לצמיתות? פעולה זו לא ניתנת לביטול.")) {
                  deleteContact.mutate({ id: contact.id, projectId });
                  onClose();
                }
              }}
              className="btn-ghost text-sm text-danger-600 inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              מחק איש קשר
            </button>
          </div>
          <div className="inline-flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost text-sm">
              ביטול
            </button>
            <button
              onClick={save}
              disabled={updateContact.isPending}
              className={cn(
                "btn-accent text-sm",
                updateContact.isPending && "opacity-50"
              )}
            >
              {updateContact.isPending ? "שומר…" : "שמירה"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-ink-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("table")}
        className={cn(
          "px-2.5 py-1.5 text-xs inline-flex items-center gap-1",
          view === "table"
            ? "bg-ink-900 text-white"
            : "text-ink-600 hover:bg-ink-50"
        )}
      >
        <Table2 className="w-3.5 h-3.5" />
        טבלה
      </button>
      <button
        type="button"
        onClick={() => onChange("cards")}
        className={cn(
          "px-2.5 py-1.5 text-xs inline-flex items-center gap-1",
          view === "cards"
            ? "bg-ink-900 text-white"
            : "text-ink-600 hover:bg-ink-50"
        )}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        כרטיסיות
      </button>
    </div>
  );
}
