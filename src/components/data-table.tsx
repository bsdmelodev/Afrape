"use client";

import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  emptyMessage?: string;
  cardBreakpoint?: "sm" | "md" | "lg";
}

export function DataTable<TData>({
  columns,
  data,
  emptyMessage,
  cardBreakpoint = "md",
}: DataTableProps<TData>) {
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  const tableWrapperClass =
    cardBreakpoint === "sm"
      ? "hidden sm:block"
      : cardBreakpoint === "md"
        ? "hidden md:block"
        : "hidden lg:block";

  const cardWrapperClass =
    cardBreakpoint === "sm"
      ? "block sm:hidden"
      : cardBreakpoint === "md"
        ? "block md:hidden"
        : "block lg:hidden";

  return (
    <div className="space-y-4">
      <div className={tableWrapperClass}>
        <div className="overflow-x-auto rounded-md border bg-card">
          <Table className="min-w-full">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "align-top text-left",
                    (header.column.columnDef.meta as { className?: string } | undefined)?.className
                  )}
                >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "align-top",
                          (cell.column.columnDef.meta as { className?: string } | undefined)
                            ?.className
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                    {emptyMessage ?? "Nenhum registro"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className={cardWrapperClass}>
        {!data.length ? (
          <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
            {emptyMessage ?? "Nenhum registro"}
          </div>
        ) : (
          <div className="space-y-3">
            {table.getRowModel().rows.map((row) => {
              const visibleCells = row.getVisibleCells();
              const actionCells = visibleCells.filter((cell) => {
                const meta = cell.column.columnDef.meta as
                  | { isActions?: boolean; hideOnCard?: boolean }
                  | undefined;
                return meta?.isActions === true || cell.column.id === "actions";
              });
              const infoCells = visibleCells.filter((cell) => {
                const meta = cell.column.columnDef.meta as
                  | { isActions?: boolean; hideOnCard?: boolean }
                  | undefined;
                return meta?.isActions !== true && meta?.hideOnCard !== true;
              });

              return (
                <div key={row.id} className="rounded-lg border bg-card p-4 shadow-sm">
                  {actionCells.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center justify-end gap-1.5">
                      {actionCells.map((cell) => (
                        <div key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-3">
                    {infoCells.map((cell) => (
                      <div key={cell.id} className="flex flex-col gap-1 text-sm break-words">
                        <span className="font-semibold text-foreground">
                          {flexRender(cell.column.columnDef.header, cell.getContext() as any)}
                        </span>
                        <div className="text-muted-foreground">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
