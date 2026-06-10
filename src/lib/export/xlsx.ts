import * as XLSX from "xlsx";

/**
 * A single sheet in an exported workbook. `rows` is a matrix of plain cell
 * values aligned to `headers`; nulls render as blank cells.
 */
export interface ExportSheet {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
}

/**
 * Sanitize a sheet name to Excel's constraints: ≤31 chars and none of the
 * reserved characters `[]:*?/\`. Falls back to a generic name if empty.
 */
function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, " ").trim();
  return (cleaned || "גיליון").slice(0, 31);
}

/**
 * Build an xlsx workbook from a list of {@link ExportSheet}s. Each sheet is an
 * array-of-arrays (`[headers, ...rows]`), column widths are set to a uniform
 * ~18 chars, and the workbook view is flagged RTL for Hebrew.
 */
export function buildWorkbook(sheets: ExportSheet[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const sheet of sheets) {
    const aoa: (string | number | null)[][] = [sheet.headers, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = sheet.headers.map(() => ({ wch: 18 }));

    // De-duplicate sheet names — Excel rejects duplicates within a workbook.
    let name = sanitizeSheetName(sheet.name);
    let suffix = 2;
    while (usedNames.has(name)) {
      name = sanitizeSheetName(`${sheet.name} ${suffix++}`);
    }
    usedNames.add(name);

    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  wb.Workbook = { ...(wb.Workbook ?? {}), Views: [{ RTL: true }] };
  return wb;
}

/**
 * Build a workbook from `sheets` and trigger a browser download. The `.xlsx`
 * extension is appended if missing.
 */
export function exportSheetsToXlsx(filename: string, sheets: ExportSheet[]): void {
  const name = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(buildWorkbook(sheets), name);
}
