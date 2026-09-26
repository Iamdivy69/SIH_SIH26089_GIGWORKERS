/**
 * Client-side CSV export — turns already-loaded query data into a
 * spreadsheet-ready download. Numbers are exported as plain values so
 * spreadsheets parse them natively; the BOM keeps Excel happy with UTF-8.
 */

function csvCell(value: string | number | undefined | null): string {
  const s = value === undefined || value === null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | undefined | null)[][],
): void {
  const lines = [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Timestamp fragment for filenames — e.g. 2026-09-27. */
export function csvDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
