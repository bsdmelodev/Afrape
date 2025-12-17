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
import type { AssessmentOption, EnrollmentOption, ScoreRow } from "../types";
import { ScoreForm } from "./score-form";
import { deleteScore } from "../actions";
import { toast } from "sonner";
import { Pencil, Plus, Trash } from "lucide-react";
import { formatDecimal } from "@/lib/formatters";

interface Props {
  data: ScoreRow[];
  canWrite: boolean;
  assessments: AssessmentOption[];
  enrollments: EnrollmentOption[];
}

export function ScoreTable({ data, canWrite, assessments, enrollments }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ScoreRow | undefined>(undefined);

  const handleDelete = (assessmentId: number, enrollmentId: number) => {
    if (!confirm("Deseja remover este lançamento?")) return;
    startTransition(async () => {
      const result = await deleteScore(assessmentId, enrollmentId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Lançamento removido");
    });
  };

  const columns = useMemo<ColumnDef<ScoreRow>[]>(
    () => [
      {
        accessorKey: "assessmentTitle",
        header: "Avaliação",
        cell: ({ row }) => (
          <div className="leading-tight">
            <div className="font-semibold">{row.original.assessmentTitle}</div>
            <div className="text-xs text-muted-foreground">{row.original.assessmentDate}</div>
          </div>
        ),
      },
      {
        accessorKey: "subjectName",
        header: "Componente",
        cell: ({ row }) => (
          <div className="leading-tight">
            <div className="font-semibold">{row.original.subjectName}</div>
            <div className="text-xs text-muted-foreground">
              Turma {row.original.classGroupYear} — {row.original.classGroupName}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "studentName",
        header: "Aluno",
        cell: ({ row }) => (
          <div className="leading-tight">
            <div className="font-semibold">{row.original.studentName}</div>
            <div className="text-xs text-muted-foreground">
              Matrícula {row.original.registrationNumber ?? "-"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "score",
        header: "Nota",
        cell: ({ row }) =>
          row.original.score !== null ? formatDecimal(row.original.score, true) : "-",
        meta: { className: "whitespace-nowrap" },
      },
      {
        accessorKey: "isAbsent",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.isAbsent ? "secondary" : "default"}>
            {row.original.isAbsent ? "Faltou" : "Presente"}
          </Badge>
        ),
      },
      {
        accessorKey: "isExcused",
        header: "Justif.",
        cell: ({ row }) => (
          <Badge variant={row.original.isExcused ? "default" : "secondary"}>
            {row.original.isExcused ? "Sim" : "Não"}
          </Badge>
        ),
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
              onClick={() => handleDelete(row.original.assessmentId, row.original.enrollmentId)}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        ),
        meta: { className: "text-right whitespace-nowrap" },
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
          <h2 className="text-lg font-semibold">Notas por avaliação</h2>
          <p className="text-sm text-muted-foreground">
            Lance ou ajuste notas dos alunos em cada avaliação.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo lançamento
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={data} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize nota, presença ou justificativa."
                : "Selecione a avaliação e a matrícula para lançar a nota."}
            </DialogDescription>
          </DialogHeader>
          <ScoreForm
            record={selected}
            assessments={assessments}
            enrollments={enrollments}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
