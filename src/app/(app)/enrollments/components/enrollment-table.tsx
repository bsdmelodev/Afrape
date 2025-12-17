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
import { deleteEnrollment } from "../actions";
import { EnrollmentForm } from "./enrollment-form";
import type { EnrollmentRow, Option } from "../types";

interface Props {
  data: EnrollmentRow[];
  canWrite: boolean;
  students: Option[];
  classGroups: Option[];
}

const STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  transferred: "Transferida",
  cancelled: "Cancelada",
  completed: "Concluída",
};

export function EnrollmentTable({ data, canWrite, students, classGroups }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<EnrollmentRow | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: number) => {
    if (!confirm("Deseja remover esta matrícula?")) return;
    startTransition(async () => {
      const result = await deleteEnrollment(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Matrícula removida");
    });
  };

  const columns = useMemo<ColumnDef<EnrollmentRow>[]>(
    () => {
      const base: ColumnDef<EnrollmentRow>[] = [
        {
          accessorKey: "studentName",
          header: "Aluno",
          cell: ({ row }) => (
            <div className="leading-tight">
              <div className="font-medium">{row.original.studentName}</div>
              <div className="text-xs text-muted-foreground">
                Turma: {row.original.classGroupName}
              </div>
            </div>
          ),
        },
        {
          accessorKey: "classGroupName",
          header: "Turma",
          cell: ({ row }) => row.original.classGroupName,
        },
        {
          accessorKey: "status",
          header: "Status",
          cell: ({ row }) => (
            <Badge variant="secondary">
              {STATUS_LABELS[row.original.status] || row.original.status}
            </Badge>
          ),
        },
        {
          accessorKey: "enrolledAt",
          header: "Entrada",
          cell: ({ row }) => row.original.enrolledAt,
        },
        {
          accessorKey: "leftAt",
          header: "Saída",
          cell: ({ row }) => row.original.leftAt || "-",
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
          <h2 className="text-lg font-semibold">Matrículas</h2>
          <p className="text-sm text-muted-foreground">
            Vincule alunos às turmas ativas.
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
            <Plus className="h-4 w-4" /> Nova matrícula
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={data} cardBreakpoint="sm" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar matrícula" : "Nova matrícula"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize turma, status ou datas."
                : "Preencha os dados da nova matrícula."}
            </DialogDescription>
          </DialogHeader>
          <EnrollmentForm
            enrollment={selected}
            students={students}
            classGroups={classGroups}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
