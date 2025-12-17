"use client";

import { useMemo, useState, useTransition } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Plus, Trash } from "lucide-react";
import { ClassGroupForm } from "./class-group-form";
import { deleteClassGroup } from "../actions";
import type { ClassGroupRow } from "../types";

interface Props {
  data: ClassGroupRow[];
  canWrite: boolean;
}

export function ClassGroupTable({ data, canWrite }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ClassGroupRow | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: number) => {
    if (!confirm("Deseja remover esta turma?")) return;
    startTransition(async () => {
      const result = await deleteClassGroup(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Turma removida");
    });
  };

  const columns = useMemo<ColumnDef<ClassGroupRow>[]>(
    () => {
      const base: ColumnDef<ClassGroupRow>[] = [
        {
          accessorKey: "name",
          header: "Turma",
          cell: ({ row }) => (
            <div className="font-medium leading-tight">
              <div>{row.original.name}</div>
              {row.original.shift && (
                <div className="text-xs text-muted-foreground">{row.original.shift}</div>
              )}
            </div>
          ),
        },
        {
          accessorKey: "schoolYear",
          header: "Ano",
          cell: ({ row }) => row.original.schoolYear,
        },
        {
          accessorKey: "isActive",
          header: "Status",
          cell: ({ row }) => (
            <Badge variant={row.original.isActive ? "default" : "secondary"}>
              {row.original.isActive ? "Ativa" : "Inativa"}
            </Badge>
          ),
        },
        {
          accessorKey: "createdAt",
          header: "Criada em",
          cell: ({ row }) => row.original.createdAt,
        },
      ];

      if (canWrite) {
        base.push({
          id: "actions",
          header: "Ações",
          cell: ({ row }) => (
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelected(row.original);
                  setOpen(true);
                }}
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                onClick={() => handleDelete(row.original.id)}
                title="Excluir"
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          ),
          meta: { isActions: true, className: "text-right whitespace-nowrap" },
        });
      }

      return base;
    },
    [canWrite, isPending]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Turmas</h2>
          <p className="text-sm text-muted-foreground">
            Organize turmas por ano e turno.
          </p>
        </div>
        {canWrite && (
          <Button
            className="gap-2"
            onClick={() => {
              setSelected(undefined);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nova turma
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={data} cardBreakpoint="sm" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar turma" : "Nova turma"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize os dados da turma."
                : "Defina ano, nome e turno da turma."}
            </DialogDescription>
          </DialogHeader>
          <ClassGroupForm group={selected} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
