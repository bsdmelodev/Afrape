"use client";

import { useMemo, useState, useTransition } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TermRow } from "../types";
import { TermForm } from "./term-form";
import { deleteTerm } from "../actions";
import { toast } from "sonner";
import { Pencil, Plus, Trash } from "lucide-react";

interface Props {
  data: TermRow[];
  canWrite: boolean;
}

export function TermTable({ data, canWrite }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TermRow | undefined>(undefined);

  const handleDelete = (id: number) => {
    if (!confirm("Deseja remover este período?")) return;
    startTransition(async () => {
      const result = await deleteTerm(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Período removido");
    });
  };

  const columns = useMemo<ColumnDef<TermRow>[]>(
    () => [
      {
        accessorKey: "schoolYear",
        header: "Ano",
        cell: ({ row }) => row.original.schoolYear,
        meta: { className: "whitespace-nowrap" },
      },
      {
        accessorKey: "name",
        header: "Nome",
        cell: ({ row }) => (
          <div className="leading-tight">
            <div className="font-semibold">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">Ordem {row.original.termOrder}</div>
          </div>
        ),
      },
      {
        accessorKey: "startsAt",
        header: "Período",
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">
            {row.original.startsAt} — {row.original.endsAt}
          </div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Criado em",
        cell: ({ row }) => row.original.createdAt,
        meta: { className: "hidden md:table-cell" },
      },
      {
        id: "actions",
        header: "Ações",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              disabled={!canWrite}
              onClick={() => {
                setSelected(row.original);
                setOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canWrite || isPending}
              onClick={() => handleDelete(row.original.id)}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        ),
        meta: { className: "text-right whitespace-nowrap", isActions: true },
      },
    ],
    [canWrite, isPending]
  );

  const openCreate = () => {
    setSelected(undefined);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Períodos</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre períodos letivos (bimestres, trimestres, semestres).
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo período
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={data} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar período" : "Novo período"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize os dados do período letivo."
                : "Preencha os campos para criar um período letivo."}
            </DialogDescription>
          </DialogHeader>
          <TermForm term={selected} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
