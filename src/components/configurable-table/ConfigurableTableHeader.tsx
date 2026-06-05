import { useState, useEffect } from "react";
import {
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Settings2,
} from "lucide-react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil } from "lucide-react";
import type { CustomFieldType } from "@/lib/types/domain";
import type { FixedColumnDescriptor } from "./gridLayout";
import { COLUMN_TYPES, type EntityCustomField } from "./fieldCells";

// ─── Table header ───────────────────────────────────────────────────────────

export function TableHeader<TKey extends string>({
  gridCols,
  customFields,
  fixedLabels,
  orderedDescriptors,
  sortKey,
  sortDir,
  onSort,
  onRenameFixed,
  onReorderFixed,
  onAddField,
  onDeleteField,
  onRenameField,
  onReorderFields,
  onEditFieldOptions,
  controlSpacerCount = 3,
}: {
  controlSpacerCount?: number;
  gridCols: string;
  customFields: EntityCustomField[];
  fixedLabels: Record<string, string>;
  orderedDescriptors: FixedColumnDescriptor<TKey>[];
  sortKey: string | null;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
  onRenameFixed: (key: string, label: string) => void;
  onReorderFixed: (newOrder: TKey[]) => void;
  onAddField: (type: CustomFieldType, label: string) => void;
  onDeleteField: (fieldId: string) => void;
  onRenameField: (fieldId: string, label: string) => void;
  onReorderFields: (newOrder: EntityCustomField[]) => void;
  onEditFieldOptions: (fieldId: string) => void;
}) {
  const colDragSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      // Touch: long-press 250ms (with up-to-5px wobble) before drag begins,
      // otherwise scroll/tap conflict with drag activation on mobile.
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );
  const handleColumnDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const fromIdx = customFields.findIndex((f) => f.id === active.id);
    const toIdx = customFields.findIndex((f) => f.id === over.id);
    if (fromIdx === -1 || toIdx === -1) return;
    onReorderFields(arrayMove(customFields, fromIdx, toIdx));
  };
  const dynIds = customFields.map((f) => f.id);
  const orderedFixedKeys = orderedDescriptors.map((d) => d.key);
  const arrow = (key: string, align: "start" | "end" | "center") => {
    if (sortKey !== key) return null;
    const cls =
      "w-2.5 h-2.5 inline-block " +
      (align === "end"
        ? "ms-0.5"
        : align === "center"
        ? "mx-0.5"
        : "me-0.5");
    return sortDir === "asc" ? (
      <ArrowUp className={cls} />
    ) : (
      <ArrowDown className={cls} />
    );
  };
  const handleFixedDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const fromIdx = orderedFixedKeys.indexOf(active.id as TKey);
    const toIdx = orderedFixedKeys.indexOf(over.id as TKey);
    if (fromIdx === -1 || toIdx === -1) return;
    onReorderFixed(arrayMove(orderedFixedKeys, fromIdx, toIdx));
  };
  return (
    <div
      className="grid items-center gap-1 px-1.5 py-1.5 sticky top-0 bg-ink-50/80 backdrop-blur z-10 text-[10px] font-semibold uppercase tracking-wider text-ink-500 border-b border-ink-200"
      style={{ gridTemplateColumns: gridCols }}
    >
      {Array.from({ length: controlSpacerCount }).map((_, i) => (
        <span key={`ctrl-${i}`} />
      ))}
      <DndContext
        sensors={colDragSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleFixedDragEnd}
      >
        <SortableContext
          items={orderedFixedKeys}
          strategy={horizontalListSortingStrategy}
        >
          {orderedDescriptors.map((desc) => {
            const key = desc.key;
            const align = desc.align;
            const defaultLabel = desc.defaultLabel;
            const label = fixedLabels[key] ?? defaultLabel;
            const sortable = desc.sortable;
            const sortKeyOf = desc.sortKey;
            return (
              <SortableFixedHeader
                key={key}
                colKey={key}
                label={label}
                defaultLabel={defaultLabel}
                align={align}
                sortable={sortable}
                sortArrow={
                  sortKeyOf && sortKey === sortKeyOf ? arrow(sortKeyOf, align) : null
                }
                onSort={
                  sortable && sortKeyOf ? () => onSort(sortKeyOf) : undefined
                }
                onRename={(v) => onRenameFixed(key, v)}
              />
            );
          })}
        </SortableContext>
      </DndContext>
      <DndContext
        sensors={colDragSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleColumnDragEnd}
      >
        <SortableContext items={dynIds} strategy={horizontalListSortingStrategy}>
          {customFields.map((f) => (
            <DynColumnHeader
              key={f.id}
              field={f}
              sortActive={sortKey === `cf:${f.field_key}`}
              sortDir={sortDir}
              onSort={() => onSort(`cf:${f.field_key}`)}
              onRename={(label) => onRenameField(f.id, label)}
              onDelete={() => onDeleteField(f.id)}
              onEditOptions={() => onEditFieldOptions(f.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <AddColumnButton onAdd={onAddField} />
    </div>
  );
}

/**
 * Wraps `FixedColumnHeader` with @dnd-kit/useSortable so the user can drag the
 * column to reorder it. Drag is disabled while editing the column label so
 * the input doesn't compete with drag gestures.
 */
function SortableFixedHeader<TKey extends string>({
  colKey,
  label,
  defaultLabel,
  align,
  sortable,
  sortArrow,
  onSort,
  onRename,
}: {
  colKey: TKey;
  label: string;
  defaultLabel: string;
  align: "start" | "end" | "center";
  sortable: boolean;
  sortArrow: React.ReactNode;
  onSort?: () => void;
  onRename: (label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const sortableHandle = useSortable({ id: colKey, disabled: editing });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortableHandle.transform),
    transition: sortableHandle.transition,
    opacity: sortableHandle.isDragging ? 0.4 : 1,
  };
  return (
    <span
      ref={sortableHandle.setNodeRef}
      style={style}
      {...sortableHandle.attributes}
      {...sortableHandle.listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <FixedColumnHeader
        label={label}
        defaultLabel={defaultLabel}
        align={align}
        sortable={sortable}
        sortArrow={sortArrow}
        editing={editing}
        onStartEdit={() => setEditing(true)}
        onStopEdit={() => setEditing(false)}
        onSort={onSort}
        onRename={onRename}
      />
    </span>
  );
}

/**
 * Fixed-column header: sortable on click (when `sortable=true`), renamable
 * on double-click. The user-supplied label persists on the project so the
 * project's vocabulary survives reloads.
 */
function FixedColumnHeader({
  label,
  defaultLabel,
  align,
  sortable,
  sortArrow,
  editing,
  onStartEdit,
  onStopEdit,
  onSort,
  onRename,
}: {
  label: string;
  defaultLabel: string;
  align: "start" | "end" | "center";
  sortable: boolean;
  sortArrow: React.ReactNode;
  editing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onSort?: () => void;
  onRename: (label: string) => void;
}) {
  const [draft, setDraft] = useState(label);
  useEffect(() => setDraft(label), [label]);

  const commit = () => {
    const v = draft.trim();
    onStopEdit();
    if (!v) {
      // Reverting to default = clearing the override.
      if (label !== defaultLabel) onRename("");
      else setDraft(label);
      return;
    }
    if (v !== label) onRename(v === defaultLabel ? "" : v);
  };

  const alignCls =
    align === "end" ? "text-end" : align === "center" ? "text-center" : "text-start";

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(label);
            onStopEdit();
          }
        }}
        placeholder={defaultLabel}
        className={
          "w-full bg-white border border-primary-500 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-700 outline-none " +
          alignCls
        }
      />
    );
  }

  const renamePencil = (
    <button
      type="button"
      onClick={onStartEdit}
      onPointerDown={(e) => e.stopPropagation()}
      className="opacity-0 group-hover/fixed:opacity-100 text-ink-400 hover:text-primary-600 transition-opacity ms-0.5"
      aria-label="שני שם"
      title="שני שם עמודה"
    >
      <Pencil className="w-2.5 h-2.5 inline-block" />
    </button>
  );

  if (sortable && onSort) {
    return (
      <span className="group/fixed inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={onSort}
          onDoubleClick={onStartEdit}
          className={
            "select-none hover:text-ink-900 transition-colors " + alignCls
          }
          title={`${label} — קליק למיון, דאבל-קליק או ✏️ לשינוי שם, גרירה לסידור`}
        >
          {label}
          {sortArrow}
        </button>
        {renamePencil}
      </span>
    );
  }

  return (
    <span
      onDoubleClick={onStartEdit}
      className={
        "group/fixed inline-flex items-center gap-0.5 select-none cursor-text " +
        alignCls
      }
      title="דאבל-קליק או ✏️ לשינוי שם · גרירה לסידור"
    >
      {label}
      {renamePencil}
    </span>
  );
}

function DynColumnHeader({
  field,
  sortActive,
  sortDir,
  onSort,
  onRename,
  onDelete,
  onEditOptions,
}: {
  field: EntityCustomField;
  sortActive: boolean;
  sortDir: "asc" | "desc";
  onSort: () => void;
  onRename: (label: string) => void;
  onDelete: () => void;
  onEditOptions: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.field_label);
  useEffect(() => setDraft(field.field_label), [field.field_label]);
  const supportsOptions = field.field_type === "select" || field.field_type === "multiselect";

  const sortable = useSortable({ id: field.id, disabled: editing });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  };

  const commit = () => {
    const v = draft.trim();
    setEditing(false);
    if (v && v !== field.field_label) onRename(v);
    else setDraft(field.field_label);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(field.field_label);
            setEditing(false);
          }
        }}
        className="w-full bg-white border border-primary-500 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-700 outline-none"
      />
    );
  }

  return (
    <span
      ref={sortable.setNodeRef}
      style={style}
      {...sortable.attributes}
      {...sortable.listeners}
      className="group/dyn flex items-center justify-between gap-1 px-1 truncate cursor-grab active:cursor-grabbing"
    >
      <button
        type="button"
        onClick={onSort}
        onDoubleClick={() => setEditing(true)}
        className="truncate hover:text-ink-900 transition-colors flex-1 text-start"
        title={`${field.field_label} — קליק למיון, דאבל-קליק לשינוי שם, גרירה לסידור מחדש`}
      >
        {field.field_label}
        {sortActive &&
          (sortDir === "asc" ? (
            <ArrowUp className="w-2.5 h-2.5 inline-block ms-0.5" />
          ) : (
            <ArrowDown className="w-2.5 h-2.5 inline-block ms-0.5" />
          ))}
      </button>
      <button
        type="button"
        onClick={() => setEditing(true)}
        onPointerDown={(e) => e.stopPropagation()}
        className="opacity-0 group-hover/dyn:opacity-100 text-ink-400 hover:text-primary-600 transition-opacity"
        aria-label="שני שם"
        title="שני שם עמודה"
      >
        <Pencil className="w-2.5 h-2.5" />
      </button>
      {supportsOptions && (
        <button
          type="button"
          onClick={onEditOptions}
          onPointerDown={(e) => e.stopPropagation()}
          className="opacity-0 group-hover/dyn:opacity-100 text-ink-400 hover:text-primary-600 transition-opacity"
          aria-label="ערכי אפשרויות"
          title="ערכי אפשרויות"
        >
          <Settings2 className="w-2.5 h-2.5" />
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          if (confirm(`למחוק את עמודת "${field.field_label}"?`)) onDelete();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="opacity-0 group-hover/dyn:opacity-100 text-ink-400 hover:text-danger transition-opacity"
        aria-label="מחקי עמודה"
        title="מחקי עמודה"
      >
        <Trash2 className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}

function AddColumnButton({
  onAdd,
}: {
  onAdd: (type: CustomFieldType, label: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const pick = (type: CustomFieldType, defaultLabel: string) => {
    onAdd(type, defaultLabel);
    setOpen(false);
  };

  return (
    <div className="relative flex justify-end">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-ink-400 hover:text-primary-600 p-1 rounded hover:bg-primary-50"
        title="הוסיפי עמודה"
        aria-label="הוסיפי עמודה"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
          />
          <div className="absolute end-0 top-full mt-1 z-30 bg-white border border-ink-200 rounded-xl shadow-lift p-3 w-72 normal-case font-normal tracking-normal text-ink-900">
            <h4 className="text-xs font-semibold text-ink-900 mb-2">
              בחרי סוג עמודה
            </h4>
            <div className="grid grid-cols-3 gap-1.5">
              {COLUMN_TYPES.map(({ type, label, icon: Icon }) => (
                <button
                  key={type + label}
                  type="button"
                  onClick={() => pick(type, label)}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-md border border-ink-200 hover:border-primary-400 hover:bg-primary-50 transition-colors text-ink-700 hover:text-primary-700"
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] font-medium leading-tight text-center">
                    {label}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-ink-400 mt-2 leading-snug">
              דאבל-קליק על שם העמודה לאחר היצירה לשינוי שם.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
