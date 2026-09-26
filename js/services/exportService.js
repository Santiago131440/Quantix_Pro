/**
 * Exportación en el navegador: CSV, JSON e impresión (PDF vía diálogo del navegador).
 * Interfaz preparada para agregar Excel/PDF generados por backend (mismo contrato `exportRows`).
 */
import { assertPermission } from '../utils/permissions.js';
import { escapeHtml } from '../utils/html.js';
import { db } from '../core/storage.js';
import { appendAudit, buildAuditEntry } from './auditService.js';
import { toISODate } from '../utils/dates.js';
import { APP } from '../config/constants.js';

/** Previene inyección de fórmulas al abrir el CSV en hojas de cálculo. */
const guardFormula = (value) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);

export function toCSV(rows, columns) {
  const escapeCell = (value) => {
    const text = guardFormula(String(value ?? ''));
    return /[",;\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = columns.map((column) => escapeCell(column.label)).join(',');
  const body = rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(','));
  return `﻿${[header, ...body].join('\r\n')}`;
}

export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printTable({ title, subtitle, columns, rows }) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.append(frame);
  const head = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
  const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(column.value(row))}</td>`).join('')}</tr>`).join('');
  frame.contentDocument.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>body{font:12px system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;margin:24px}h1{font-size:18px;margin:0}
    p{color:#666;margin:4px 0 16px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #ddd}
    th{background:#f5f5f7;font-weight:600}tr{break-inside:avoid}</style></head>
    <body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle || '')} · ${APP.name} · ${new Date().toLocaleString()}</p>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`);
  frame.contentDocument.close();
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 1500);
}

export const exportService = {
  /**
   * @param {{ name:string, title?:string, columns:Array<{label, value:(row)=>any}>, rows:Array, format:'csv'|'json'|'print' }} options
   */
  exportRows({ name, title, subtitle, columns, rows, format }) {
    assertPermission('reports.export');
    const filename = `${name}-${toISODate(new Date())}`;
    if (format === 'csv') downloadFile(`${filename}.csv`, toCSV(rows, columns), 'text/csv;charset=utf-8');
    else if (format === 'json') {
      const data = rows.map((row) => Object.fromEntries(columns.map((column) => [column.key || column.label, column.value(row)])));
      downloadFile(`${filename}.json`, JSON.stringify(data, null, 2), 'application/json');
    } else printTable({ title: title || name, subtitle, columns, rows });
    db.set('auditLogs', appendAudit(buildAuditEntry({ action: 'DATA_EXPORTED', entity: 'system', after: { name, format, rows: rows.length } })));
  },
};
