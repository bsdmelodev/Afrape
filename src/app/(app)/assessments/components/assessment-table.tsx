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
  AssessmentClassSubjectOption,
  AssessmentRow,
  AssessmentTeacherOption,
  AssessmentTermOption,
} from "../types";
import { AssessmentForm } from "./assessment-form";
import { deleteAssessment } from "../actions";
import { toast } from "sonner";
import { Pencil, Plus, Trash } from "lucide-react";
import { formatDecimal } from "@/lib/formatters";

interface Props {
  data: AssessmentRow[];
  canWrite: boolean;
  classSubjects: AssessmentClassSubjectOption[];
  terms: AssessmentTermOption[];
  teachers: AssessmentTeacherOption[];
}

export function AssessmentTable({ data, canWrite, classSubjects, terms, teachers }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AssessmentRow | undefined>(undefined);

  const handleDelete = (id: number) => {
    if (!confirm("Deseja remover esta avaliação?")) return;
    startTransition(async () => {
      const result = await deleteAssessment(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Avaliação removida");
    });
  };

  const columns = useMemo<ColumnDef<AssessmentRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Título",
        cell: ({ row }) => (
          <div className="leading-tight">
            <div className="font-semibold">{row.original.title}</div>
            <div className="text-xs text-muted-foreground">{row.original.assessmentType}</div>
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
        accessorKey: "assessmentDate",
        header: "Data",
        cell: ({ row }) => row.original.assessmentDate,
        meta: { className: "whitespace-nowrap" },
      },
      {
        accessorKey: "weight",
        header: "Peso",
        cell: ({ row }) => formatDecimal(row.original.weight, true),
        meta: { className: "hidden md:table-cell" },
      },
      {
        accessorKey: "maxScore",
        header: "Nota máx.",
        cell: ({ row }) => formatDecimal(row.original.maxScore, true),
        meta: { className: "hidden md:table-cell whitespace-nowrap" },
      },
      {
        accessorKey: "isPublished",
        header: "Publicada",
        cell: ({ row }) => (
          <Badge variant={row.original.isPublished ? "default" : "secondary"}>
            {row.original.isPublished ? "Sim" : "Não"}
          </Badge>
        ),
        meta: { className: "hidden md:table-cell" },
      },
      {
        accessorKey: "createdByTeacherName",
        header: "Professor",
        cell: ({ row }) => row.original.createdByTeacherName,
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
          <h2 className="text-lg font-semibold">Avaliações</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre avaliações por componente e período.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nova avaliação
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={data} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar avaliação" : "Nova avaliação"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize os dados da avaliação."
                : "Preencha os campos para criar uma avaliação."}
            </DialogDescription>
          </DialogHeader>
          <AssessmentForm
            record={selected}
            classSubjects={classSubjects}
            terms={terms}
            teachers={teachers}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
