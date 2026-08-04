/**
 * Export utilities for CSV, Excel and PDF generation
 */
import DOMPurify from "dompurify";

// xlsx (~400 kB) laddas först när användaren faktiskt exporterar –
// håller appens startbundle liten.
async function loadXLSX() {
  return import("xlsx");
}

export async function downloadExcel(rows: Record<string, unknown>[], filename: string, sheetName = "Data") {
  if (rows.length === 0) return;
  const XLSX = await loadXLSX();
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function downloadMultiSheetExcel(sheets: { name: string; rows: Record<string, unknown>[] }[], filename: string) {
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

export function downloadCSV(rows: Record<string, unknown>[], filename: string) {
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

// Högerställ celler som ser ut som tal/belopp (datum och text lämnas vänster)
const looksNumeric = (v: string) => /^[-+]?[\d\s]+([.,]\d+)?\s*(kr|%|kg|st)?$/.test(v.trim());

export function downloadPDF(title: string, headers: string[], rows: string[][], filename: string) {
  // Branderad utskrifts-PDF. Alla användarvärden escapas och dokumentet saneras.
  const safeTitle = escapeHtml(title);
  const tableRows = rows.map(row =>
    `<tr>${row.map(cell => {
      const cls = looksNumeric(cell) ? ' class="num"' : '';
      return `<td${cls}>${escapeHtml(cell)}</td>`;
    }).join('')}</tr>`
  ).join('');

  const safeHeaders = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
  const exportDate = escapeHtml(new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' }));

  const html = DOMPurify.sanitize(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${safeTitle}</title>
      <style>
        @page { margin: 16mm 14mm 18mm; }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #22281F;
          margin: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .brandbar {
          display: flex; align-items: center; gap: 10px;
          padding-bottom: 12px;
          border-bottom: 3px solid #3A6B35;
          margin-bottom: 20px;
        }
        .egg-badge {
          width: 34px; height: 34px; border-radius: 10px;
          background: linear-gradient(135deg, #3A6B35 0%, #5B8A4A 100%);
          display: flex; align-items: center; justify-content: center;
        }
        .egg-badge svg { width: 19px; height: 19px; }
        .brandname {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 19px; font-weight: 700; color: #3A6B35; letter-spacing: 0.2px;
        }
        .brandsub { font-size: 10.5px; color: #7A7F76; margin-top: 1px; }
        h1 {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 24px; font-weight: 700; margin: 0 0 3px; color: #22281F;
        }
        .meta { color: #7A7F76; font-size: 11.5px; margin: 0 0 18px; }
        .meta strong { color: #3A6B35; font-weight: 600; }
        table {
          width: 100%; border-collapse: separate; border-spacing: 0;
          border: 1px solid #E3E8DE; border-radius: 10px; overflow: hidden;
          font-size: 11.5px;
        }
        thead th {
          background: #3A6B35; color: #FFFFFF;
          text-align: left; font-weight: 600; font-size: 10.5px;
          letter-spacing: 0.4px; text-transform: uppercase;
          padding: 9px 12px;
        }
        tbody td { padding: 8px 12px; border-bottom: 1px solid #EBF0E6; color: #22281F; }
        tbody tr:nth-child(even) { background: #F7F5EF; }
        tbody tr:last-child td { border-bottom: none; }
        td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .footer {
          margin-top: 22px; padding-top: 10px;
          border-top: 1px solid #E3E8DE;
          display: flex; justify-content: space-between;
          font-size: 10px; color: #7A7F76;
        }
        @media print { .brandbar { break-inside: avoid; } thead { display: table-header-group; } }
      </style>
    </head>
    <body>
      <div class="brandbar">
        <div class="egg-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="#FAF8F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c4.97 0 8-3.58 8-8 0-5-3.58-12-8-12S4 9 4 14c0 4.42 3.03 8 8 8z"/></svg>
        </div>
        <div>
          <div class="brandname">Hönsgården</div>
          <div class="brandsub">Din digitala hönsassistent</div>
        </div>
      </div>
      <h1>${safeTitle}</h1>
      <p class="meta">Exporterad ${exportDate} · <strong>${rows.length} rader</strong></p>
      <table>
        <thead><tr>${safeHeaders}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <div class="footer">
        <span>Skapad med Hönsgården</span>
        <span>honsgarden.se</span>
      </div>
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
