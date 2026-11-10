function escapeCsvCell(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: Array<{ key: string; header: string }>): string {
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const dataLines = rows.map((row) => columns.map((c) => escapeCsvCell(row[c.key])).join(','));
  return [headerLine, ...dataLines].join('\n');
}

/** Triggers a browser download of the given CSV text — no server round-trip needed since the data is already in hand. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
