"use client";

import { useMemo, useState, useTransition } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  TermGradeClassSubjectOption,
  TermGradeEnrollmentOption,
  TermGradeRow,
  TermGradeTermOption,
} from "../types";
import { TermGradeForm } from "./term-grade-form";
import { deleteTermGrade, recalcTermGrade } from "../actions";
import { toast } from "sonner";
import { Pencil, Plus, Trash, RefreshCw } from "lucide-react";
import { formatDecimal } from "@/lib/formatters";

interface Props {
  data: TermGradeRow[];
  canWrite: boolean;
  enrollments: TermGradeEnrollmentOption[];
  classSubjects: TermGradeClassSubjectOption[];
  terms: TermGradeTermOption[];
}

export function TermGradeTable({ data, canWrite, enrollments, classSubjects, terms }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TermGradeRow | undefined>(undefined);

  const handleDelete = (id: number) => {
    if (!confirm("Deseja remover este fechamento?")) return;
    startTransition(async () => {
      const result = await deleteTermGrade(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Fechamento removido");
    });
  };

  const columns = useMemo<ColumnDef<TermGradeRow>[]>(
    () => [
      {
        accessorKey: "studentName",
        header: "Aluno",
        cell: ({ row }) => (
          <div className="leading-tight">
            <div className="font-semibold">{row.original.studentName}</div>
            <div className="text-xs text-muted-foreground">{row.original.enrollmentLabel}</div>
          </div>
        ),
      },
      {
        accessorKey: "classSubjectName",
        header: "Componente",
        cell: ({ row }) => (
          <div className="leading-tight">
            <div className="font-semibold">{row.original.classSubjectName}</div>
            <div className="text-xs text-muted-foreground">
              Turma {row.original.classGroupYear} — {row.original.classGroupName}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "termName",
        header: "Período",
        cell: ({ row }) => row.original.termName,
        meta: { className: "hidden md:table-cell" },
      },
      {
        accessorKey: "grade",
        header: "Nota",
        cell: ({ row }) =>
          row.original.grade !== null ? formatDecimal(row.original.grade, true) : "-",
        meta: { className: "whitespace-nowrap" },
      },
      {
        accessorKey: "attendancePercentage",
        header: "Freq. (%)",
        cell: ({ row }) =>
          row.original.attendancePercentage !== null
            ? formatDecimal(row.original.attendancePercentage, true)
            : "-",
        meta: { className: "hidden md:table-cell whitespace-nowrap" },
      },
      {
        accessorKey: "absencesCount",
        header: "Faltas",
        cell: ({ row }) => row.original.absencesCount,
        meta: { className: "hidden md:table-cell whitespace-nowrap" },
      },
      {
        accessorKey: "isClosed",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.isClosed ? "default" : "secondary"}>
            {row.original.isClosed ? "Fechado" : "Aberto"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Ações",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              disabled={!canWrite || isPending}
              title="Recalcular nota a partir das avaliações"
              onClick={() => {
                startTransition(async () => {
                  const result = await recalcTermGrade(row.original.id);
                  if (result?.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Nota recalculada");
                });
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
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
          <h2 className="text-lg font-semibold">Fechamento</h2>
          <p className="text-sm text-muted-foreground">
            Consolide notas, faltas e frequência por matrícula.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo fechamento
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={data} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar fechamento" : "Novo fechamento"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize os dados do fechamento."
                : "Preencha os campos para registrar o fechamento do período."}
            </DialogDescription>
          </DialogHeader>
          <TermGradeForm
            record={selected}
            enrollments={enrollments}
            classSubjects={classSubjects}
            terms={terms}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
