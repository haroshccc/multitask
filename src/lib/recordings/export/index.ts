/**
 * Recording export — public surface. Builds a neutral `ExportDoc` and renders
 * it to the requested format. Each format renderer is dynamic-imported so its
 * library only loads when that format is actually used.
 */

import {
  buildExportDoc,
  exportBaseName,
  type ExportFormat,
  type BuildExportInput,
} from "./model";

export type {
  ExportFormat,
  ExportInclude,
  ExportDoc,
  ExportSection,
  ExportBlock,
} from "./model";
export { buildExportDoc, exportBaseName, downloadBlob } from "./model";

const EXTENSIONS: Record<ExportFormat, string> = {
  docx: "docx",
  pdf: "pdf",
  pptx: "pptx",
};

const MIME_TYPES: Record<ExportFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function exportMimeType(format: ExportFormat): string {
  return MIME_TYPES[format];
}

export function exportFileName(baseName: string, format: ExportFormat): string {
  return `${baseName}.${EXTENSIONS[format]}`;
}

/** Render an already-built `ExportDoc` to a Blob in the requested format. */
export async function renderExport(
  doc: import("./model").ExportDoc,
  format: ExportFormat,
): Promise<Blob> {
  switch (format) {
    case "docx":
      return (await import("./docx")).renderDocx(doc);
    case "pdf":
      return (await import("./pdf")).renderPdf(doc);
    case "pptx":
      return (await import("./pptx")).renderPptx(doc);
  }
}

/** Build + render in one call. */
export async function generateExport(
  input: BuildExportInput,
  format: ExportFormat,
): Promise<{ blob: Blob; fileName: string }> {
  const doc = buildExportDoc(input);
  const blob = await renderExport(doc, format);
  const fileName = exportFileName(exportBaseName(input.recording), format);
  return { blob, fileName };
}
