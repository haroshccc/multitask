/**
 * Format-agnostic export model for recordings.
 *
 * A recording can be exported to DOCX / PDF / PPTX. To avoid duplicating the
 * "what goes in the document" logic per format, we first build a neutral
 * `ExportDoc` (title + metadata + ordered sections), then each format renderer
 * turns that into a Blob. The renderers live in sibling files and are
 * dynamically imported so their (heavy) libraries stay out of the main bundle.
 */

import type { Recording } from "@/lib/types/domain";
import type {
  RecordingAiOutput,
  FreeTextQaEntry,
  RecordingGeneratedDoc,
} from "@/lib/services/recordings";

export type ExportFormat = "docx" | "pdf" | "pptx";

export type ExportBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "heading"; level: 2 | 3; text: string };

export interface ExportSection {
  heading: string;
  blocks: ExportBlock[];
}

export interface ExportDoc {
  title: string;
  meta: { label: string; value: string }[];
  sections: ExportSection[];
}

/** Which pieces of the recording to include. The modal toggles these. */
export interface ExportInclude {
  meta: boolean;
  transcript: boolean;
  shortSummary: boolean;
  longSummary: boolean;
  whatsapp: boolean;
  email: boolean;
  tasks: boolean;
  events: boolean;
}

export interface BuildExportInput {
  recording: Recording;
  aiOutput: RecordingAiOutput;
  /** Already filtered to the Q&A entries the user selected. */
  qaEntries: FreeTextQaEntry[];
  /** Already filtered to the generated documents the user selected. */
  documents: RecordingGeneratedDoc[];
  include: ExportInclude;
}

const SOURCE_LABELS: Record<string, string> = {
  thought: "מחשבה",
  call: "שיחה",
  meeting: "פגישה",
  recording: "הקלטה",
  whatsapp: "וואטסאפ",
  upload: "העלאה",
  other: "אחר",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "נמוכה",
  normal: "רגילה",
  high: "גבוהה",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}:${String(s).padStart(2, "0")} דק׳`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, "0")} שע׳`;
}

/** Split a free-text block into paragraphs on blank lines, trimming each. */
function toParagraphs(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

/** Build a transcript paragraph list, preferring speaker-segmented utterances. */
function transcriptParagraphs(rec: Recording): string[] {
  const json = rec.transcript_json as
    | {
        transcription?: {
          utterances?: Array<{ speaker?: number; text?: string }>;
        };
      }
    | null;
  const utterances = json?.transcription?.utterances;
  if (Array.isArray(utterances) && utterances.length > 0) {
    return utterances
      .map((u) => {
        const text = (u.text ?? "").trim();
        if (!text) return "";
        const speaker =
          typeof u.speaker === "number" ? `דובר/ת ${u.speaker + 1}: ` : "";
        return `${speaker}${text}`;
      })
      .filter(Boolean);
  }
  return toParagraphs(rec.transcript_text);
}

export function buildExportDoc(input: BuildExportInput): ExportDoc {
  const { recording, aiOutput, qaEntries, documents, include } = input;

  const title =
    (recording.title ?? "").trim() ||
    SOURCE_LABELS[recording.source] ||
    "הקלטה";

  const meta: ExportDoc["meta"] = [];
  if (include.meta) {
    const date = formatDate(recording.created_at);
    if (date) meta.push({ label: "תאריך", value: date });
    const dur = formatDuration(recording.duration_seconds);
    if (dur) meta.push({ label: "משך", value: dur });
    const source = SOURCE_LABELS[recording.source];
    if (source) meta.push({ label: "מקור", value: source });
    if (recording.speakers_count && recording.speakers_count > 0) {
      meta.push({ label: "דוברים", value: String(recording.speakers_count) });
    }
  }

  const sections: ExportSection[] = [];

  if (include.shortSummary && aiOutput.short_summary.trim()) {
    sections.push({
      heading: "סיכום קצר",
      blocks: paragraphsToBlocks(aiOutput.short_summary),
    });
  }

  if (include.longSummary && aiOutput.long_summary.trim()) {
    sections.push({
      heading: "סיכום מפורט",
      blocks: paragraphsToBlocks(aiOutput.long_summary),
    });
  }

  if (include.tasks && aiOutput.tasks.length > 0) {
    sections.push({
      heading: "משימות",
      blocks: [
        {
          type: "bullets",
          items: aiOutput.tasks.map((t) => {
            const extras: string[] = [];
            if (t.speaker_name) extras.push(t.speaker_name);
            if (t.priority && PRIORITY_LABELS[t.priority]) {
              extras.push(`עדיפות ${PRIORITY_LABELS[t.priority]}`);
            }
            if (t.due_hint) extras.push(t.due_hint);
            return extras.length
              ? `${t.title} (${extras.join(" · ")})`
              : t.title;
          }),
        },
      ],
    });
  }

  if (include.events && aiOutput.events.length > 0) {
    sections.push({
      heading: "אירועים",
      blocks: [
        {
          type: "bullets",
          items: aiOutput.events.map((e) => {
            const extras: string[] = [];
            if (e.date_iso) extras.push(formatDate(e.date_iso));
            if (e.duration_minutes) extras.push(`${e.duration_minutes} דק׳`);
            if (e.speaker_name) extras.push(e.speaker_name);
            return extras.length
              ? `${e.title} (${extras.filter(Boolean).join(" · ")})`
              : e.title;
          }),
        },
      ],
    });
  }

  if (include.whatsapp && aiOutput.whatsapp_message.trim()) {
    sections.push({
      heading: "הודעת WhatsApp",
      blocks: paragraphsToBlocks(aiOutput.whatsapp_message),
    });
  }

  if (
    include.email &&
    (aiOutput.email.subject.trim() || aiOutput.email.body.trim())
  ) {
    const blocks: ExportBlock[] = [];
    if (aiOutput.email.subject.trim()) {
      blocks.push({ type: "paragraph", text: `נושא: ${aiOutput.email.subject.trim()}` });
    }
    blocks.push(...paragraphsToBlocks(aiOutput.email.body));
    sections.push({ heading: "מייל", blocks });
  }

  for (const docItem of documents) {
    const blocks = parseMarkdown(docItem.content);
    if (blocks.length > 0) {
      sections.push({
        heading: docItem.title.trim() || "מסמך",
        blocks,
      });
    }
  }

  for (const qa of qaEntries) {
    sections.push({
      heading: `שאלה: ${qa.question.trim()}`,
      blocks: paragraphsToBlocks(qa.answer),
    });
  }

  if (include.transcript) {
    const paras = transcriptParagraphs(recording);
    if (paras.length > 0) {
      sections.push({
        heading: "תמלול מלא",
        blocks: paras.map((text) => ({ type: "paragraph", text }) as const),
      });
    }
  }

  return { title, meta, sections };
}

function paragraphsToBlocks(text: string): ExportBlock[] {
  return toParagraphs(text).map(
    (t) => ({ type: "paragraph", text: t }) as const,
  );
}

/** Strip common inline Markdown markers (bold/italic/code) for plain output. */
function cleanInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^\*(.+?)\*$/g, "$1")
    .trim();
}

/**
 * Parse a Markdown document (as produced by the AI document generator) into
 * structured export blocks: ATX headings (#/##/###), unordered + ordered
 * lists, and paragraphs. Good enough for the subset the model emits — not a
 * full CommonMark parser.
 */
export function parseMarkdown(md: string): ExportBlock[] {
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ExportBlock[] = [];
  let para: string[] = [];
  let bullets: string[] = [];
  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: "paragraph", text: cleanInline(para.join(" ")) });
      para = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length) {
      blocks.push({ type: "bullets", items: bullets.slice() });
      bullets = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushBullets();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara();
      flushBullets();
      blocks.push({
        type: "heading",
        level: heading[1].length <= 2 ? 2 : 3,
        text: cleanInline(heading[2]),
      });
      continue;
    }
    const ul = line.match(/^[-*•]\s+(.*)$/);
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      bullets.push(cleanInline((ul ?? ol)![1]));
      continue;
    }
    flushBullets();
    para.push(line);
  }
  flushPara();
  flushBullets();
  return blocks;
}

/** Build a safe, human filename for the export (no extension). */
export function exportBaseName(recording: Recording): string {
  const raw =
    (recording.title ?? "").trim() ||
    SOURCE_LABELS[recording.source] ||
    "recording";
  // Keep Hebrew/letters/digits/space/dash; collapse the rest to a dash.
  const cleaned = raw
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || "recording";
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
