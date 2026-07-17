/**
 * Export utilities for CSV, Excel and PDF generation
 */
import DOMPurify from "dompurify";

// xlsx (~400 kB) laddas först när användaren faktiskt exporterar –
// håller appens startbundle liten.
async function loadXLSX() {
  return import("xlsx");
}

export async function downloadExcel(rows: Record<string, any>[], filename: string, sheetName = "Data") {
  if (rows.length === 0) return;
  const XLSX = await loadXLSX();
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function downloadMultiSheetExcel(sheets: { name: string; rows: Record<string, any>[] }[], filename: string) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    if (sheet.rows.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([["Ingen data"]]);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    } else {
      const ws = XLSX.utils.json_to_sheet(sheet.rows);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function downloadCSV(rows: Record<string, any>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => headers.map(h => {
      const val = row[h] ?? '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(';') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    }).join(';'))
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function downloadPDF(title: string, headers: string[], rows: string[][], filename: string) {
  // Generate a simple HTML-based printable PDF. All user controlled values are escaped
  // before insertion and the final document is sanitized as an extra defense-in-depth layer.
  const safeTitle = escapeHtml(title);
  const tableRows = rows.map(row =>
    `<tr>${row.map(cell => `<td style="border:1px solid #ddd;padding:6px 10px;font-size:11px;">${escapeHtml(cell)}</td>`).join('')}</tr>`
  ).join('');

  const safeHeaders = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
  const exportDate = escapeHtml(new Date().toLocaleDateString('sv-SE'));

  const html = DOMPurify.sanitize(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${safeTitle}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 30px; color: #1a1a1a; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .subtitle { color: #666; font-size: 12px; margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #f5f5f5; border: 1px solid #ddd; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 600; }
        tr:nth-child(even) { background: #fafafa; }
        @media print { body { padding: 10px; } }
      </style>
    </head>
    <body>
      <h1>${safeTitle}</h1>
      <p class="subtitle">Exporterad ${exportDate} · Hönsgården</p>
      <table>
        <thead><tr>${safeHeaders}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </body>
    </html>
  `);

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
