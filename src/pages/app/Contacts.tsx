import { useEffect, useMemo, useState } from "react";
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
  Search,
  Check,
  FolderKanban,
} from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import {
  useOrgContacts,
  useContactProjects,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  type Contact,
  type ContactType,
} from "@/lib/hooks/useContacts";
import { cn } from "@/lib/utils/cn";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

const VIEW_KEY = "multitask.contacts.view";
type ViewMode = "table" | "cards";
type TypeFilter = "all" | "customer" | "supplier";

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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function Contacts() {
  const { data: contacts = [], isLoading } = useOrgContacts();
  const createContact = useCreateContact();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "table";
    const stored = localStorage.getItem(VIEW_KEY);
    return stored === "cards" || stored === "table" ? stored : "table";
  });
  // On phones the 820px-wide table forces horizontal scrolling, so default to
  // the card view when the user hasn't explicitly chosen one yet.
  useEffect(() => {
    if (isMobile && !localStorage.getItem(VIEW_KEY)) setView("cards");
  }, [isMobile]);
  const setViewPersist = (v: ViewMode) => {
    setView(v);
    if (typeof window !== "undefined") localStorage.setItem(VIEW_KEY, v);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (!q) return true;
      return [c.name, c.company, c.phone, c.email]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [contacts, search, typeFilter]);

  const editContact = useMemo(
    () => contacts.find((c) => c.id === editId) ?? null,
    [contacts, editId]
  );

  const handleCreate = async () => {
    setCreating(true);
    try {
      const c = await createContact.mutateAsync({ type: "customer" });
      setEditId(c.id);
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScreenScaffold
      title="אנשי קשר"
      subtitle="ניהול כל הלקוחות והספקים של הארגון — פרטי התקשרות, שיוך לפרויקטים ושיתוף."
      actions={
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          איש קשר חדש
        </button>
      }
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[12rem] max-w-sm">
          <Search className="absolute top-1/2 -translate-y-1/2 start-2.5 w-4 h-4 text-ink-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, חברה, טלפון או אימייל…"
            className="field ps-9"
          />
        </div>

        {/* Type filter */}
        <div className="inline-flex rounded-lg border border-ink-200 overflow-hidden text-sm">
          {(
            [
              { id: "all", label: "הכל" },
              { id: "customer", label: "לקוחות" },
              { id: "supplier", label: "ספקים" },
            ] as { id: TypeFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id)}
              className={cn(
                "px-3 py-1.5 transition-colors border-e border-ink-200 last:border-e-0",
                typeFilter === tab.id
                  ? "bg-primary-600 text-white"
                  : "bg-white text-ink-600 hover:bg-ink-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <ViewToggle view={view} onChange={setViewPersist} />
      </div>

      {isLoading ? (
        <div className="card p-10 text-center text-ink-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          טוען אנשי קשר…
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState onCreate={handleCreate} />
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-ink-500 text-sm">
          לא נמצאו אנשי קשר התואמים לחיפוש.
        </div>
      ) : view === "table" ? (
        <ContactsTable contacts={filtered} onOpen={setEditId} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <ContactCard key={c.id} contact={c} onOpen={() => setEditId(c.id)} />
          ))}
        </div>
      )}

      {editContact && (
        <ContactEditModal
          contact={editContact}
          onClose={() => setEditId(null)}
        />
      )}
    </ScreenScaffold>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card p-8 text-center">
      <Users className="w-9 h-9 text-ink-300 mx-auto mb-2" />
      <h3 className="text-base font-semibold text-ink-900 mb-1">
        עוד אין אנשי קשר בארגון
      </h3>
      <p className="text-xs text-ink-500 mb-4 max-w-sm mx-auto">
        נהלי כאן את כל הלקוחות והספקים של הארגון — פרטי התקשרות, שיוך לפרויקטים
        ושיתוף עם חברי הארגון.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="btn-primary mx-auto inline-flex items-center gap-1.5"
      >
        <Plus className="w-4 h-4" />
        איש קשר ראשון
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table view
// ---------------------------------------------------------------------------

const TABLE_COLS =
  "minmax(150px,1.2fr) 70px minmax(120px,0.8fr) 130px minmax(150px,0.9fr) 110px 90px";

function ContactsTable({
  contacts,
  onOpen,
}: {
  contacts: Contact[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: 820 }}>
          {/* Header */}
          <div
            className="grid items-center gap-2 px-3 py-2 border-b border-ink-200 bg-ink-50 text-[11px] font-semibold text-ink-500 uppercase tracking-wide"
            style={{ gridTemplateColumns: TABLE_COLS }}
          >
            <span>שם</span>
            <span>סוג</span>
            <span>חברה</span>
            <span>טלפון</span>
            <span>אימייל</span>
            <span>ח.פ / ע.מ</span>
            <span className="text-center">משותף</span>
          </div>
          {/* Rows */}
          {contacts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpen(c.id)}
              className="grid items-center gap-2 px-3 py-2.5 border-b border-ink-100 hover:bg-ink-50 text-start w-full"
              style={{ gridTemplateColumns: TABLE_COLS }}
            >
              <span className="min-w-0 truncate font-medium text-ink-900">
                {c.name.trim() || "איש קשר ללא שם"}
              </span>
              <span className="min-w-0">
                <TypeChip type={c.type} />
              </span>
              <span className="min-w-0 truncate text-xs text-ink-600">
                {c.company?.trim() || "—"}
              </span>
              <span className="min-w-0 truncate text-xs text-ink-700" dir="ltr">
                {c.phone?.trim() || "—"}
              </span>
              <span
                className="min-w-0 truncate text-xs text-primary-700"
                dir="ltr"
              >
                {c.email?.trim() || "—"}
              </span>
              <span className="min-w-0 truncate text-xs text-ink-600" dir="ltr">
                {c.tax_id?.trim() || "—"}
              </span>
              <span className="flex items-center justify-center">
                {c.shared_with_org ? (
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-success-100 text-success-700"
                    title="משותף עם הארגון"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </span>
                ) : (
                  <span className="text-ink-300 text-xs">—</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card view
// ---------------------------------------------------------------------------

function ContactCard({
  contact,
  onOpen,
}: {
  contact: Contact;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card p-4 text-start hover:shadow-lift transition-shadow flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-ink-900 leading-snug min-w-0 truncate">
          {contact.name.trim() || "איש קשר ללא שם"}
        </h4>
        <span className="shrink-0">
          <TypeChip type={contact.type} />
        </span>
      </div>
      {contact.company?.trim() && (
        <div className="text-xs text-ink-500 inline-flex items-center gap-1">
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{contact.company}</span>
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
      {contact.shared_with_org && (
        <span className="inline-flex items-center gap-1 text-[11px] text-success-700 bg-success-50 border border-success-200 rounded-full px-2 py-0.5 self-start">
          <Users className="w-3 h-3" />
          משותף עם הארגון
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Edit modal
// ---------------------------------------------------------------------------

function ContactEditModal({
  contact,
  onClose,
}: {
  contact: Contact;
  onClose: () => void;
}) {
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const { data: linkedProjects = [] } = useContactProjects(contact.id);

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
      dir="rtl"
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
            כשמסומן, כל חברי הארגון יכולים לראות את איש הקשר. איש קשר המשויך
            לפרויקט משותף משותף אוטומטית.
          </p>

          {linkedProjects.length > 0 && (
            <div>
              <label className="eyebrow mb-1.5 block">משויך לפרויקטים</label>
              <div className="flex flex-wrap gap-1.5">
                {linkedProjects.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 text-[11px] text-ink-700 bg-ink-50 border border-ink-200 rounded-full px-2 py-0.5"
                  >
                    <FolderKanban className="w-3 h-3" />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-ink-50 border-t border-ink-200 flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => {
              if (
                confirm("למחוק את איש הקשר לצמיתות? פעולה זו לא ניתנת לביטול.")
              ) {
                deleteContact.mutate({ id: contact.id });
                onClose();
              }
            }}
            className="btn-ghost text-sm text-danger-600 inline-flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            מחק איש קשר
          </button>
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

// ---------------------------------------------------------------------------
// View toggle
// ---------------------------------------------------------------------------

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
