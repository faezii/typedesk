import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatCell, type ReportResult } from "@/lib/reports";

Font.registerHyphenationCallback((word) => [word]);

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 8, fontFamily: "Helvetica", color: "#1f2937" },
  head: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, borderBottomWidth: 1.5, borderBottomColor: "#047857", paddingBottom: 8 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  muted: { color: "#6b7280" },
  th: { flexDirection: "row", backgroundColor: "#ecfdf5", borderBottomWidth: 1, borderBottomColor: "#047857", fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" },
  total: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#047857", fontFamily: "Helvetica-Bold" },
  cell: { flex: 1, paddingVertical: 4, paddingHorizontal: 3 },
  note: { marginTop: 10, color: "#6b7280" },
  footer: { position: "absolute", bottom: 16, left: 28, right: 28, fontSize: 7, color: "#9ca3af", textAlign: "right" },
});

export function ReportPdf({ title, period, company, generated, report }: { title: string; period: string; company: string; generated: string; report: ReportResult }) {
  // Text columns get more room than numeric ones.
  const flex = report.columns.map((c) => (!c.type || c.type === "text" ? 2 : 1));
  const align = (i: number) => ({ textAlign: (report.columns[i]!.type && report.columns[i]!.type !== "text" && report.columns[i]!.type !== "date" ? "right" : "left") as "right" | "left" });

  const row = (values: (string | number | null | undefined)[], style: typeof s.tr | typeof s.total) => (
    <View style={style} wrap={false}>
      {values.map((v, i) => (
        <Text key={i} style={[s.cell, { flex: flex[i] }, align(i)]}>
          {formatCell(v, report.columns[i]!.type)}
        </Text>
      ))}
    </View>
  );

  return (
    <Document title={`${title} — ${period}`} author={company}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.head} fixed>
          <View>
            <Text style={s.title}>{title}</Text>
            <Text style={s.muted}>{period}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{company}</Text>
            <Text style={s.muted}>Generated {generated}</Text>
          </View>
        </View>
        <View style={s.th} fixed>
          {report.columns.map((c, i) => (
            <Text key={c.key} style={[s.cell, { flex: flex[i] }, align(i)]}>
              {c.label}
            </Text>
          ))}
        </View>
        {report.rows.length === 0 ? <Text style={{ paddingVertical: 12, color: "#6b7280" }}>No data for this period.</Text> : null}
        {report.rows.map((r, ri) => (
          <View key={ri}>{row(report.columns.map((c) => r[c.key]), s.tr)}</View>
        ))}
        {report.totals ? row(report.columns.map((c) => report.totals![c.key]), s.total) : null}
        {report.note ? <Text style={s.note}>{report.note}</Text> : null}
        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}
