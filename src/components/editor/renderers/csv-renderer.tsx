import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@weekend/design/registry";
import type { RendererDescriptor, RendererProps } from "./types";

const MAX_ROWS_RENDERED = 1000;

const CSV_EXTS = new Set(["csv", "tsv", "tab"]);

/**
 * RFC-4180-ish parser. Handles:
 * - Quoted fields containing commas, quotes (escaped as ""), and embedded
 *   newlines.
 * - Auto-detected delimiter (comma vs tab) based on the first line.
 * - Mixed line endings (\n, \r\n).
 *
 * Returns rows as readonly string[][]. Empty trailing lines are dropped.
 */
function parseCsv(content: string): readonly (readonly string[])[] {
  if (!content) return [];
  const firstLineEnd = content.indexOf("\n");
  const sample = firstLineEnd >= 0 ? content.slice(0, firstLineEnd) : content;
  const tabCount = (sample.match(/\t/g) ?? []).length;
  const commaCount = (sample.match(/,/g) ?? []).length;
  const delimiter = tabCount > commaCount ? "\t" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < content.length) {
    const ch = content[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
    } else if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
      i += 1;
    } else if (ch === "\r") {
      i += 1;
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function CsvRendererComponent({ filePath, payload }: RendererProps) {
  if (payload.kind !== "text") {
    throw new Error(`CsvRenderer received non-text payload (got ${payload.kind})`);
  }

  const allRows = useMemo(() => parseCsv(payload.content), [payload.content]);
  const totalRows = allRows.length;
  const headerRow = allRows[0] ?? [];
  const bodyRows = allRows.slice(1, MAX_ROWS_RENDERED + 1);
  const truncated = totalRows > MAX_ROWS_RENDERED + 1;
  const columnCount = headerRow.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-baseline justify-between border-b border-border/70 px-3 py-2">
        <p
          className="truncate font-code text-xs text-muted-foreground"
          title={filePath}
        >
          {filePath}
        </p>
        <p className="font-code text-[11px] text-muted-foreground/70">
          {totalRows === 0
            ? "Empty"
            : `${totalRows - 1} row${totalRows === 2 ? "" : "s"} × ${columnCount} col${columnCount === 1 ? "" : "s"}`}
          {truncated && ` · showing first ${MAX_ROWS_RENDERED}`}
        </p>
      </div>
      {totalRows === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="font-code text-xs text-muted-foreground/50">
            No rows
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {headerRow.map((cell, ci) => (
                  <TableHead key={ci}>{cell}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {bodyRows.map((row, ri) => (
                <TableRow key={ri}>
                  {Array.from({ length: columnCount }).map((_, ci) => (
                    <TableCell key={ci} title={row[ci] ?? ""}>
                      <span className="block max-w-[420px] truncate">
                        {row[ci] ?? ""}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export const csvRenderer: RendererDescriptor = {
  id: "csv",
  name: "CSV",
  payloadKind: "text",
  editable: false,
  canRender(filePath: string): boolean {
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    return CSV_EXTS.has(ext);
  },
  Component: CsvRendererComponent,
};
