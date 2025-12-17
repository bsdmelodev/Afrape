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
import { toast } from "sonner";
import { Pencil, Plus, Trash } from "lucide-react";
import { SubjectForm } from "./subject-form";
import { deleteSubject } from "../actions";
import type { SubjectRow } from "../types";

interface Props {
  data: SubjectRow[];
  canWrite: boolean;
}

export function SubjectTable({ data, canWrite }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SubjectRow | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: number) => {
    if (!confirm("Deseja remover esta disciplina?")) return;
    startTransition(async () => {
      const result = await deleteSubject(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Disciplina removida");
    });
  };

  const columns = useMemo<ColumnDef<SubjectRow>[]>(
    () => {
      const base: ColumnDef<SubjectRow>[] = [
        {
          accessorKey: "name",
          header: "Nome",
          cell: ({ row }) => row.original.name,
        },
        {
          accessorKey: "code",
          header: "Código",
          cell: ({ row }) => row.original.code || "-",
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
          header: "",
          cell: ({ row }) => (
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="icon"
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
                disabled={isPending}
                onClick={() => handleDelete(row.original.id)}
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          ),
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
          <h2 className="text-lg font-semibold">Disciplinas</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre disciplinas e códigos de referência.
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
            <Plus className="h-4 w-4" /> Nova disciplina
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={data} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar disciplina" : "Nova disciplina"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize o nome ou código da disciplina."
                : "Preencha para criar uma disciplina."}
            </DialogDescription>
          </DialogHeader>
          <SubjectForm subject={selected} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
