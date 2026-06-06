/**
 * PDF renderer (react-pdf). Chosen over jsPDF/pdfmake because its text layout
 * engine (@react-pdf/textkit) does real Unicode bidi reordering — essential for
 * correct Hebrew/RTL output. A full Rubik TTF (Latin + Hebrew + digits) is
 * embedded so every glyph renders.
 *
 * This module statically imports react-pdf; the dispatcher in `index.ts`
 * dynamic-imports this file so the (heavy) library is only loaded when a PDF
 * export actually runs.
 */

import {
  Document,
  Page,
  Text,
  View,
  Font,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { ExportDoc } from "./model";
import RubikRegular from "./fonts/Rubik-Regular.ttf";
import RubikBold from "./fonts/Rubik-Bold.ttf";

let fontReady = false;
function ensureFont() {
  if (fontReady) return;
  Font.register({
    family: "Rubik",
    fonts: [
      { src: RubikRegular, fontWeight: 400 },
      { src: RubikBold, fontWeight: 700 },
    ],
  });
  // Hebrew words must never be hyphenated/broken mid-word.
  Font.registerHyphenationCallback((word) => [word]);
  fontReady = true;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Rubik",
    fontSize: 11,
    color: "#1F2937",
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    direction: "rtl",
    textAlign: "right",
    lineHeight: 1.5,
  },
  title: { fontSize: 22, fontWeight: 700, textAlign: "right", marginBottom: 6 },
  meta: { fontSize: 9, color: "#6B7280", textAlign: "right", marginBottom: 4 },
  heading: {
    fontSize: 14,
    fontWeight: 700,
    color: "#DB2777",
    textAlign: "right",
    marginTop: 16,
    marginBottom: 6,
  },
  paragraph: { textAlign: "right", marginBottom: 6 },
  bulletRow: { flexDirection: "row-reverse", marginBottom: 3 },
  bulletDot: { width: 12, textAlign: "center" },
  bulletText: { flex: 1, textAlign: "right" },
});

export async function renderPdf(doc: ExportDoc): Promise<Blob> {
  ensureFont();

  const element = (
    <Document title={doc.title}>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>{doc.title}</Text>
        {doc.meta.length > 0 && (
          <Text style={styles.meta}>
            {doc.meta.map((m) => `${m.label}: ${m.value}`).join("    |    ")}
          </Text>
        )}

        {doc.sections.map((section, si) => (
          <View key={si} wrap>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.blocks.map((block, bi) =>
              block.type === "paragraph" ? (
                <Text key={bi} style={styles.paragraph}>
                  {block.text}
                </Text>
              ) : (
                <View key={bi}>
                  {block.items.map((item, ii) => (
                    <View key={ii} style={styles.bulletRow} wrap={false}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>{item}</Text>
                    </View>
                  ))}
                </View>
              ),
            )}
          </View>
        ))}
      </Page>
    </Document>
  );

  return pdf(element).toBlob();
}
