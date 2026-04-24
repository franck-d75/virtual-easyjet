import type { JSX, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface DataTableColumn<TRow> {
  id: string;
  header: string;
  className?: string;
  render: (row: TRow) => ReactNode;
}

type DataTableProps<TRow> = {
  rows: TRow[];
  columns: Array<DataTableColumn<TRow>>;
  rowKey: (row: TRow) => string;
};

export function DataTable<TRow>({
  rows,
  columns,
  rowKey,
}: DataTableProps<TRow>): JSX.Element {
  return (
    <div className="table-shell">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.className} key={column.id} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td className={cn(column.className)} key={column.id}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
