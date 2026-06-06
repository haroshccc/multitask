/**
 * DOCX renderer. Turns an `ExportDoc` into a Word document Blob with full
 * RTL/Hebrew handling (`bidirectional` paragraphs + `rightToLeft` runs).
 * The `docx` library is dynamically imported so it stays out of the main
 * bundle until an export actually runs.
 */

import type { ExportDoc } from "./model";

export async function renderDocx(doc: ExportDoc): Promise<Blob> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
  } = await import("docx");

  const children: InstanceType<typeof Paragraph>[] = [];

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: doc.title, rightToLeft: true, bold: true })],
    }),
  );

  // Metadata line(s)
  if (doc.meta.length > 0) {
    children.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: doc.meta.map((m) => `${m.label}: ${m.value}`).join("   |   "),
            rightToLeft: true,
            color: "666666",
            size: 18,
          }),
        ],
      }),
    );
  }

  for (const section of doc.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 280, after: 120 },
        children: [
          new TextRun({ text: section.heading, rightToLeft: true, bold: true }),
        ],
      }),
    );

    for (const block of section.blocks) {
      if (block.type === "paragraph") {
        children.push(
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.RIGHT,
            spacing: { after: 120 },
            children: [new TextRun({ text: block.text, rightToLeft: true })],
          }),
        );
      } else {
        for (const item of block.items) {
          children.push(
            new Paragraph({
              bidirectional: true,
              alignment: AlignmentType.RIGHT,
              bullet: { level: 0 },
              spacing: { after: 60 },
              children: [new TextRun({ text: item, rightToLeft: true })],
            }),
          );
        }
      }
    }
  }

  const document = new Document({
    sections: [{ properties: {}, children }],
  });

  return Packer.toBlob(document);
}
