import type { ParseResult } from '@archon/aco-core';

export function parseCsv(input: string): ParseResult<readonly (readonly string[])[]> {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let afterQuote = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (afterQuote) {
      if (char === ',') {
        row.push(cell);
        cell = '';
        afterQuote = false;
        continue;
      }
      if (char === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        afterQuote = false;
        continue;
      }
      if (char === '\r') {
        if (next === '\n') index += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        afterQuote = false;
        continue;
      }
      return { ok: false, issues: [`unexpected character after quoted field at offset ${index}`] };
    }

    if (char === '"') {
      if (cell.length > 0) {
        return { ok: false, issues: [`unexpected quote inside unquoted field at offset ${index}`] };
      }
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    if (char === '\r') {
      if (next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (inQuotes) {
    return { ok: false, issues: ['unterminated quoted CSV field'] };
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (rows.length === 0) {
    return { ok: false, issues: ['CSV input is empty'] };
  }

  return { ok: true, value: rows };
}

export function stringifyCsv(rows: readonly (readonly string[])[]): string {
  return `${rows.map(row => row.map(escapeCsvCell).join(',')).join('\n')}\n`;
}

function escapeCsvCell(cell: string): string {
  if (!/[",\r\n]/.test(cell)) return cell;
  return `"${cell.replaceAll('"', '""')}"`;
}
