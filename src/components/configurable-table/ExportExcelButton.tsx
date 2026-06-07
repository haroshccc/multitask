import { Download } from "lucide-react";
import { exportSheetsToXlsx, type ExportSheet } from "@/lib/export/xlsx";

/**
 * Small toolbar button that exports one configurable table to an .xlsx file.
 * `build` is called lazily on click so the (potentially large) row mapping only
 * runs when the user actually exports. Styled to match {@link ColumnsMenu}'s
 * trigger button.
 */
export function ExportExcelButton({
  filename,
  build,
}: {
  filename: string;
  build: () => ExportSheet;
}) {
  return (
    <button
      type="button"
      onClick={() => exportSheetsToXlsx(filename, [build()])}
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
      title="ייצוא הטבלה לקובץ אקסל"
      aria-label="ייצוא לאקסל"
    >
      <Download className="w-3.5 h-3.5" />
      ייצוא לאקסל
    </button>
  );
}
