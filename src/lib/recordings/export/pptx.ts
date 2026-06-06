/**
 * PPTX renderer. Builds a PowerPoint deck (title slide + one-or-more slides per
 * section) with RTL Hebrew text (`rtlMode` + right alignment). Long sections
 * (e.g. a full transcript) are paginated across multiple slides since pptxgenjs
 * does not auto-flow overflowing text.
 */

import type { ExportDoc, ExportSection } from "./model";

// Rough number of body lines that fit comfortably on one content slide.
const LINES_PER_SLIDE = 9;

type Line = { text: string; bullet: boolean; bold?: boolean };

function sectionLines(section: ExportSection): Line[] {
  const lines: Line[] = [];
  for (const block of section.blocks) {
    if (block.type === "heading") {
      lines.push({ text: block.text, bullet: false, bold: true });
    } else if (block.type === "paragraph") {
      lines.push({ text: block.text, bullet: false });
    } else {
      for (const item of block.items) lines.push({ text: item, bullet: true });
    }
  }
  return lines;
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (arr.length === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function renderPptx(doc: ExportDoc): Promise<Blob> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches

  const PINK = "DB2777";
  const INK = "1F2937";
  const GREY = "6B7280";

  // ---- Title slide ----
  const title = pptx.addSlide();
  title.addText(doc.title, {
    x: 0.5,
    y: 2.4,
    w: 12.33,
    h: 1.5,
    rtlMode: true,
    align: "right",
    fontSize: 40,
    bold: true,
    color: INK,
  });
  if (doc.meta.length > 0) {
    title.addText(doc.meta.map((m) => `${m.label}: ${m.value}`).join("    |    "), {
      x: 0.5,
      y: 4.0,
      w: 12.33,
      h: 0.6,
      rtlMode: true,
      align: "right",
      fontSize: 16,
      color: GREY,
    });
  }

  // ---- Content slides ----
  for (const section of doc.sections) {
    const lines = sectionLines(section);
    const pages = chunk(lines, LINES_PER_SLIDE);
    pages.forEach((pageLines, idx) => {
      const slide = pptx.addSlide();
      slide.addText(
        idx === 0 ? section.heading : `${section.heading} (המשך)`,
        {
          x: 0.5,
          y: 0.4,
          w: 12.33,
          h: 0.8,
          rtlMode: true,
          align: "right",
          fontSize: 26,
          bold: true,
          color: PINK,
        },
      );
      if (pageLines.length > 0) {
        slide.addText(
          pageLines.map((l) => ({
            text: l.text,
            options: { bullet: l.bullet, bold: l.bold, breakLine: true },
          })),
          {
            x: 0.5,
            y: 1.4,
            w: 12.33,
            h: 5.6,
            rtlMode: true,
            align: "right",
            fontSize: 16,
            color: INK,
            valign: "top",
          },
        );
      }
    });
  }

  const out = (await pptx.write({ outputType: "blob" })) as Blob;
  return out;
}
