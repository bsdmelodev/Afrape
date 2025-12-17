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
import type { ClassGroupOption, ClassSubjectRow, SubjectOption } from "../types";
import { ClassSubjectForm } from "./class-subject-form";
import { deleteClassSubject } from "../actions";
import { toast } from "sonner";
import { Pencil, Plus, Trash } from "lucide-react";

interface Props {
  data: ClassSubjectRow[];
  canWrite: boolean;
  classGroups: ClassGroupOption[];
  subjects: SubjectOption[];
}

export function ClassSubjectTable({ data, canWrite, classGroups, subjects }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ClassSubjectRow | undefined>(undefined);

  const handleDelete = (id: number) => {
    if (!confirm("Deseja remover este vínculo?")) return;
    startTransition(async () => {
      const result = await deleteClassSubject(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Vínculo removido");
    });
  };

  const columns = useMemo<ColumnDef<ClassSubjectRow>[]>(
    () => {
      const base: ColumnDef<ClassSubjectRow>[] = [
        {
          accessorKey: "classGroupName",
          header: "Turma",
          cell: ({ row }) => (
            <div className="leading-tight">
              <div className="font-semibold">{row.original.classGroupName}</div>
              <div className="text-xs text-muted-foreground">
                Ano {row.original.classGroupYear}
              </div>
            </div>
          ),
        },
        {
          accessorKey: "subjectName",
          header: "Disciplina",
          cell: ({ row }) => (
            <div className="leading-tight">
              <div className="font-semibold">{row.original.subjectName}</div>
              {row.original.subjectCode && (
                <div className="text-xs text-muted-foreground">{row.original.subjectCode}</div>
              )}
            </div>
          ),
        },
        {
          accessorKey: "workloadMinutes",
          header: "Carga (min)",
          cell: ({ row }) => row.original.workloadMinutes ?? "-",
          meta: { className: "whitespace-nowrap" },
        },
        {
          accessorKey: "createdAt",
          header: "Criado em",
          cell: ({ row }) => row.original.createdAt,
          meta: { className: "hidden md:table-cell" },
        },
      ];

      if (canWrite) {
        base.push({
          id: "actions",
          header: "Ações",
          cell: ({ row }) => (
            <div className="flex items-center justify-end gap-1.5 sm:gap-2">
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
          meta: { className: "text-right whitespace-nowrap", isActions: true },
        });
      }

      return base;
    },
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
          <h2 className="text-lg font-semibold">Turma x Disciplina</h2>
          <p className="text-sm text-muted-foreground">
            Vincule disciplinas às turmas.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo vínculo
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={data} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar vínculo" : "Novo vínculo"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize os dados do vínculo."
                : "Preencha os campos para vincular a disciplina à turma."}
            </DialogDescription>
          </DialogHeader>
          <ClassSubjectForm
            record={selected}
            classGroups={classGroups}
            subjects={subjects}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
