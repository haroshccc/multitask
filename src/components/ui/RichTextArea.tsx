import { useEffect, useRef, useState, useCallback } from "react";
import { Bold, Italic, Underline, Palette } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface RichTextAreaProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const COLORS = [
  { label: "ברירת מחדל", value: "" },
  { label: "אדום", value: "#dc2626" },
  { label: "כתום", value: "#ea580c" },
  { label: "ירוק", value: "#16a34a" },
  { label: "כחול", value: "#2563eb" },
  { label: "סגול", value: "#9333ea" },
  { label: "אפור", value: "#6b7280" },
];

function execCmd(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

export function RichTextArea({
  value,
  onChange,
  placeholder = "",
  className,
  minHeight = "80px",
}: RichTextAreaProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<{ x: number; y: number } | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const savedRange = useRef<Range | null>(null);

  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current && editorRef.current) {
      editorRef.current.innerHTML = value;
      initialized.current = true;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (value === "" && editorRef.current && editorRef.current.innerHTML !== "") {
      editorRef.current.innerHTML = "";
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const saveRange = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreRange = useCallback(() => {
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  }, []);

  const updateToolbar = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.toString().trim() === "") {
      setToolbar(null);
      setColorOpen(false);
      return;
    }
    if (!editorRef.current?.contains(sel.anchorNode)) {
      setToolbar(null);
      setColorOpen(false);
      return;
    }
    saveRange();
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current!.getBoundingClientRect();
    setToolbar({
      x: rect.left - editorRect.left + rect.width / 2,
      y: rect.top - editorRect.top - 8,
    });
  }, [saveRange]);

  useEffect(() => {
    document.addEventListener("selectionchange", updateToolbar);
    return () => document.removeEventListener("selectionchange", updateToolbar);
  }, [updateToolbar]);

  const applyFormat = useCallback(
    (cmd: string, value?: string) => {
      restoreRange();
      execCmd(cmd, value);
      handleInput();
      setColorOpen(false);
    },
    [restoreRange, handleInput]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.code === "KeyB") { e.preventDefault(); execCmd("bold"); handleInput(); }
      if (mod && e.code === "KeyI") { e.preventDefault(); execCmd("italic"); handleInput(); }
      if (mod && e.code === "KeyU") { e.preventDefault(); execCmd("underline"); handleInput(); }
    },
    [handleInput]
  );

  const isEmpty = value === "" || value === "<br>" || value === "<div><br></div>";

  return (
    <div className="relative">
      {toolbar && (
        <div
          style={{
            position: "absolute",
            left: toolbar.x,
            top: toolbar.y,
            transform: "translate(-50%, -100%)",
            zIndex: 60,
          }}
          className="flex items-center gap-0.5 bg-ink-900 rounded-lg px-1.5 py-1 shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); applyFormat("bold"); }}
            className="p-1 rounded hover:bg-ink-700 text-white"
            title="מודגש (Ctrl+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); applyFormat("italic"); }}
            className="p-1 rounded hover:bg-ink-700 text-white"
            title="נטוי (Ctrl+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); applyFormat("underline"); }}
            className="p-1 rounded hover:bg-ink-700 text-white"
            title="קו תחתון (Ctrl+U)"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-ink-600 mx-0.5" />
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setColorOpen((v) => !v); }}
              className="p-1 rounded hover:bg-ink-700 text-white"
              title="צבע טקסט"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>
            {colorOpen && (
              <div
                className="absolute top-full mt-1 start-0 bg-white border border-ink-200 rounded-lg shadow-lg p-1.5 flex gap-1 flex-wrap w-[120px]"
                onMouseDown={(e) => e.preventDefault()}
              >
                {COLORS.map((c) => (
                  <button
                    key={c.value || "default"}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (c.value) {
                        applyFormat("foreColor", c.value);
                      } else {
                        applyFormat("removeFormat");
                      }
                    }}
                    className="w-6 h-6 rounded-full border border-ink-200 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c.value || "#1f2937" }}
                    title={c.label}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        dir="rtl"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className={cn(
          "field min-h-[80px] resize-y overflow-auto outline-none",
          "[&>*]:leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-ink-400 empty:before:pointer-events-none",
          isEmpty && "before:content-[attr(data-placeholder)] before:text-ink-400 before:pointer-events-none",
          className
        )}
        style={{ minHeight }}
        data-placeholder={placeholder}
      />
    </div>
  );
}
